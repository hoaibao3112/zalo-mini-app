import { RateLimiterRedis } from 'rate-limiter-flexible';
import { Response, NextFunction } from 'express';
import { MiniappRequest } from '../types';
import redis from '../../../lib/redis.js';

/**
 * Giới hạn requests: 60 req/phút/customer (hoặc IP)
 * Dùng Redis backend để hoạt động chính xác trên multi-instance/PM2 cluster
 */
const RATE_LIMIT_POINTS    = 60;   // requests
const RATE_LIMIT_DURATION  = 60;   // seconds
const RATE_LIMIT_BLOCK_DUR = 60;   // block duration seconds

const rateLimiter = new RateLimiterRedis({
    storeClient:   redis,
    keyPrefix:     'miniapp_rl',
    points:        RATE_LIMIT_POINTS,
    duration:      RATE_LIMIT_DURATION,
    blockDuration: RATE_LIMIT_BLOCK_DUR,
});

/**
 * Middleware Rate Limiting bảo vệ API Zalo Mini App
 * Dùng Redis backend để đảm bảo counter chính xác khi chạy multi-instance
 */
export const miniappRateLimit = async (
    req: MiniappRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Ưu tiên Customer ID (nếu đã qua verifyZaloToken) -> Fallback về IP
        const key = req.customer?.id || req.ip || 'anonymous';

        const rateLimiterRes = await rateLimiter.consume(key);

        res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_POINTS));
        res.setHeader('X-RateLimit-Remaining', String(rateLimiterRes.remainingPoints));

        next();
    } catch (rateLimiterRes: unknown) {
        // Đây là RateLimiterRes object khi vượt limit (không phải Error thật sự)
        if (
            rateLimiterRes !== null &&
            typeof rateLimiterRes === 'object' &&
            'msBeforeNext' in rateLimiterRes
        ) {
            const retryAfter = Math.ceil(
                (rateLimiterRes as { msBeforeNext: number }).msBeforeNext / 1000
            );

            res.setHeader('Retry-After', String(retryAfter));
            res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_POINTS));
            res.setHeader('X-RateLimit-Remaining', '0');

            res.status(429).json({
                success: false,
                error: 'TOO_MANY_REQUESTS',
                message: `Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau ${retryAfter} giây.`,
                retryAfter,
            });
        } else {
            // Lỗi kết nối Redis thực sự → fail-open để không chặn user
            console.error('[miniappRateLimit] Lỗi kết nối Redis rate limiter:', rateLimiterRes);
            next();
        }
    }
};
