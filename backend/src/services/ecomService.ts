import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import type { EcomProductsQuery, CreateEcomOrderInput } from '../schemas/ecom.schema.js';
import type { Order } from '@prisma/client';
import { logger } from '../lib/logger.js';

export type EcomPlatform = 'NHANH' | 'HARAVAN' | 'LOCAL';

export interface UnifiedProduct {
    id: string;
    externalId: number;
    platform: EcomPlatform;
    name: string;
    price: number;
    salePrice?: number;
    image: string;
    description?: string;
    sku?: string;
    categoryId?: string;
    inventory?: number;
}

export interface EcomProductListResult {
    success: boolean;
    platform: string;
    data: UnifiedProduct[];
    total: number;
    page: number;
}

export interface EcomOrderResult {
    success: boolean;
    platform: EcomPlatform;
    externalOrderId?: string | number;
    internalOrderId: string;
    message: string;
    paymentUrl?: string | null;
    paymentCode?: string | null;
}

/**
 * Giới hạn gửi đơn hàng (Rate Limiting) dùng Redis sliding window.
 */
export async function checkOrderRateLimit(ip: string): Promise<{ blocked: boolean; remaining: number }> {
    const key = `rate:ecom:order:${ip}`;
    const LIMIT = 10;
    const WINDOW = 60; // 60s

    const current = await redis.incr(key);
    if (current === 1) {
        await redis.expire(key, WINDOW);
    }

    if (current > LIMIT) {
        return { blocked: true, remaining: 0 };
    }
    return { blocked: false, remaining: LIMIT - current };
}

/**
 * Lấy danh sách sản phẩm liên kết trực tiếp từ DB.
 */
export async function fetchEcomProducts(
    accountId: string,
    query: EcomProductsQuery,
): Promise<EcomProductListResult> {
    const { page, limit, keyword } = query;

    // 1. Kiểm tra cache trước khi truy vấn DB (M5)
    const cacheKey = `products:${accountId}:${page}:${limit}:${keyword ?? ''}`;
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached) as EcomProductListResult;
        }
    } catch (cacheErr) {
        logger.warn(
            { correlationId: '', workspaceId: accountId, action: 'READ_PRODUCTS_CACHE_FAILED' },
            'Lỗi đọc cache products, fallback query DB',
            cacheErr
        );
    }

    const where = {
        accountId,
        isActive: true,
        ...(keyword && {
            name: {
                contains: keyword,
                mode: 'insensitive' as const,
            },
        }),
    };

    const [localProducts, total] = await Promise.all([
        prisma.product.findMany({
            where,
            include: { category: true },
            take: limit,
            skip: (page - 1) * limit,
        }),
        prisma.product.count({ where }),
    ]);

    const results = localProducts.map((p): UnifiedProduct => ({
        id: `local_${p.id}`,
        externalId: 0,
        platform: 'LOCAL',
        name: p.name,
        price: Number(p.price),
        salePrice: p.salePrice ? Number(p.salePrice) : undefined,
        image: p.image || '',
        description: p.description || '',
        sku: p.externalProductId || '',
        inventory: p.stock || 999,
        categoryId: p.categoryId,
    }));

    const resultObj: EcomProductListResult = {
        success: true,
        platform: 'LOCAL',
        data: results,
        total,
        page,
    };

    // 2. Ghi cache với TTL 120s (M5)
    try {
        await redis.set(cacheKey, JSON.stringify(resultObj), 'EX', 120);
    } catch (cacheErr) {
        logger.warn(
            { correlationId: '', workspaceId: accountId, action: 'WRITE_PRODUCTS_CACHE_FAILED' },
            'Lỗi ghi cache products',
            cacheErr
        );
    }

    return resultObj;
}

/**
 * Đẩy đơn hàng trực tiếp lên cơ sở dữ liệu nội bộ.
 * (Rút gọn từ 2-phase commit sang commit trực tiếp thành công để lập trình viên dev dễ dàng).
 */
export async function createEcomOrder(
    accountId: string,
    input: CreateEcomOrderInput,
): Promise<EcomOrderResult> {
    const { customerId, platform, items, shippingAddress, note, idempotencyKey, paymentMethod: inputPaymentMethod, deliveryType, pickupTime } = input as any;

    // Validate customer — bỏ qua với LOCAL nếu không có customerId (guest checkout)
    if (customerId) {
        const customerCheck = await prisma.customer.findFirst({
            where: { id: customerId, accountId },
            select: { id: true, name: true, phone: true, address: true },
        });
        if (!customerCheck) {
            throw new Error('Không tìm thấy khách hàng hoặc khách hàng không thuộc workspace này');
        }
    }

    const calculatedTotal = (items as Array<{ unitPrice?: number; quantity: number }>).reduce((sum: number, item) => {
        const itemPrice = item.unitPrice ? Number(item.unitPrice) : 0;
        return sum + (itemPrice * item.quantity);
    }, 0);

    const paymentMethod = inputPaymentMethod || 'COD';
    const isOnlinePayment = paymentMethod === 'ONLINE';

    let paymentCode: bigint | null = null;
    let checkoutUrl: string | null = null;

    // FIX: PaymentCode Uniqueness Guarantee
    let attempts = 0;
    let order!: Order;
    
    while (attempts < 3) {
        attempts++;
        if (isOnlinePayment) {
            const counter = await redis.incr(`payment_code_counter:${accountId}`);
            paymentCode = BigInt(Date.now()) * 10000n + BigInt(counter % 10000);

            const isMockSepay = process.env.SEPAY_MOCK === 'true' || !process.env.SEPAY_ACCOUNT_NO;

            if (isMockSepay) {
                const apiHost = process.env.SALE_FUNNEL_BACKEND_URL || 'http://localhost:10007';
                checkoutUrl = `${apiHost}/api/v1/payments/mock-checkout?orderCode=${paymentCode}&amount=${calculatedTotal}&description=ZMP-${paymentCode}&orderId=temp`;
            } else {
                const bankId = process.env.SEPAY_BANK_ID || 'MB';
                const accountNo = process.env.SEPAY_ACCOUNT_NO || '';
                const accountName = encodeURIComponent(process.env.SEPAY_ACCOUNT_NAME || '');
                const qrTemplate = process.env.SEPAY_QR_TEMPLATE || 'compact2';
                checkoutUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-${qrTemplate}.jpg?amount=${calculatedTotal}&addInfo=${paymentCode}&accountName=${accountName}`;
            }
        }

        try {
            order = await prisma.order.create({
                data: {
                    accountId,
                    customerId,
                    items: JSON.stringify(items),
                    total: calculatedTotal,
                    status: 'pending',
                    idempotencyKey,
                    paymentMethod,
                    paymentStatus: 'UNPAID',
                    paymentCode,
                    paymentUrl: checkoutUrl,
                    ...(deliveryType && { deliveryType }),
                    ...(pickupTime && { pickupTime: new Date(pickupTime) }),
                    note: [
                        note || '',
                        shippingAddress
                            ? `[GIAO HÀNG] ${shippingAddress.name} - ${shippingAddress.phone}${shippingAddress.address ? ' - ' + shippingAddress.address : ''}${shippingAddress.ward ? ', ' + shippingAddress.ward : ''}${shippingAddress.district ? ', ' + shippingAddress.district : ''}${shippingAddress.city ? ', ' + shippingAddress.city : ''}`
                            : ''
                    ].filter(Boolean).join(' | ') || null,
                },
            });
            break; // Success, break loop!
        } catch (error: any) {
            if (error.code === 'P2002') {
                const isPaymentCodeViolation = error.meta?.target?.includes('paymentCode') || error.message?.includes('paymentCode');
                const isIdempotencyKeyViolation = error.meta?.target?.includes('idempotencyKey') || error.message?.includes('idempotencyKey');

                if (isIdempotencyKeyViolation && idempotencyKey) {
                    const existingOrder = await prisma.order.findUnique({
                        where: { idempotencyKey }
                    });
                    if (existingOrder) {
                        return {
                            success: true,
                            platform,
                            internalOrderId: existingOrder.id,
                            message: 'Đơn hàng đã được tạo thành công trước đó (Idempotency)',
                            paymentUrl: existingOrder.paymentUrl,
                            paymentCode: existingOrder.paymentCode ? String(existingOrder.paymentCode) : null
                        };
                    }
                }
                
                if (isPaymentCodeViolation && isOnlinePayment && attempts < 3) {
                    logger.warn({ correlationId: '', workspaceId: accountId, action: 'PAYMENT_CODE_COLLISION' }, `Phát hiện trùng lặp paymentCode ${paymentCode}, đang thử lại lần thứ ${attempts}`);
                    continue;
                }
            }
            throw error;
        }
    }

    if (isOnlinePayment && checkoutUrl?.includes('orderId=temp')) {
        const actualUrl = checkoutUrl.replace('orderId=temp', order.id);
        order = await prisma.order.update({
            where: { id: order.id },
            data: { paymentUrl: actualUrl }
        });
    }

    return {
        success: true,
        platform: platform as EcomPlatform,
        internalOrderId: order.id,
        message: 'Đơn hàng đã được tạo và ghi nhận thành công trên hệ thống!',
        paymentUrl: order.paymentUrl,
        paymentCode: paymentCode ? String(paymentCode) : null
    };
}

/**
 * Đồng bộ sản phẩm (Giả lập để không báo lỗi biên dịch).
 */
export async function syncEcomProducts(
    accountId: string,
    platform: 'NHANH' | 'HARAVAN'
): Promise<{ success: boolean; message: string }> {
    logger.info(
        { correlationId: '', workspaceId: accountId, action: 'SYNC_ECOM_PRODUCTS' },
        `Mock sync triggered for account ${accountId} on platform ${platform}`
    );
    // Invalidate product cache
    try {
        await invalidateProductCache(accountId);
    } catch { /* non-critical */ }
    return {
        success: true,
        message: `Đã kích hoạt giả lập đồng bộ sản phẩm từ ${platform}`
    };
}

/**
 * Giải phóng cache Redis của sản phẩm (PATCH 2: Cache Invalidation)
 */
export async function invalidateProductCache(accountId: string): Promise<void> {
    try {
        const keys = await redis.keys(`products:${accountId}:*`);
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    } catch (err) {
        logger.error(
            { correlationId: '', workspaceId: accountId, action: 'INVALIDATE_PRODUCTS_CACHE_FAILED' },
            'Lỗi giải phóng cache products',
            err
        );
    }
}
