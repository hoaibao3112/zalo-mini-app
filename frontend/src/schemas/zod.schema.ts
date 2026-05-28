import { z } from 'zod';

export const orderSchema = z.object({
  customerName: z.string().min(2, 'Tên phải có ít nhất 2 ký tự').max(50, 'Tên không được vượt quá 50 ký tự'),
  phone: z.string().transform(val => val.replace(/[\s.-]/g, '')).refine(val => /^(0|84|\+84)[3|5|7|8|9][0-9]{8}$/.test(val), 'Số điện thoại không hợp lệ'),
  address: z.string().min(5, 'Địa chỉ quá ngắn').max(255, 'Địa chỉ quá dài'),
  note: z.string().optional(),
});

export type OrderFormData = z.infer<typeof orderSchema>;
