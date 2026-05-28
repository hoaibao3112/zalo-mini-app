import { z } from 'zod';
import { sanitizeTextTransformer, sanitizeUrlTransformer } from '../../../common/sanitize.js';
import { normalizePhoneNumber } from '../../../common/phone.helper.js';

/**
 * Schema xác thực và làm sạch dữ liệu đầu vào API Đăng nhập Zalo.
 * - Các field text tự do (name) được escape HTML chống XSS.
 * - Avatar URL được kiểm tra scheme hợp lệ (http/https only).
 * - Các field dạng ID/token giữ nguyên không transform.
 */
export const authZaloSchema = z.object({
    zaloId: z.string().min(1, 'Thiếu zaloId'),
    name: z.string().min(1, 'Thiếu tên hiển thị').transform(sanitizeTextTransformer),
    avatar: z.string().transform(sanitizeUrlTransformer).optional().nullable(),
    phone: z.string()
        .transform(val => val ? normalizePhoneNumber(val) : val)
        .optional()
        .nullable(),
    idByOA: z.string().optional().nullable(),
    phoneToken: z.string().optional().nullable(),
    accessToken: z.string().optional().nullable(),
    gender: z.number().int().min(0).max(1).optional().nullable(),
    birthday: z.string().optional().nullable()
});

/**
 * Schema xác thực dữ liệu đầu vào API Cập nhật số điện thoại Zalo.
 * Không transform token/accessToken vì đây là opaque string từ Zalo.
 */
export const updatePhoneSchema = z.object({
    token: z.string().min(1, 'Thiếu token giải mã số điện thoại'),
    accessToken: z.string().min(1, 'Thiếu accessToken Zalo')
});

export const updateCustomerSchema = z.object({
    phone: z.string()
        .transform(val => normalizePhoneNumber(val))
        .refine(val => !val || /^[0-9]{10}$/.test(val), 'Số điện thoại phải gồm 10 chữ số (VD: 0912345678)')
        .optional()
        .nullable(),
    gender: z.number().int().min(0).max(1).optional().nullable(),
    birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày sinh phải có định dạng YYYY-MM-DD').optional().nullable()
});


