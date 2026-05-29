import { z } from 'zod';
import dotenv from 'dotenv';

// Đảm bảo env được load trước khi validate
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  
  DATABASE_URL: z.string({
    required_error: 'DATABASE_URL là bắt buộc để kết nối PostgreSQL Database.'
  }).url('DATABASE_URL phải là một URL hợp lệ.'),
  
  REDIS_URL: z.string({
    required_error: 'REDIS_URL là bắt buộc để kết nối Redis Cache.'
  }).url('REDIS_URL phải là một URL hợp lệ.'),
  
  JWT_SECRET: z.string({
    required_error: 'JWT_SECRET là bắt buộc để mã hóa/giải mã JWT token.'
  }).min(32, 'JWT_SECRET phải có độ dài tối thiểu 32 ký tự để đảm bảo an toàn bảo mật.'),
  
  SEPAY_WEBHOOK_SECRET: z.string({
    required_error: 'SEPAY_WEBHOOK_SECRET là bắt buộc.',
  }).min(16, 'SEPAY_WEBHOOK_SECRET phải ít nhất 16 ký tự'),
  
  TOKEN_ENCRYPTION_KEY: z.string({
    required_error: 'TOKEN_ENCRYPTION_KEY là bắt buộc để mã hóa đối tác.'
  }).length(32, 'TOKEN_ENCRYPTION_KEY phải có độ dài chính xác 32 ký tự.'),
  
  TOKEN_ENCRYPTION_KEY_HEX: z.string({
    required_error: 'TOKEN_ENCRYPTION_KEY_HEX là bắt buộc để mã hóa đối tác.'
  }).length(64, 'TOKEN_ENCRYPTION_KEY_HEX phải có độ dài chính xác 64 ký tự (HEX format).'),
  
  ALLOWED_ORIGINS: z.string({
    required_error: 'ALLOWED_ORIGINS là bắt buộc để cấu hình CORS bảo mật.'
  }),
  
  SALE_FUNNEL_BACKEND_URL: z.string({
    required_error: 'SALE_FUNNEL_BACKEND_URL là bắt buộc để làm proxy chuyển tiếp tĩnh/POS.'
  }).url('SALE_FUNNEL_BACKEND_URL phải là một địa chỉ URL hợp lệ.'),
  
  ZALO_APP_ID: z.string({
    required_error: 'ZALO_APP_ID là bắt buộc (Dùng chung chéo dự án, không đổi tên).'
  }),
  
  ZALO_APP_SECRET: z.string({
    required_error: 'ZALO_APP_SECRET là bắt buộc (Dùng chung chéo dự án, không đổi tên).'
  }),

  EXPRESSCAFE_BASE_URL: z.string().optional().default('http://localhost:3002'),
  EXPRESSCAFE_API_KEY: z.string().optional().default('sf_live_replace_this_with_random_32_chars'),
  EXPRESSCAFE_DEFAULT_WAREHOUSE_ID: z.string().optional().default('a123bc4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d'),

  SEPAY_BANK_ID: z.string().optional().default('MB'),
  SEPAY_ACCOUNT_NO: z.string().optional().default(''),
  SEPAY_ACCOUNT_NAME: z.string().optional().default(''),
  SEPAY_QR_TEMPLATE: z.string().optional().default('compact2'),
  SEPAY_WEBHOOK_TOKEN: z.string().optional().default(''),
  SEPAY_MOCK: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional().default(true)
});

export function validateEnv(): void {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ [CONFIG ERROR] Phát hiện lỗi cấu hình biến môi trường (.env):');
    result.error.issues.forEach((issue) => {
      console.error(`   - [${issue.path.join('.') || 'unknown'}]: ${issue.message}`);
    });
    console.error('⚠️ Hệ thống buộc phải dừng hoạt động do thiếu hoặc sai cấu hình nghiêm trọng.');
    process.exit(1);
  }
  
  // Gán lại process.env với giá trị đã được sanitize/default
  process.env = { ...process.env, ...result.data } as any;
}
