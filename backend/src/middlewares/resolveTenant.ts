import { Response, NextFunction } from 'express';
import { MiniappRequest } from '../types.js';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import { errorResponse } from '../lib/response.helper.js';
import { logger } from '../lib/logger.js';
import crypto from 'crypto';

/**
 * Regex kiểm tra UUID v4 hợp lệ — phải đúng 8-4-4-4-12 hex với version 4 và variant bits
 */
const UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Cache TTL workspace active trong Redis: 60 giây */
const TENANT_CACHE_TTL_SECONDS = 60;

/** Prefix Redis key để không bị nhầm với các key khác */
const TENANT_CACHE_PREFIX = 'tenant:active:';

/**
 * C1 — resolveTenant Middleware với đầy đủ:
 * 1. UUID v4 format validation
 * 2. DB lookup + isActive check
 * 3. Redis cache (fail-open)
 * 4. Structured logging với correlationId
 */
export const resolveTenant = async (
    req: MiniappRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    // Lấy correlationId từ header (nếu có) hoặc tạo mới
    const correlationId =
        (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
    req.correlationId = correlationId;

    // Trích xuất accountId từ params URL (/:accountId/...)
    let accountId = req.params.accountId;

    // Fallback: đọc từ URL pattern /api/t/{id}/... nếu mergeParams không hoạt động
    if (!accountId) {
        const match = req.originalUrl.match(/\/api\/t\/([^/]+)/);
        if (match) {
            accountId = match[1];
        }
    }

    if (!accountId) {
        return void res.status(400).json(
            errorResponse('INVALID_TENANT_ID', 'Thiếu thông tin định danh không gian làm việc')
        );
    }

    // 1. Validate UUID v4 format trước khi truy vấn DB
    if (!UUID_V4_REGEX.test(accountId)) {
        logger.warn(
            { correlationId, action: 'RESOLVE_TENANT' },
            `[resolveTenant] Tenant ID không hợp lệ (không phải UUID v4): ${accountId}`
        );
        return void res.status(400).json(
            errorResponse('INVALID_TENANT_ID', 'Định danh không gian làm việc không hợp lệ')
        );
    }

    // 2. Thử đọc từ Redis cache trước để tránh query DB liên tục
    const cacheKey = `${TENANT_CACHE_PREFIX}${accountId}`;
    try {
        const cached = await redis.get(cacheKey);
        if (cached === 'active') {
            // Cache hit — workspace đã được xác nhận active
            req.workspaceId = accountId;
            return void next();
        }
        // cached === 'inactive' nghĩa là đã biết workspace bị vô hiệu
        if (cached === 'inactive') {
            logger.warn(
                { correlationId, workspaceId: accountId, action: 'RESOLVE_TENANT' },
                `[resolveTenant] Workspace không hoạt động (từ cache): ${accountId}`
            );
            return void res.status(403).json(
                errorResponse('TENANT_INACTIVE', 'Không gian làm việc này đã bị vô hiệu hóa')
            );
        }
    } catch (redisErr) {
        // Fail-open: Redis lỗi → tiếp tục query DB, không block request
        logger.warn(
            { correlationId, workspaceId: accountId, action: 'RESOLVE_TENANT' },
            '[resolveTenant] Lỗi đọc Redis cache, fallback sang DB',
            redisErr
        );
    }

    // 3. Lookup workspace trong DB
    try {
        const workspace = await prisma.account.findUnique({
            where: { id: accountId },
            select: { id: true, isActive: true }
        });

        if (!workspace) {
            logger.warn(
                { correlationId, workspaceId: accountId, action: 'RESOLVE_TENANT' },
                `[resolveTenant] Workspace không tồn tại: ${accountId}`
            );
            // Cache kết quả miss ngắn (10 giây) để tránh DB spam
            try {
                await redis.setex(`tenant:miss:${accountId}`, 10, '1');
            } catch { /* ignore */ }
            return void res.status(404).json(
                errorResponse('TENANT_NOT_FOUND', 'Không tìm thấy không gian làm việc')
            );
        }

        if (!workspace.isActive) {
            logger.warn(
                { correlationId, workspaceId: accountId, action: 'RESOLVE_TENANT' },
                `[resolveTenant] Workspace không hoạt động: ${accountId}`
            );
            // Cache trạng thái inactive 60 giây
            try {
                await redis.setex(cacheKey, TENANT_CACHE_TTL_SECONDS, 'inactive');
            } catch { /* ignore */ }
            return void res.status(403).json(
                errorResponse('TENANT_INACTIVE', 'Không gian làm việc này đã bị vô hiệu hóa')
            );
        }

        // 4. Cache trạng thái active vào Redis (fail-open nếu lỗi)
        try {
            await redis.setex(cacheKey, TENANT_CACHE_TTL_SECONDS, 'active');
        } catch { /* ignore */ }

        // 5. Inject workspaceId vào request
        req.workspaceId = accountId;

        // FIX: Tenant Ownership Check in resolveTenant Middleware
        const reqWithUser = req as any;
        if (reqWithUser.user && reqWithUser.user.id) {
            const userId = reqWithUser.user.id;
            const memberCacheKey = `tenant:member:${accountId}:${userId}`;
            
            try {
                const cachedMembership = await redis.get(memberCacheKey);
                if (cachedMembership === 'inactive') {
                    logger.warn(
                        { correlationId, workspaceId: accountId, action: 'TENANT_OWNERSHIP_CHECK' },
                        `[resolveTenant] User ${userId} không có quyền truy cập tenant ${accountId} (từ cache)`
                    );
                    return void res.status(403).json(
                        errorResponse('FORBIDDEN', 'Bạn không có quyền truy cập không gian làm việc này')
                    );
                }
                
                if (cachedMembership !== 'active') {
                    const membership = await prisma.accountMember.findUnique({
                        where: {
                            workspaceId_userId: {
                                workspaceId: accountId,
                                userId: userId
                            }
                        },
                        select: {
                            status: true
                        }
                    });
                    
                    if (!membership || membership.status !== 'ACTIVE') {
                        logger.warn(
                            { correlationId, workspaceId: accountId, action: 'TENANT_OWNERSHIP_CHECK' },
                            `[resolveTenant] User ${userId} không thuộc tenant hoặc không active: ${accountId}`
                        );
                        try {
                            await redis.setex(memberCacheKey, 60, 'inactive');
                        } catch { /* ignore */ }
                        
                        return void res.status(403).json(
                            errorResponse('FORBIDDEN', 'Bạn không có quyền truy cập không gian làm việc này')
                        );
                    }
                    
                    try {
                        await redis.setex(memberCacheKey, 60, 'active');
                    } catch { /* ignore */ }
                }
            } catch (memberErr) {
                logger.error(
                    { correlationId, workspaceId: accountId, action: 'TENANT_OWNERSHIP_CHECK' },
                    '[resolveTenant] Lỗi khi kiểm tra quyền sở hữu tenant',
                    memberErr
                );
                return void res.status(503).json(
                    errorResponse('SERVICE_UNAVAILABLE', 'Dịch vụ tạm thời không khả dụng, vui lòng thử lại sau')
                );
            }
        }

        next();
    } catch (dbErr) {
        logger.error(
            { correlationId, workspaceId: accountId, action: 'RESOLVE_TENANT' },
            '[resolveTenant] Lỗi DB khi lookup workspace',
            dbErr
        );
        res.status(500).json(
            errorResponse('INTERNAL_ERROR', 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau')
        );
    }
};
