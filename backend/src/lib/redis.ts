import { Redis } from 'ioredis';

/**
 * App cache connection — dùng cho rate limiting, caching, idempotency keys
 * maxRetriesPerRequest: 3 là phù hợp cho các request thông thường
 */
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
});

/**
 * BullMQ connection — PHẢI dùng riêng với maxRetriesPerRequest: null
 * BullMQ Worker sẽ throw error nếu dùng connection có maxRetriesPerRequest !== null
 * @see https://docs.bullmq.io/guide/connections
 */
export const bullmqConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null, // bắt buộc với BullMQ
    enableReadyCheck: false,
});

export default redis;
