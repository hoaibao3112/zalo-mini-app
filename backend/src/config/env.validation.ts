import Joi from 'joi';
import dotenv from 'dotenv';

// Đảm bảo env được load trước khi validate
dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  
  PORT: Joi.number()
    .port()
    .default(5000),
  
  DATABASE_URL: Joi.string()
    .uri()
    .required()
    .messages({
      'any.required': 'DATABASE_URL là bắt buộc để kết nối PostgreSQL Database.'
    }),
  
  REDIS_URL: Joi.string()
    .uri()
    .required()
    .messages({
      'any.required': 'REDIS_URL là bắt buộc để kết nối Redis Cache.'
    }),
  
  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .messages({
      'string.min': 'JWT_SECRET phải có độ dài tối thiểu 32 ký tự để đảm bảo an toàn bảo mật.',
      'any.required': 'JWT_SECRET là bắt buộc để mã hóa/giải mã JWT token.'
    }),
  
  TOKEN_ENCRYPTION_KEY: Joi.string()
    .length(32)
    .required()
    .messages({
      'string.length': 'TOKEN_ENCRYPTION_KEY phải có độ dài chính xác 32 ký tự.',
      'any.required': 'TOKEN_ENCRYPTION_KEY là bắt buộc để mã hóa đối tác.'
    }),
  
  TOKEN_ENCRYPTION_KEY_HEX: Joi.string()
    .length(64)
    .required()
    .messages({
      'string.length': 'TOKEN_ENCRYPTION_KEY_HEX phải có độ dài chính xác 64 ký tự (HEX format).',
      'any.required': 'TOKEN_ENCRYPTION_KEY_HEX là bắt buộc để mã hóa đối tác.'
    }),
  
  ALLOWED_ORIGINS: Joi.string()
    .required()
    .messages({
      'any.required': 'ALLOWED_ORIGINS là bắt buộc để cấu hình CORS bảo mật.'
    }),
  
  SALE_FUNNEL_BACKEND_URL: Joi.string()
    .uri()
    .required()
    .messages({
      'string.uri': 'SALE_FUNNEL_BACKEND_URL phải là một địa chỉ URL hợp lệ.',
      'any.required': 'SALE_FUNNEL_BACKEND_URL là bắt buộc để làm proxy chuyển tiếp tĩnh/POS.'
    }),
  
  // Các API key dùng chung - Chỉ kiểm tra sự tồn tại (required) theo đúng hướng dẫn 🔑 BẢO VỆ API KEYS DÙNG CHUNG
  ZALO_APP_ID: Joi.string()
    .required()
    .messages({
      'any.required': 'ZALO_APP_ID là bắt buộc (Dùng chung chéo dự án, không đổi tên).'
    }),
  
  ZALO_APP_SECRET: Joi.string()
    .required()
    .messages({
      'any.required': 'ZALO_APP_SECRET là bắt buộc (Dùng chung chéo dự án, không đổi tên).'
    })
}).unknown(true); // Cho phép các env khác đi kèm mà không gây lỗi validation

export function validateEnv(): void {
  const { error, value } = envSchema.validate(process.env, { abortEarly: false });
  
  if (error) {
    console.error('❌ [CONFIG ERROR] Phát hiện lỗi cấu hình biến môi trường (.env):');
    error.details.forEach((detail) => {
      console.error(`   - ${detail.message}`);
    });
    console.error('⚠️ Hệ thống buộc phải dừng hoạt động do thiếu hoặc sai cấu hình nghiêm trọng.');
    process.exit(1);
  }
  
  // Gán lại process.env với giá trị đã được sanitize/default
  process.env = { ...process.env, ...value };
}
