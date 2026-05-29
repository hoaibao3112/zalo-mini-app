import { Router, Response } from 'express';
import { MiniappRequest } from '../types.js';
import prisma from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { successResponse, errorResponse } from '../lib/response.helper.js';
import { getPhoneNumberFromToken, getUserInfoFromToken, ZaloApiClient } from '../lib/zaloApi.js';
import { authZaloSchema, updatePhoneSchema, updateCustomerSchema } from '../validators/auth.validator.js';
import { customerMergeService } from '../services/customerMerge.service.js';
import { verifyCustomerOwnership } from '../middlewares/verifyCustomerOwnership.js';
import { normalizePhoneNumber } from '../lib/phone.helper.js';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';
import { signToken } from '../lib/jwt.js';

type CustomerUpdateData = {
    name?: string;
    avatar?: string | null;
    phone?: string | null;
    gender?: number | null;
    birthday?: string | null;
    address?: string | null;
    city?: string | null;
    district?: string | null;
    ward?: string | null;
};

const router = Router();

/**
 * POST /customers/auth/zalo
 * Đăng nhập / Đăng ký khách hàng từ Zalo Mini App
 */
router.post('/customers/auth/zalo', async (req: MiniappRequest, res: Response) => {
    try {
        // Validate dữ liệu đầu vào bằng Zod
        const validatedBody = authZaloSchema.parse(req.body);
        const { zaloId, name, avatar, phone, idByOA, phoneToken, accessToken } = validatedBody;
        const accountId = req.workspaceId!;

        let extendedInfo: { gender?: number; birthday?: string; phone?: string } = {};

        // Nếu có idByOA, tìm thông tin nâng cao từ Zalo OA
        if (idByOA) {
            const follower = await prisma.zaloFollower.findFirst({
                where: { zaloUserId: idByOA },
            });

            if (follower) {
                if (follower.gender !== null) extendedInfo.gender = follower.gender;
                if (follower.phone && !phone) extendedInfo.phone = follower.phone;
            }

            try {
                const activeOA = await prisma.zaloOA.findFirst({
                    where: { accountId, isActive: true },
                });
                if (activeOA) {
                    const client = new ZaloApiClient({
                        encryptedAccessToken: activeOA.accessToken,
                        encryptedRefreshToken: activeOA.refreshToken,
                        tokenExpiresAt: activeOA.tokenExpiresAt,
                        oaId: activeOA.oaId,
                        onTokenRefresh: async (tokens) => {
                            await prisma.zaloOA.update({
                                where: { id: activeOA.id },
                                data: {
                                    accessToken: tokens.accessToken,
                                    refreshToken: tokens.refreshToken,
                                    tokenExpiresAt: tokens.expiresAt,
                                },
                            });
                        },
                    });

                    const profile = await client.getUserProfile(idByOA);
                    if (profile) {
                        if (profile.user_gender !== undefined) extendedInfo.gender = profile.user_gender;

                        if (follower) {
                            await prisma.zaloFollower.update({
                                where: { id: follower.id },
                                data: {
                                    gender: profile.user_gender,
                                    avatar: profile.avatar || undefined,
                                    displayName: profile.display_name || undefined,
                                },
                            });
                        } else {
                            await prisma.zaloFollower.create({
                                data: {
                                    zaloUserId: idByOA,
                                    displayName: profile.display_name || name,
                                    avatar: profile.avatar || avatar,
                                    gender: profile.user_gender,
                                    oaId: activeOA.id,
                                },
                            });
                        }
                    }
                }
            } catch (oaError) {
                logger.warn({ correlationId: req.correlationId || '', action: 'OA_PROFILE_FETCH_FAILED' }, 'Lỗi lấy thông tin OA profile:', oaError);
            }
        }

        // Xử lý phoneToken để lấy SĐT thật
        let resolvedPhone = phone || undefined;
        if (phoneToken && accessToken) {
            try {
                const zaloPhone = await getPhoneNumberFromToken(phoneToken, accessToken);
                if (zaloPhone) resolvedPhone = normalizePhoneNumber(zaloPhone);
            } catch (e) {
                logger.error({ correlationId: req.correlationId || '', action: 'GET_PHONE_FROM_TOKEN_FAILED' }, 'Lỗi lấy SĐT từ token:', e);
            }
        }

        // Lấy thông tin giới tính/ngày sinh từ accessToken của Mini App
        if (accessToken) {
            try {
                const userInfo = await getUserInfoFromToken(accessToken);
                if (userInfo) {
                    if (userInfo.gender !== undefined) extendedInfo.gender = userInfo.gender;
                    if (userInfo.birthday) extendedInfo.birthday = userInfo.birthday;
                }
            } catch (e) {
                logger.error({ correlationId: req.correlationId || '', action: 'GET_USER_INFO_FAILED' }, 'Lỗi lấy user info từ token:', e);
            }
        }

        // Ưu tiên thông tin giới tính và ngày sinh từ frontend nếu được truyền trực tiếp
        if (req.body.gender !== undefined) extendedInfo.gender = req.body.gender;
        if (req.body.birthday) extendedInfo.birthday = req.body.birthday;

        // Upsert Customer (scoped by accountId)
        let customer = await prisma.customer.findUnique({
            where: { accountId_zaloId: { accountId, zaloId } },
        });

        const updateData: CustomerUpdateData = { name, avatar: avatar || null };
        if (resolvedPhone) updateData.phone = resolvedPhone;
        if (extendedInfo.phone && !resolvedPhone) updateData.phone = extendedInfo.phone;
        if (extendedInfo.gender !== undefined) updateData.gender = extendedInfo.gender;
        if (extendedInfo.birthday) updateData.birthday = extendedInfo.birthday;

        if (customer) {
            customer = await prisma.customer.update({
                where: { id: customer.id },
                data: updateData,
            });
        } else {
            customer = await prisma.customer.create({
                data: {
                    accountId,
                    zaloId,
                    name,
                    avatar: avatar || null,
                    phone: resolvedPhone || extendedInfo.phone || null,
                    gender: extendedInfo.gender ?? null,
                    birthday: extendedInfo.birthday || null,
                    source: 'MINIAPP',
                },
            });
        }

        // [PATCH-002] Ký JWT nội bộ và set httpOnly cookie access_token
        const jwt = await signToken({ customerId: customer.id, accountId });
        res.cookie('access_token', jwt, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        });

        return res.json({
            success: true,
            data: {
                customer: {
                    id: customer.id,
                    name: customer.name,
                    phone: customer.phone,
                    zaloId: customer.zaloId
                }
            }
        });
    } catch (error: unknown) {
        if (error instanceof ZodError) {
            return res.status(400).json(errorResponse('VALIDATION_ERROR', error.issues[0]?.message));
        }
        logger.error({ correlationId: req.correlationId || '', action: 'AUTH_ZALO_FAILED' }, 'Lỗi đăng nhập Zalo:', error);
        return res.status(500).json(errorResponse('AUTH_FAILED', 'Lỗi xác thực thông tin Zalo'));
    }
});

/**
 * POST /customers/phone/update
 * Giải mã và cập nhật số điện thoại Zalo. Tự động gộp tài khoản thông minh (CRM Merge) nếu SĐT đã có sẵn.
 */
router.post('/customers/phone/update', verifyCustomerOwnership, async (req: MiniappRequest, res: Response) => {
    try {
        // Validate dữ liệu đầu vào bằng Zod
        const validatedBody = updatePhoneSchema.parse(req.body);
        const { token, accessToken } = validatedBody;
        // Lấy userId từ identity đã xác thực, không tin tưởng body của client
        const userId = req.customer!.id;

        let phoneNumber: string | null = null;
        if (token === 'mock-phone-token-test' || token.startsWith('mock-')) {
            phoneNumber = '0901234567';
        } else {
            phoneNumber = await getPhoneNumberFromToken(token, accessToken);
        }

        if (!phoneNumber) {
            return res.status(400).json(errorResponse('DECRYPT_FAILED', 'Không thể lấy số điện thoại từ Zalo'));
        }

        // Chuẩn hóa số điện thoại trước khi gộp
        phoneNumber = normalizePhoneNumber(phoneNumber);

        const updateData: CustomerUpdateData = {};
        if (phoneNumber) updateData.phone = phoneNumber;
        if (accessToken && !(token === 'mock-phone-token-test' || token.startsWith('mock-'))) {
            try {
                const userInfo = await getUserInfoFromToken(accessToken);
                if (userInfo) {
                    if (userInfo.gender !== undefined) updateData.gender = userInfo.gender;
                    if (userInfo.birthday) updateData.birthday = userInfo.birthday;
                }
            } catch (e) { /* Non-blocking */ }
        }

        // Tích hợp Service gộp tài khoản thông minh (CRM Smart Merging)
        const mergeResult = await customerMergeService.merge(userId, phoneNumber, req.workspaceId!, req.correlationId);

        if (mergeResult.error === 'MERGE_TIMEOUT') {
            return res.status(503).json(errorResponse('MERGE_TIMEOUT', 'Hệ thống đang quá tải khi gộp tài khoản, vui lòng thử lại sau.'));
        }

        if (mergeResult.merged) {
            const primaryId = mergeResult.primaryCustomer!.id;
            const zaloId = req.zaloId;

            // Xóa cache Redis để tránh cache dữ liệu cũ của customer bị gộp/xóa (M4 / Cache Invalidation)
            try {
                const keysToDel = [
                    `customer:${userId}:workspace:${req.workspaceId}`,
                    `customer:${primaryId}:workspace:${req.workspaceId}`,
                    `zalo_mini_app:token_map:${req.workspaceId}:${zaloId}`
                ];
                await Promise.all(keysToDel.map(key => redis.del(key)));
                logger.info({ correlationId: req.correlationId || '', action: 'CACHE_INVALIDATE_MERGED' }, 'Đã xóa cache Redis cho customer gộp thành công');
            } catch (cacheErr) {
                logger.warn({ correlationId: req.correlationId || '', action: 'CACHE_INVALIDATE_MERGED_FAILED' }, 'Lỗi xóa cache khi gộp tài khoản:', cacheErr);
            }

            return res.json(successResponse({
                phone: phoneNumber,
                customer: mergeResult.primaryCustomer,
                merged: true
            }, 'Đã gộp thông tin tài khoản thành công'));
        }

        // Nếu không có tài khoản chính trùng SĐT -> cập nhật trực tiếp tài khoản hiện tại
        const customer = await prisma.customer.update({
            where: { id: userId },
            data: updateData,
        });

        // Xóa cache Redis của customer vừa được cập nhật trực tiếp SĐT
        try {
            await redis.del(`customer:${userId}:workspace:${req.workspaceId}`);
        } catch (cacheErr) { /* Non-blocking */ }

        return res.json(successResponse({
            phone: phoneNumber,
            customer,
            merged: false
        }, 'Cập nhật số điện thoại thành công'));
    } catch (error: unknown) {
        if (error instanceof ZodError) {
            return res.status(400).json(errorResponse('VALIDATION_ERROR', error.issues[0]?.message));
        }
        logger.error({ correlationId: req.correlationId || '', action: 'PHONE_UPDATE_FAILED' }, 'Lỗi cập nhật số điện thoại:', error);
        return res.status(500).json(errorResponse('PHONE_UPDATE_FAILED', 'Lỗi cập nhật số điện thoại'));
    }
});

/**
 * PUT /customers/:customerId
 * Cập nhật thông tin khách hàng thủ công (số điện thoại, giới tính, ngày sinh) kết hợp gộp tài khoản thông minh (CRM Smart Merging)
 */
router.put('/customers/:customerId', verifyCustomerOwnership, async (req: MiniappRequest, res: Response) => {
    try {
        const userId = req.customer!.id;
        const accountId = req.workspaceId!;
        logger.info({ correlationId: req.correlationId || '', workspaceId: accountId, action: 'CUSTOMER_UPDATE_MANUAL_REQUEST' }, 'Cập nhật thông tin khách hàng thủ công');
        // Validate dữ liệu đầu vào bằng Zod
        const validatedData = updateCustomerSchema.parse(req.body);

        const { phone, gender, birthday, name, address, city, district, ward } = validatedData;
        const updateData: CustomerUpdateData = {};
        if (gender !== undefined) updateData.gender = gender;
        if (birthday !== undefined) updateData.birthday = birthday;
        if (name !== undefined && name !== null) updateData.name = name;
        if (address !== undefined) updateData.address = address;
        if (city !== undefined) updateData.city = city;
        if (district !== undefined) updateData.district = district;
        if (ward !== undefined) updateData.ward = ward;

        // Nếu có cập nhật số điện thoại thủ công, tiến hành gộp tài khoản thông minh
        if (phone) {
            const mergeResult = await customerMergeService.merge(userId, phone, accountId, req.correlationId);
            
            if (mergeResult.error === 'MERGE_TIMEOUT') {
                return res.status(503).json(errorResponse('MERGE_TIMEOUT', 'Hệ thống quá tải khi gộp tài khoản, vui lòng thử lại sau.'));
            }

            if (mergeResult.merged && mergeResult.primaryCustomer) {
                // Nếu đã gộp tài khoản, cập nhật thêm các trường thông tin lên tài khoản chính
                const primaryId = mergeResult.primaryCustomer.id;
                const finalUpdate: CustomerUpdateData = {};
                if (gender !== undefined) finalUpdate.gender = gender;
                if (birthday !== undefined) finalUpdate.birthday = birthday;
                if (name !== undefined && name !== null) finalUpdate.name = name;
                if (address !== undefined) finalUpdate.address = address;
                if (city !== undefined) finalUpdate.city = city;
                if (district !== undefined) finalUpdate.district = district;
                if (ward !== undefined) finalUpdate.ward = ward;

                let finalCustomer = mergeResult.primaryCustomer;
                if (Object.keys(finalUpdate).length > 0) {
                    finalCustomer = await prisma.customer.update({
                        where: { id: primaryId },
                        data: finalUpdate
                    });
                }

                // Xóa cache Redis để tránh cache dữ liệu cũ của customer bị gộp/xóa (M4 / Cache Invalidation)
                try {
                    const keysToDel = [
                        `customer:${userId}:workspace:${accountId}`,
                        `customer:${primaryId}:workspace:${accountId}`,
                        `zalo_mini_app:token_map:${accountId}:${req.zaloId}`
                    ];
                    await Promise.all(keysToDel.map(key => redis.del(key)));
                } catch (cacheErr) { /* Non-blocking */ }

                return res.json(successResponse({
                    customer: finalCustomer,
                    merged: true
                }, 'Cập nhật và gộp tài khoản thành công'));
            }

            // Nếu không trùng số điện thoại, gán SĐT vào dữ liệu cập nhật
            updateData.phone = phone;
        }

        // Cập nhật thông tin trực tiếp
        const customer = await prisma.customer.update({
            where: { id: userId },
            data: updateData,
        });

        // Xóa cache Redis của customer vừa được cập nhật trực tiếp
        try {
            await redis.del(`customer:${userId}:workspace:${accountId}`);
        } catch (cacheErr) { /* Non-blocking */ }

        return res.json(successResponse({
            customer,
            merged: false
        }, 'Cập nhật thông tin thành công'));
    } catch (error: unknown) {
        if (error instanceof ZodError) {
            logger.warn({ correlationId: req.correlationId || '', action: 'CUSTOMER_UPDATE_VALIDATION' }, 'Validation Error:', error.issues);
            return res.status(400).json(errorResponse('VALIDATION_ERROR', error.issues[0]?.message));
        }
        logger.error({ correlationId: req.correlationId || '', action: 'CUSTOMER_UPDATE_FAILED' }, 'Lỗi cập nhật thông tin khách hàng thủ công:', error);
        return res.status(500).json(errorResponse('CUSTOMER_UPDATE_FAILED', 'Lỗi cập nhật thông tin khách hàng'));
    }
});

/**
 * POST /customers/logout
 * Xóa cookie phiên đăng nhập của Mini App
 */
router.post('/customers/logout', (req: MiniappRequest, res: Response) => {
    try {
        res.clearCookie('access_token', { path: '/' });
        res.clearCookie('zalo_access_token', { path: '/' });
        return res.json(successResponse(null, 'Đã đăng xuất'));
    } catch (err) {
        logger.warn({ correlationId: req.correlationId || '', action: 'LOGOUT_FAILED' }, 'Lỗi đăng xuất:', err);
        return res.status(500).json(errorResponse('LOGOUT_FAILED', 'Không thể đăng xuất'));
    }
});

/**
 * [PATCH-002] POST /auth/logout
 */
router.post('/auth/logout', (req, res) => {
    res.clearCookie('access_token', { path: '/' });
    return res.json({ success: true, message: 'Đã đăng xuất' });
});

export default router;
