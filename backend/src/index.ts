import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { validateEnv } from './config/env.validation.js';
import { resolveTenant } from './middlewares/resolveTenant.js';
import routes from './routes/index.js';
import prisma from './lib/prisma.js';
import redis from './lib/redis.js';
import { logger } from './lib/logger.js';

// 1. Chạy xác thực biến môi trường (Startup Guard) đầu tiên
validateEnv();

const app = express();
const PORT = process.env.PORT || 5000;

// 2. Middleware tạo/nhận x-correlation-id cho mỗi request (Tracing Log)
app.use((req: any, res, next) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// 3. Cấu hình CORS Hardened: Bảo vệ cổng giao tiếp API
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Chấp nhận request không đính kèm origin header (webview nội bộ Zalo, curl, postman...)
    if (!origin) {
      return callback(null, true);
    }
    
    // Chấp nhận Zalo Ecosystem domains
    const isZaloDomain = origin === 'https://h5.zdn.vn' || /\.zalo\.me$/.test(origin);
    if (isZaloDomain) {
      return callback(null, true);
    }
    
    // Chấp nhận domain khai báo trong ALLOWED_ORIGINS
    if (allowedOriginsEnv.includes(origin)) {
      return callback(null, true);
    }
    
    // Cho phép localhost và 127.0.0.1 khi ở môi trường development
    if (process.env.NODE_ENV === 'development') {
      const isLocal = /^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);
      if (isLocal) {
        return callback(null, true);
      }
    }
    
    // Từ chối và trả về false (Không ném lỗi crash app, trình duyệt sẽ tự động block 403)
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'bypass-tunnel-reminder', 'Bypass-Tunnel-Reminder'],
  credentials: true
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check API
app.get('/health', async (req: any, res) => {
  const correlationId = req.correlationId;
  try {
    // Kiểm tra kết nối Database & Redis
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ status: 'OK', services: { db: 'connected', redis: 'connected' } });
  } catch (err: any) {
    logger.error({ correlationId: correlationId || '', action: 'HEALTH_CHECK_FAILED' }, 'Lỗi kết nối cơ sở dữ liệu hoặc Redis trong Health Check:', err);
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// Định tuyến API đa doanh nghiệp (Multi-tenant)
// Toàn bộ các API nghiệp vụ của Mini App sẽ chạy dưới dạng /api/t/:accountId/...
app.use('/api/t/:accountId', resolveTenant as any, routes);

// Redirect static asset uploads to the CRM backend
app.get('/uploads/*', (req, res) => {
  const SALE_FUNNEL_BACKEND = process.env.SALE_FUNNEL_BACKEND_URL;
  res.redirect(`${SALE_FUNNEL_BACKEND}${req.originalUrl}`);
});

// Global Error Handler
app.use((err: any, req: any, res: express.Response, next: express.NextFunction) => {
  const correlationId = req.correlationId;
  logger.error(
    { correlationId: correlationId || '', action: 'GLOBAL_ERROR_HANDLER' },
    'Phát hiện lỗi không mong muốn trên hệ thống:',
    err
  );
  
  res.status(err.status || 500).json({
    success: false,
    error: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'Đã xảy ra sự cố hệ thống. Vui lòng thử lại sau!'
  });
});

// Khởi chạy Express Server
const server = app.listen(PORT, () => {
  logger.pino.info(`🚀 Standalone Zalo Mini App Backend is running on port ${PORT} [Mode: ${process.env.NODE_ENV}]`);
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  logger.pino.info('SIGTERM received. Gracefully shutting down server...');
  server.close(async () => {
    try {
      await prisma.$disconnect();
      await redis.quit();
      logger.pino.info('Connections closed safely. Process exited.');
      process.exit(0);
    } catch (err) {
      logger.pino.error(err, 'Error during shutdown');
      process.exit(1);
    }
  });
});

process.on('SIGINT', async () => {
  logger.pino.info('SIGINT received. Gracefully shutting down server...');
  server.close(async () => {
    try {
      await prisma.$disconnect();
      await redis.quit();
      logger.pino.info('Connections closed safely. Process exited.');
      process.exit(0);
    } catch (err) {
      logger.pino.error(err, 'Error during shutdown');
      process.exit(1);
    }
  });
});

