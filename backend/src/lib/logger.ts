import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

// Khởi tạo pino instance chính gốc
const pinoInstance = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
});

export interface LogContext {
    correlationId: string;
    workspaceId?: string;
    customerId?: string;
    action: string;
}

// Wrapper tương thích ngược với code cũ sử dụng logger.info(context, message, extra)
export const logger = {
  info: (contextOrMessage: LogContext | string, message?: string, data?: unknown) => {
    if (typeof contextOrMessage === 'string') {
      pinoInstance.info(contextOrMessage);
    } else {
      const ctx = contextOrMessage;
      pinoInstance.info({
        correlationId: ctx.correlationId,
        workspaceId: ctx.workspaceId,
        customerId: ctx.customerId,
        action: ctx.action,
        extra: data
      }, message || '');
    }
  },

  warn: (contextOrMessage: LogContext | string, message?: string, data?: unknown) => {
    if (typeof contextOrMessage === 'string') {
      pinoInstance.warn(contextOrMessage);
    } else {
      const ctx = contextOrMessage;
      pinoInstance.warn({
        correlationId: ctx.correlationId,
        workspaceId: ctx.workspaceId,
        customerId: ctx.customerId,
        action: ctx.action,
        extra: data
      }, message || '');
    }
  },

  error: (contextOrMessage: LogContext | string, message?: string, data?: unknown) => {
    if (typeof contextOrMessage === 'string') {
      pinoInstance.error(contextOrMessage);
    } else {
      const ctx = contextOrMessage;
      pinoInstance.error({
        correlationId: ctx.correlationId,
        workspaceId: ctx.workspaceId,
        customerId: ctx.customerId,
        action: ctx.action,
        extra: data instanceof Error ? { name: data.name, message: data.message, stack: data.stack } : data
      }, message || '');
    }
  },
  
  // Expose trực tiếp pino instance cho các trường hợp nâng cao
  pino: pinoInstance
};

