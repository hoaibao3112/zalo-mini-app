import { z } from 'zod';

export const ecomProductsQuerySchema = z.object({
    source: z.enum(['NHANH', 'HARAVAN', 'ALL']).default('ALL'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    keyword: z.string().trim().max(200).optional(),
});

export type EcomProductsQuery = z.infer<typeof ecomProductsQuerySchema>;

// Regex SĐT VN linh hoạt: 0xx, 84xx, +84xx (không dấu chấm/khoảng)
const vnPhoneRegex = /^(\+?84|0)[3-9][0-9]{8}$/;

const shippingAddressSchema = z.object({
    name: z.string().trim().min(1, 'Tên người nhận không được để trống').max(100),
    phone: z
        .string()
        .trim()
        .transform(v => v.replace(/[\s.\-()]/g, '')) // xóa khoảng trắng, dấu chấm, gạch ngang
        .refine(v => vnPhoneRegex.test(v), 'Số điện thoại không hợp lệ (VD: 0901234567)'),
    address: z.string().trim().max(255).optional(),
    city: z.string().trim().max(100).optional(),
    district: z.string().trim().max(100).optional(),
    ward: z.string().trim().max(100).optional(),
});

export const ecomOrderItemSchema = z.object({
    // externalProductId: chấp nhận 0 với LOCAL, chỉ bắt buộc dương với NHANH/HARAVAN
    externalProductId: z.number().int().nonnegative('externalProductId phải là số nguyên không âm'),
    externalVariantId: z.number().int().positive().optional(),
    quantity: z.number().int().min(1, 'Số lượng tối thiểu là 1').max(100, 'Số lượng tối đa là 100'),
    unitPrice: z.number().nonnegative().optional(),
    name: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    // Cho phép thêm các fields mở rộng từ Cart (size, milkLevel, productId)
    size: z.string().optional().nullable(),
    milkLevel: z.number().optional().nullable(),
    productId: z.string().optional().nullable(),
    price: z.number().optional().nullable(),
});

export const createEcomOrderSchema = z.preprocess((val: any) => {
    if (val && typeof val === 'object' && !val.items) {
        // Hỗ trợ legacy flat-field format từ EcomOrderConfirm
        if (val.externalProductId != null) {
            val.items = [{
                externalProductId: Number(val.externalProductId) || 0,
                externalVariantId: val.externalVariantId ? Number(val.externalVariantId) : undefined,
                quantity: val.quantity ?? 1,
                unitPrice: val.unitPrice ?? 0,
                name: val.name ?? null,
                image: val.image ?? null,
            }];
        }
    }
    return val;
}, z.object({
    // customerId: chấp nhận cả CUID lẫn Zalo ID (string bất kỳ có độ dài hợp lý)
    customerId: z.string().min(1, 'customerId không được để trống').max(200),
    platform: z.enum(['NHANH', 'HARAVAN', 'LOCAL'], {
        invalid_type_error: 'platform phải là NHANH, HARAVAN hoặc LOCAL',
        required_error: 'platform là bắt buộc',
    }),
    items: z.array(ecomOrderItemSchema).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm').max(30, 'Đơn hàng không được quá 30 sản phẩm'),
    shippingAddress: shippingAddressSchema.optional(),
    deliveryType: z.enum(['DELIVERY', 'PICKUP']).optional().default('DELIVERY'),
    pickupTime: z.string().optional(),
    note: z.string().trim().max(500).optional(),
    idempotencyKey: z.string().trim().max(100).optional(),
    paymentMethod: z.enum(['COD', 'ONLINE']).optional().default('COD'),
}));

export type CreateEcomOrderInput = z.infer<typeof createEcomOrderSchema>;

export const createEcomOrderSchemaRefined = createEcomOrderSchema.superRefine((data, ctx) => {
    // HARAVAN yêu cầu externalVariantId cho từng sản phẩm
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

    // NHANH/HARAVAN yêu cầu shippingAddress
    if (data.platform !== 'LOCAL' && !data.shippingAddress) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['shippingAddress'],
            message: 'Đơn hàng giao hàng cần địa chỉ nhận hàng',
        });
    }

    // NHANH/HARAVAN: externalProductId phải > 0
    if (data.platform !== 'LOCAL') {
        data.items.forEach((item, index) => {
            if (item.externalProductId === 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['items', index, 'externalProductId'],
                    message: `Sản phẩm NHANH/HARAVAN phải có externalProductId > 0`,
                });
            }
        });
    }
});
