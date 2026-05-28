import { z } from 'zod';

export const ecomProductsQuerySchema = z.object({
    source: z.enum(['NHANH', 'HARAVAN', 'ALL']).default('ALL'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    keyword: z.string().trim().max(200).optional(),
});

export type EcomProductsQuery = z.infer<typeof ecomProductsQuerySchema>;

const shippingAddressSchema = z.object({
    name: z.string().trim().min(2, 'Tên người nhận tối thiểu 2 ký tự').max(100),
    phone: z
        .string()
        .trim()
        .regex(/^(0|\+84)[0-9]{8,10}$/, 'Số điện thoại không hợp lệ (VD: 0901234567)'),
    address: z.string().trim().max(255).optional(),
    city: z.string().trim().max(100).optional(),
    district: z.string().trim().max(100).optional(),
    ward: z.string().trim().max(100).optional(),
});

export const ecomOrderItemSchema = z.object({
    externalProductId: z.number().int().positive('externalProductId phải là số nguyên dương'),
    externalVariantId: z.number().int().positive().optional(),
    quantity: z.number().int().min(1, 'Số lượng tối thiểu là 1').max(100, 'Số lượng tối đa là 100'),
    unitPrice: z.number().nonnegative().optional(),
    name: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
});

export const createEcomOrderSchema = z.preprocess((val: any) => {
    if (val && typeof val === 'object' && !val.items) {
        if (val.externalProductId != null) {
            val.items = [{
                externalProductId: val.externalProductId,
                externalVariantId: val.externalVariantId,
                quantity: val.quantity ?? 1,
                unitPrice: val.unitPrice ?? 0,
            }];
        }
    }
    return val;
}, z.object({
    customerId: z.string().cuid('customerId không hợp lệ'),
    platform: z.enum(['NHANH', 'HARAVAN'], {
        invalid_type_error: 'platform phải là NHANH hoặc HARAVAN',
    }),
    items: z.array(ecomOrderItemSchema).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm').max(30, 'Đơn hàng không được quá 30 sản phẩm'),
    shippingAddress: shippingAddressSchema,
    note: z.string().trim().max(500).optional(),
    idempotencyKey: z.string().trim().max(100).optional(),
}));

export type CreateEcomOrderInput = z.infer<typeof createEcomOrderSchema>;

export const createEcomOrderSchemaRefined = createEcomOrderSchema.superRefine((data, ctx) => {
    if (data.platform === 'HARAVAN') {
        data.items.forEach((item, index) => {
            if (!item.externalVariantId) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['items', index, 'externalVariantId'],
                    message: 'Haravan yêu cầu externalVariantId (variant_id) cho tất cả sản phẩm',
                });
            }
        });
    }
});
