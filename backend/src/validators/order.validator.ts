import { z } from 'zod';

export const createOrderSchema = z.object({
    items: z.array(z.object({
        id:       z.string().uuid('productId phải là UUID'),
        name:     z.string().min(1).max(200),
        price:    z.number().nonnegative().max(50000000),
        quantity: z.number().int().min(1).max(100),
    })).min(1, 'Phải có ít nhất 1 sản phẩm').max(20, 'Tối đa 20 sản phẩm'),
    total:         z.number().nonnegative().max(500000000),
    paymentMethod: z.enum(['COD', 'ONLINE']),
    deliveryType:  z.enum(['DELIVERY', 'PICKUP']).default('DELIVERY'),
    note:          z.string().max(500).optional().nullable(),
    idempotencyKey: z.string().uuid('idempotencyKey phải là UUID').optional().nullable()
});

export const validate = (schema: z.ZodSchema) =>
    (req: any, res: any, next: any) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                details: result.error.flatten().fieldErrors,
            });
        }
        req.body = result.data;
        next();
    };
