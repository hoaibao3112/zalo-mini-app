import { Response, NextFunction } from 'express';
import { MiniappRequest } from '../types.js';
import prisma from '../../../lib/prisma.js';
import redis from '../../../lib/redis.js';
import { errorResponse } from '../../../common/response.helper.js';
import { logger } from '../../../common/logger.js';
import { getUserInfoFromToken } from '../../../lib/zaloApi.js';
import crypto from 'crypto';
import { Customer } from '@prisma/client';

/**
 * Cấu hình tham số Cache và Timeout
 */
const VERIFIED_TOKEN_TTL = 300;   // 5 phút
const TOKEN_MAP_TTL = 300;        // 5 phút
const ZALO_API_TIMEOUT_MS = 5000; // 5 giây

/**
 * Hash token thành chuỗi ngắn gọn để làm key Redis (Security: không lưu raw token)
 */
function hashToken(token: string): string {
    return crypto
        .createHash('sha256')
        .update(token)
        .digest('hex')
        .substring(0, 32);
}

/**
 * Interface cho dữ liệu lưu trong verified_token cache
 */
interface VerifiedTokenData {
    zaloId: string;
    customerId: string;
    customerName: string;
    accountId?: string;
}

/**
 * Middleware verifyZaloToken: Xác thực người dùng qua Zalo Access Token
 * Áp dụng cơ chế Cache 2 tầng để tối ưu latency và giảm tải cho Zalo API/Database.
 */
export const verifyZaloToken = async (
    req: MiniappRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const correlationId = req.correlationId || crypto.randomUUID();
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
        return void res.status(400).json(
            errorResponse('INVALID_TENANT_ID', 'Thiếu thông tin định danh không gian làm việc', correlationId)
        );
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return void res.status(401).json(
            errorResponse('UNAUTHORIZED_TOKEN', 'Vui lòng đăng nhập lại', correlationId)
        );
    }

    const token = authHeader.substring(7);

    // HỖ TRỢ THỬ NGHIỆM MOCK BYPASS: Chỉ hoạt động trên môi trường development để tránh rủi ro bảo mật
    // Security: Không cho phép mock token trên production (mục 30.1 docs)
    const isMockToken = token === 'mock-access-token-aizen-test';
    if (isMockToken && process.env.NODE_ENV === 'production') {
        return void res.status(401).json(
            errorResponse('UNAUTHORIZED_TOKEN', 'Vui lòng đăng nhập lại', correlationId)
        );
    }
    if (isMockToken) {
        try {
            let mockCustomer = await prisma.customer.findUnique({
                where: {
                    accountId_zaloId: {
                        accountId: workspaceId,
                        zaloId: 'mock-zalo-id-aizen-test'
                    }
                }
            });

            if (!mockCustomer) {
                mockCustomer = await prisma.customer.create({
                    data: {
                        accountId: workspaceId,
                        zaloId: 'mock-zalo-id-aizen-test',
                        name: 'Khách Hàng Thử Nghiệm',
                        avatar: 'https://placehold.co/150x150?text=Aizen+Test',
                        gender: 1,
                        birthday: '1998-08-08',
                        source: 'MINIAPP'
                    }
                });
            }

            req.zaloId = 'mock-zalo-id-aizen-test';
            req.customer = mockCustomer;
            return next();
        } catch (mockErr) {
            logger.error({ correlationId, workspaceId, action: 'MOCK_CUSTOMER_ERROR' }, 'Lỗi tạo/lấy mock customer trong verifyZaloToken:', mockErr);
        }
    }

    const verifiedTokenKey = `zalo_mini_app:verified_token:${hashToken(token)}`;

    // ───────────────────────────────────────────────────────
    // TẦNG 1 — Kiểm tra cache verified token (Skip toàn bộ)
    // ───────────────────────────────────────────────────────
    try {
        const cachedVerified = await redis.get(verifiedTokenKey);
        if (cachedVerified) {
            const data = JSON.parse(cachedVerified) as VerifiedTokenData;
            
            // Security: Verify cached accountId matches current workspaceId
            if (data.accountId && data.accountId !== workspaceId) {
                logger.warn(
                    { correlationId, workspaceId, customerId: data.customerId, action: 'CROSS_TENANT_ACCESS_ATTEMPT_CACHE' },
                    `Bị từ chối (cache): customer thuộc workspace ${data.accountId} cố truy cập workspace ${workspaceId}`
                );
                return void res.status(403).json(
                    errorResponse('FORBIDDEN', 'Không có quyền truy cập', correlationId)
                );
            }
            
            req.zaloId = data.zaloId;
            req.customer = {
                id: data.customerId,
                zaloId: data.zaloId,
                accountId: workspaceId,
                name: data.customerName
            } as Customer;

            return next();
        }
    } catch (redisErr) {
        // Fail-open: Redis lỗi thì tiếp tục các tầng sau
        logger.warn(
            { correlationId, workspaceId, action: 'VERIFY_ZALO_TOKEN_CACHE_READ_ERROR' },
            'Lỗi đọc cache verified_token, fallback sang Zalo API',
            redisErr
        );
    }

    // ───────────────────────────────────────────────────────
    // TẦNG 2 — Verify token với Zalo API
    // ───────────────────────────────────────────────────────
    let zaloId: string;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ZALO_API_TIMEOUT_MS);

    try {
        const userInfo = await getUserInfoFromToken(token);
        if (!userInfo || !userInfo.user_id) {
            return void res.status(401).json(
                errorResponse('INVALID_TOKEN', 'Token không hợp lệ, vui lòng đăng nhập lại', correlationId)
            );
        }
        zaloId = userInfo.user_id;
    } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
            return void res.status(503).json(
                errorResponse('SERVICE_UNAVAILABLE', 'Dịch vụ Zalo đang chậm, vui lòng thử lại sau', correlationId)
            );
        }
        
        logger.error(
            { correlationId, workspaceId, action: 'ZALO_API_VERIFY_ERROR' },
            'Lỗi xác thực token với Zalo API',
            err
        );

        return void res.status(401).json(
            errorResponse('INVALID_TOKEN', 'Token không hợp lệ, vui lòng đăng nhập lại', correlationId)
        );
    } finally {
        clearTimeout(timer);
    }

    // ───────────────────────────────────────────────────────
    // TẦNG 3 — Lookup customer trong DB (Có cache trung gian token_map)
    // ───────────────────────────────────────────────────────
    const tokenMapKey = `zalo_mini_app:token_map:${workspaceId}:${zaloId}`;
    let customerData: { id: string; zaloId: string | null; accountId: string; name: string | null } | null = null;
    let resolvedZaloId: string = zaloId; // Đã verify từ Zalo API, luôn là string

    try {
        const cachedMap = await redis.get(tokenMapKey);
        if (cachedMap) {
            customerData = JSON.parse(cachedMap);
        }
    } catch (redisErr) {
        logger.warn(
            { correlationId, workspaceId, action: 'TOKEN_MAP_CACHE_READ_ERROR' },
            'Lỗi đọc cache token_map',
            redisErr
        );
    }

    if (!customerData) {
        try {
            customerData = await prisma.customer.findUnique({
                where: {
                    accountId_zaloId: {
                        accountId: workspaceId,
                        zaloId: zaloId
                    }
                },
                select: {
                    id: true,
                    zaloId: true,
                    accountId: true,
                    name: true
                }
            });

            if (!customerData) {
                return void res.status(401).json(
                    errorResponse('CUSTOMER_NOT_FOUND', 'Tài khoản chưa được đăng ký, vui lòng mở lại ứng dụng', correlationId)
                );
            }

            // Cross-tenant isolation check: đảm bảo customer thuộc đúng workspace này
            // Bảo vệ chống lại truy cập xü tiến ví dụ: token của tenant A dùng trên /api/t/<tenantB>
            if (customerData.accountId !== workspaceId) {
                logger.warn(
                    { correlationId, workspaceId, customerId: customerData.id, action: 'CROSS_TENANT_ACCESS_ATTEMPT' },
                    `Bị từ chối: customer ${customerData.id} thuộc workspace ${customerData.accountId} cố truy cập workspace ${workspaceId}`
                );
                return void res.status(403).json(
                    errorResponse('FORBIDDEN', 'Không có quyền truy cập', correlationId)
                );
            }

            // Ưu tiên dùng zaloId đã xác thực từ Zalo API (luôn là string)
            if (customerData.zaloId) {
                resolvedZaloId = customerData.zaloId;
            }

            // Lưu cache token_map (fail-open)
            await redis.set(tokenMapKey, JSON.stringify(customerData), 'EX', TOKEN_MAP_TTL)
                .catch(() => {});
        } catch (dbErr) {
            logger.error(
                { correlationId, workspaceId, action: 'CUSTOMER_DB_LOOKUP_ERROR' },
                'Lỗi truy vấn database cho customer',
                dbErr
            );
            return void res.status(500).json(
                errorResponse('INTERNAL_ERROR', 'Đã xảy ra lỗi hệ thống khi truy xuất thông tin')
            );
        }
    }

    // ───────────────────────────────────────────────────────
    // TẦNG 4 — Lưu cache verified token và inject request
    // ───────────────────────────────────────────────────────
    const cacheValue: VerifiedTokenData = {
        zaloId: resolvedZaloId,
        customerId: customerData.id,
        customerName: customerData.name ?? '',
        accountId: customerData.accountId
    };

    // Fail-open: Redis lỗi không block request
    await redis.set(verifiedTokenKey, JSON.stringify(cacheValue), 'EX', VERIFIED_TOKEN_TTL)
        .catch(err => logger.warn(
            { correlationId, action: 'VERIFY_TOKEN_CACHE_SET_ERROR' },
            'Không thể lưu cache token',
            err
        ));

    // Inject vào request object
    req.zaloId = resolvedZaloId;
    req.customer = {
        id: customerData.id,
        zaloId: resolvedZaloId,
        accountId: workspaceId,
        name: customerData.name
    } as Customer;

    next();
};
