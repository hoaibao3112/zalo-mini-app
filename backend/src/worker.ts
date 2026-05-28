/**
 * worker.ts — Entry Point cho BullMQ Background Worker
 *
 * Container này chạy độc lập với API server, xử lý các tác vụ nặng:
 * - Gửi thông báo Zalo OA sau khi trúng thưởng (rewardNotification.service)
 * - Đồng bộ tồn kho định kỳ (stockManager)
 * - Các tác vụ async khác cần tách rời khỏi request/response cycle
 *
 * Thêm Queue/Worker mới bằng cách import và khởi tạo ở đây.
 */

import './config/env.validation.js';
import { validateEnv } from './config/env.validation.js';
import { logger } from './lib/logger.js';
import prisma from './lib/prisma.js';
import redis from './lib/redis.js';

// Chạy xác thực biến môi trường trước tiên
validateEnv();

logger.pino.info('🚀 Zalo Mini App Worker starting up...');

/**
 * Kiểm tra kết nối cơ sở dữ liệu và Redis khi khởi động
 */
async function checkConnections(): Promise<void> {
    try {
        await prisma.$queryRaw`SELECT 1`;
        logger.pino.info('✅ Database connection: OK');
    } catch (err) {
        logger.pino.error({ err }, '❌ Database connection failed');
        process.exit(1);
    }

    try {
        await redis.ping();
        logger.pino.info('✅ Redis connection: OK');
    } catch (err) {
        logger.pino.error({ err }, '❌ Redis connection failed');
        process.exit(1);
    }
}

/**
 * Graceful Shutdown — đóng kết nối trước khi thoát
 */
async function gracefulShutdown(signal: string): Promise<void> {
    logger.pino.info(`${signal} received. Worker gracefully shutting down...`);

    try {
        await prisma.$disconnect();
        await redis.quit();
        logger.pino.info('Worker connections closed. Exiting...');
        process.exit(0);
    } catch (err) {
        logger.pino.error({ err }, 'Error during worker shutdown');
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Main — Khởi động worker
 */
async function main(): Promise<void> {
    await checkConnections();

    logger.pino.info('✅ Zalo Mini App Worker is running and waiting for jobs...');

    // ================================================================
    // THÊM CÁC BULLMQ WORKERS Ở ĐÂY khi có queue jobs cần xử lý
    // Ví dụ:
    //   import { rewardNotificationWorker } from './jobs/rewardNotification.worker.js';
    //   rewardNotificationWorker.on('completed', (job) => logger.pino.info({ jobId: job.id }, 'Job completed'));
    // ================================================================

    // Giữ process sống để lắng nghe jobs
    // (BullMQ workers tự loop, không cần setInterval)
    logger.pino.info('Worker is idle. Waiting for BullMQ jobs...');
}

main().catch((err) => {
    logger.pino.error({ err }, 'Fatal error in worker main()');
    process.exit(1);
});
