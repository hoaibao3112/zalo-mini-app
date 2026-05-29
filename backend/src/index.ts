import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { validateEnv } from './config/env.validation.js';
import { resolveTenant } from './middlewares/resolveTenant.js';
import routes from './routes/index.js';
import prisma from './lib/prisma.js';
import redis from './lib/redis.js';
import { logger } from './lib/logger.js';

// 1. Chạy xác thực biến môi trường (Startup Guard) đầu tiên
validateEnv();

const app = express();
app.use(cookieParser());
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
    
    // Chấp nhận Zalo Ecosystem domains và giao thức webview native (zbrowser://, zmp://)
    const isZaloDomain = origin === 'https://h5.zdn.vn' || 
                         /\.zalo\.me$/.test(origin) || 
                         origin.startsWith('zbrowser://') || 
                         origin.startsWith('zmp://');
    if (isZaloDomain) {
      return callback(null, true);
    }
    
    // Chấp nhận domain khai báo trong ALLOWED_ORIGINS
    if (allowedOriginsEnv.includes(origin)) {
      return callback(null, true);
    }
    
    // Cho phép localhost, 127.0.0.1 và tunnel domains khi ở môi trường development
    if (process.env.NODE_ENV === 'development') {
      const isLocal = /^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);
      const isTunnel = origin.endsWith('.trycloudflare.com') || origin.includes('trycloudflare.com');
      if (isLocal || isTunnel) {
        return callback(null, true);
      }
    }
    
    // Từ chối và trả về false (Không ném lỗi crash app, trình duyệt sẽ tự động block 403)
    return callback(new Error('CORS_BLOCKED:' + origin), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'bypass-tunnel-reminder', 'Bypass-Tunnel-Reminder', 'idempotency-key', 'Idempotency-Key'],
  credentials: true
}));

// [PATCH-001] CORS error handling middleware ngay sau app.use(cors(...))
app.use((err: any, req: any, res: any, next: any) => {
  if (err && err.message && err.message.startsWith('CORS_BLOCKED')) {
    const origin = err.message.split(':')[1] || '';
    const correlationId = req.correlationId;
    logger.error({
      action: 'CORS_REJECTED',
      correlationId
    }, 'CORS request rejected', { origin, ip: req.ip });
    return res.status(403).json({ error: 'CORS_BLOCKED', message: 'Origin không được phép' });
  }
  next(err);
});

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// [PATCH-007] Health Check API với uptime và version
app.get('/health', async (req: any, res) => {
  const checks: Record<string, string> = {
    database: 'unknown',
    redis:    'unknown',
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'up'
  } catch {
    checks.database = 'down'
  }

  try {
    await redis.ping()
    checks.redis = 'up'
  } catch {
    checks.redis = 'down'
  }

  const healthy = Object.values(checks).every(s => s === 'up')

  res.status(healthy ? 200 : 503).json({
    status:    healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
    version:   process.env.APP_VERSION ?? '1.0.0',
    services:  checks,
  })
})

// Định tuyến API đa doanh nghiệp (Multi-tenant)
// Toàn bộ các API nghiệp vụ của Mini App sẽ chạy dưới dạng /api/t/:accountId/...
app.use('/api/t/:accountId', resolveTenant as any, routes);

// Redirect static asset uploads to the CRM backend
app.get('/uploads/*', (req, res) => {
  const SALE_FUNNEL_BACKEND = process.env.SALE_FUNNEL_BACKEND_URL;
  res.redirect(`${SALE_FUNNEL_BACKEND}${req.originalUrl}`);
});

// [PATCH-005] Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  const correlationId = req.correlationId

  // 1. Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const map: Record<string, [number, string]> = {
      P2002: [409, 'DUPLICATE_ENTRY'],
      P2025: [404, 'NOT_FOUND'],
      P2003: [400, 'FOREIGN_KEY_VIOLATION'],
      P2014: [400, 'RELATION_VIOLATION'],
    }
    const [status, code] = map[err.code] ?? [400, 'DATABASE_ERROR']
    logger.warn({ correlationId, action: 'DATABASE_ERROR' }, code, { prismaCode: err.code })
    return res.status(status).json({ error: code })
  }

  // 2. Zod errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors,
    })
  }

  // 3. Business logic errors (isBusinessError: true)
  if (err.isBusinessError) {
    return res.status(err.status || 400).json({
      error: err.code,
      message: err.message,
    })
  }

  // 4. Unknown — KHÔNG lộ message trên production
  logger.error({ correlationId, action: 'UNHANDLED_ERROR' }, 'Unhandled error', err)
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'Đã xảy ra lỗi, vui lòng thử lại sau'
      : err.message,
  })
})

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

