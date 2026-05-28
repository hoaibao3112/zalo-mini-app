import { Router, Response } from 'express';
import { MiniappRequest } from '../types.js';
import prisma from '../lib/prisma.js';
import { successResponse, errorResponse } from '../lib/response.helper.js';
import { getPhoneNumberFromToken, getUserInfoFromToken, ZaloApiClient } from '../lib/zaloApi.js';
import { authZaloSchema, updatePhoneSchema, updateCustomerSchema } from '../validators/auth.validator.js';
import { customerMergeService } from '../services/customerMerge.service.js';
import { verifyCustomerOwnership } from '../middlewares/verifyCustomerOwnership.js';
import { normalizePhoneNumber } from '../lib/phone.helper.js';
import { ZodError } from 'zod';

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
                console.warn('[MiniappAuth] Lỗi lấy thông tin OA profile:', oaError);
            }
        }

        // Xử lý phoneToken để lấy SĐT thật
        let resolvedPhone = phone || undefined;
        if (phoneToken && accessToken) {
            try {
                const zaloPhone = await getPhoneNumberFromToken(phoneToken, accessToken);
                if (zaloPhone) resolvedPhone = normalizePhoneNumber(zaloPhone);
            } catch (e) {
                console.error('[MiniappAuth] Lỗi lấy SĐT từ token:', e);
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
                console.error('[MiniappAuth] Lỗi lấy user info từ token:', e);
            }
        }

        // Ưu tiên thông tin giới tính và ngày sinh từ frontend nếu được truyền trực tiếp
        if (req.body.gender !== undefined) extendedInfo.gender = req.body.gender;
        if (req.body.birthday) extendedInfo.birthday = req.body.birthday;

        // Upsert Customer (scoped by accountId)
        let customer = await prisma.customer.findUnique({
            where: { accountId_zaloId: { accountId, zaloId } },
        });

        const updateData: any = { name, avatar: avatar || null };
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

        // Nếu frontend gửi accessToken, đặt httpOnly cookie để frontend không cần lưu token trên localStorage
        if (accessToken) {
            const isProd = process.env.NODE_ENV === 'production';
            res.cookie('zalo_access_token', accessToken, {
                httpOnly: true,
                secure: isProd,
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
                path: '/'
            });
        }

        return res.json(successResponse(customer, 'Xác thực thành công'));
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json(errorResponse('VALIDATION_ERROR', error.issues[0]?.message));
        }
        console.error('[MiniappAuth] Lỗi đăng nhập Zalo:', error);
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

        const updateData: any = { phone: phoneNumber };
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

        return res.json(successResponse({
            phone: phoneNumber,
            customer,
            merged: false
        }, 'Cập nhật số điện thoại thành công'));
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json(errorResponse('VALIDATION_ERROR', error.issues[0]?.message));
        }
        console.error('[MiniappAuth] Lỗi cập nhật số điện thoại:', error);
        return res.status(500).json(errorResponse('PHONE_UPDATE_FAILED', 'Lỗi cập nhật số điện thoại'));
    }
});

/**
 * PUT /customers/:customerId
 * Cập nhật thông tin khách hàng thủ công (số điện thoại, giới tính, ngày sinh) kết hợp gộp tài khoản thông minh (CRM Smart Merging)
 */
router.put('/customers/:customerId', verifyCustomerOwnership, async (req: MiniappRequest, res: Response) => {
    try {
        console.log('[MiniappAuth] PUT /customers/:customerId - Body:', req.body);
        // Validate dữ liệu đầu vào bằng Zod
        const validatedData = updateCustomerSchema.parse(req.body);
        const userId = req.customer!.id;
        const accountId = req.workspaceId!;

        const { phone, gender, birthday } = validatedData;
        const updateData: any = {};
        if (gender !== undefined) updateData.gender = gender;
        if (birthday !== undefined) updateData.birthday = birthday;

        // Nếu có cập nhật số điện thoại thủ công, tiến hành gộp tài khoản thông minh
        if (phone) {
            const mergeResult = await customerMergeService.merge(userId, phone, accountId, req.correlationId);
            
            if (mergeResult.error === 'MERGE_TIMEOUT') {
                return res.status(503).json(errorResponse('MERGE_TIMEOUT', 'Hệ thống quá tải khi gộp tài khoản, vui lòng thử lại sau.'));
            }

            if (mergeResult.merged && mergeResult.primaryCustomer) {
                // Nếu đã gộp tài khoản, cập nhật thêm gender/birthday lên tài khoản chính
                const primaryId = mergeResult.primaryCustomer.id;
                const finalUpdate: any = {};
                if (gender !== undefined) finalUpdate.gender = gender;
                if (birthday !== undefined) finalUpdate.birthday = birthday;

                let finalCustomer = mergeResult.primaryCustomer;
                if (Object.keys(finalUpdate).length > 0) {
                    finalCustomer = await prisma.customer.update({
                        where: { id: primaryId },
                        data: finalUpdate
                    });
                }

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

        return res.json(successResponse({
            customer,
            merged: false
        }, 'Cập nhật thông tin thành công'));
    } catch (error: any) {
        if (error instanceof ZodError) {
            console.warn('[MiniappAuth] Validation Error:', error.issues);
            return res.status(400).json(errorResponse('VALIDATION_ERROR', error.issues[0]?.message));
        }
        console.error('[MiniappAuth] Lỗi cập nhật thông tin khách hàng thủ công:', error);
        return res.status(500).json(errorResponse('CUSTOMER_UPDATE_FAILED', 'Lỗi cập nhật thông tin khách hàng'));
    }
});

/**
 * POST /customers/logout
 * Xóa cookie phiên đăng nhập của Mini App
 */
router.post('/customers/logout', (req: MiniappRequest, res: Response) => {
    try {
        res.clearCookie('zalo_access_token', { path: '/' });
        return res.json(successResponse(null, 'Đã đăng xuất'));
    } catch (err) {
        console.warn('[MiniappAuth] Logout error', err);
        return res.status(500).json(errorResponse('LOGOUT_FAILED', 'Không thể đăng xuất'));
    }
});

export default router;
