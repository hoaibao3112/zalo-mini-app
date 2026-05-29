import { Router, Response } from 'express';
import { MiniappRequest } from '../types.js';
import prisma from '../lib/prisma.js';
import { successResponse, errorResponse } from '../lib/response.helper.js';
import { stockReservationService } from '../services/stockReservation.service.js';
import { logger } from '../lib/logger.js';
import { orderNotificationService } from '../services/orderNotification.service.js';
import { createOrderSchema, validate } from '../validators/order.validator.js';
import { ZodError } from 'zod';

const router = Router();

/** Thời gian tối đa cho 1 lần đồng bộ sản phẩm từ Haravan / Nhanh.vn */
const SYNC_TIMEOUT_MS = 5 * 60 * 1000; // 5 phút

/**
 * Bọc Promise với timeout cứng để tránh zombie process
 * @param promise Promise cần giới hạn thời gian
 * @param ms     Thời gian timeout tính bằng mili-giây
 * @param label  Nhãn mô tả để log khi timeout xảy ra
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`TIMEOUT:${label}`)), ms)
    );
    return Promise.race([promise, timeoutPromise]);
}

/**
 * GET /ecom/products
 * Lấy danh sách sản phẩm đồng bộ từ sàn e-commerce (Haravan / Nhanh.vn)
 */
router.get('/ecom/products', async (req: MiniappRequest, res: Response) => {
    try {
        const { source, page, limit, keyword } = req.query;
        const { fetchEcomProducts } = await import('../services/ecomService.js');
        
        const accountId = req.workspaceId || 'd367e343-0a13-4f81-a452-1d6367421b0b';
        console.log(`[EcomRoute] Fetching for accountId: ${accountId}, source: ${source}`);

        const result = await fetchEcomProducts(accountId, {
            source: (source as 'HARAVAN' | 'NHANH' | 'ALL') || 'ALL',
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 20,
            keyword: keyword as string,
        });

        console.log(`[EcomRoute] Found ${result.data?.length || 0} products`);
        
        return res.json({
            success: true,
            data: result.data || [],
            total: result.total || 0,
            platform: result.platform
        });
    } catch (error: any) {
        console.error('[MiniappEcom] Lỗi tải sản phẩm Ecom:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'FETCH_ECOM_PRODUCTS_FAILED',
            message: 'Không thể tải danh sách sản phẩm liên kết'
        });
    }
});

/**
 * POST /ecom/orders
 * Đẩy đơn hàng trực tiếp lên sàn e-commerce (Haravan / Nhanh.vn / LOCAL)
 */
router.post('/ecom/orders', async (req: MiniappRequest, res: Response) => {
    try {
        const { createEcomOrderSchema } = await import('../schemas/ecom.schema.js');
        const parseResult = createEcomOrderSchema.safeParse(req.body);
        if (!parseResult.success) {
            const errorDetail = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
            console.error('[EcomOrders] Validation 400 ─ payload:', JSON.stringify(req.body, null, 2));
            console.error('[EcomOrders] Validation errors:', errorDetail);
            return res.status(400).json(errorResponse('INVALID_ORDER_DATA', errorDetail));
        }
        const { createEcomOrder } = await import('../services/ecomService.js');
        const result = await createEcomOrder(req.workspaceId!, parseResult.data as any);
        return res.json(successResponse(result, 'Tạo đơn hàng liên kết thành công'));
    } catch (error: unknown) {
        console.error('[MiniappEcom] Lỗi tạo đơn hàng Ecom:', error);
        return res.status(500).json(errorResponse('CREATE_ECOM_ORDER_FAILED', (error instanceof Error ? error.message : null) || 'Lỗi tạo đơn hàng liên kết'));
    }
});



/**
 * POST /products/:id/reserve
 * Khóa kho sản phẩm tạm thời khi checkout
 */
router.post('/products/:id/reserve', async (req: MiniappRequest, res: Response) => {
    try {
        const { quantity } = req.body;
        const productId = req.params.id;
        const workspaceId = req.workspaceId!;

        const parsedQuantity = parseInt(quantity);
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            return res.status(400).json(errorResponse('INVALID_QUANTITY', 'Số lượng sản phẩm không hợp lệ'));
        }

        const reservation = await stockReservationService.reserve(productId, workspaceId, parsedQuantity);
        
        return res.status(201).json(successResponse({
            reservationId: reservation.id,
            expiresAt: reservation.expiresAt
        }, 'Khóa kho sản phẩm tạm thời thành công'));
    } catch (error: unknown) {
        console.error('[MiniappEcom] Lỗi khóa kho:', error instanceof Error ? error.message : error);
        if (error instanceof Error) {
            if (error.message === 'PRODUCT_NOT_FOUND') {
                return res.status(404).json(errorResponse('PRODUCT_NOT_FOUND', 'Không tìm thấy thông tin sản phẩm'));
            }
            if (error.message === 'INSUFFICIENT_STOCK') {
                return res.status(400).json(errorResponse('INSUFFICIENT_STOCK', 'Sản phẩm đã hết hàng hoặc không đủ tồn kho khả dụng'));
            }
        }
        return res.status(500).json(errorResponse('RESERVE_STOCK_FAILED', 'Gặp sự cố khi thực hiện khóa kho'));
    }
});

/**
 * POST /orders
 * Tạo đơn hàng hệ thống (Local System Order)
 */
router.post('/orders', validate(createOrderSchema) as any, async (req: MiniappRequest, res: Response) => {
    try {
        const { items, total, idempotencyKey, reservationId, deliveryType, pickupTime, note, paymentMethod } = req.body;

        // Lấy customerId từ identity đã xác thực, không tin tưởng body của client
        const customerId = req.customer!.id;
        const accountId = req.workspaceId!;

        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
        const isOnlinePayment = paymentMethod === 'ONLINE';

        let paymentCode: bigint | null = null;
        let checkoutUrl: string | null = null;

        if (isOnlinePayment) {
            let isUnique = false;
            let attempts = 0;
            while (!isUnique && attempts < 10) {
                attempts++;
                const candidate = BigInt(Math.floor(100000000000 + Math.random() * 900000000000));
                const existing = await prisma.order.findUnique({
                    where: { paymentCode: candidate }
                });
                if (!existing) {
                    paymentCode = candidate;
                    isUnique = true;
                }
            }

            if (!paymentCode) {
                return res.status(500).json(errorResponse('PAYMENT_CODE_ERROR', 'Không thể sinh mã thanh toán duy nhất. Vui lòng thử lại.'));
            }

            const isMockSepay = process.env.SEPAY_MOCK === 'true' || !process.env.SEPAY_ACCOUNT_NO;

            if (isMockSepay) {
                const apiHost = process.env.SALE_FUNNEL_BACKEND_URL || 'http://localhost:10007';
                checkoutUrl = `${apiHost}/api/v1/payments/mock-checkout?orderCode=${paymentCode}&amount=${total}&description=ZMP-${paymentCode}&orderId=temp`;
            } else {
                const bankId = process.env.SEPAY_BANK_ID || 'MB';
                const accountNo = process.env.SEPAY_ACCOUNT_NO || '';
                const accountName = encodeURIComponent(process.env.SEPAY_ACCOUNT_NAME || '');
                const qrTemplate = process.env.SEPAY_QR_TEMPLATE || 'compact2';
                checkoutUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-${qrTemplate}.jpg?amount=${total}&addInfo=${paymentCode}&accountName=${accountName}`;
            }
        }

        const orderData: any = {
            accountId,
            customerId,
            items: typeof items === 'string' ? items : JSON.stringify(items),
            total,
            status: isOnlinePayment ? 'AWAITING_PAYMENT' : 'pending',
            idempotencyKey: idempotencyKey || null,
            deliveryType: deliveryType || 'DELIVERY',
            pickupTime: pickupTime ? new Date(pickupTime) : null,
            note: note || null,
            paymentMethod,
            paymentStatus: 'UNPAID',
            paymentCode,
            paymentUrl: checkoutUrl
        };


        // GỬI ĐƠN HÀNG SANG POS (CLICK & COLLECT)
        if (deliveryType === 'PICKUP') {
            const POS_BASE_URL = process.env.EXPRESSCAFE_BASE_URL || 'http://localhost:3002';
            const POS_API_KEY = process.env.EXPRESSCAFE_API_KEY || 'sf_live_replace_this_with_random_32_chars';
            const POS_DEFAULT_WAREHOUSE_ID = process.env.EXPRESSCAFE_DEFAULT_WAREHOUSE_ID || 'a123bc4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d';

            try {
                // Lấy thông tin sản phẩm đầu tiên làm mẫu tạo đơn lẻ trên POS
                const firstItem = Array.isArray(parsedItems) ? parsedItems[0] : null;
                const productId = firstItem?.productId || firstItem?.id || 'd123bc4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d';
                const unitId = firstItem?.unitId || 'u123bc4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d';
                const quantity = firstItem?.quantity || 1;

                // Định dạng chi tiết đơn hàng hẹn giờ để in phiếu bar tại quầy
                const itemsNote = Array.isArray(parsedItems)
                    ? parsedItems.map((it: any) => `${it.name || it.title || 'Nước uống'} x${it.quantity || 1}`).join(', ')
                    : '';
                const timeStr = pickupTime ? new Date(pickupTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Ngay';
                const posNotes = `[HẸN LẤY ${timeStr}] ${note || ''} | Món: ${itemsNote}`;

                const posResponse = await fetch(`${POS_BASE_URL}/api/sales`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': POS_API_KEY,
                        'idempotency-key': idempotencyKey || `pickup-${Date.now()}`
                    },
                    body: JSON.stringify({
                        warehouseId: POS_DEFAULT_WAREHOUSE_ID,
                        productId,
                        unitId,
                        quantity,
                        notes: posNotes
                    }),
                    signal: AbortSignal.timeout(10_000) // 10 giây timeout
                });

                if (posResponse.ok) {
                    const posResult = await posResponse.json() as any;
                    if (posResult.success && posResult.data) {
                        orderData.externalOrderId = posResult.data.invoice_number || posResult.data.invoiceNumber || posResult.data.id;
                        orderData.status = 'success'; // Đơn đã được chuyển tiếp & lưu POS thành công
                    }
                } else {
                    console.error('[POS_ORDER_SYNC] POS API returned non-OK status:', posResponse.status);
                    orderData.errorMessage = `POS API error status: ${posResponse.status}`;
                }
            } catch (posErr: any) {
                console.error('[POS_ORDER_SYNC] Failed to sync Click & Collect order to POS:', posErr.message);
                orderData.errorMessage = `POS connection failed: ${posErr.message}`;
            }
        }

        let finalOrder: any;
        if (reservationId) {
            finalOrder = await prisma.$transaction(async (tx) => {
                const newOrder = await tx.order.create({
                    data: orderData
                });

                const { confirmStockReservation } = await import('../lib/stockManager.js');
                await confirmStockReservation(reservationId, accountId, tx);

                return newOrder;
            });
        } else {
            finalOrder = await prisma.order.create({
                data: orderData
            });
        }

        if (isOnlinePayment && checkoutUrl?.includes('orderId=temp')) {
            const actualUrl = checkoutUrl.replace('orderId=temp', finalOrder.id);
            finalOrder = await prisma.order.update({
                where: { id: finalOrder.id },
                data: { paymentUrl: actualUrl }
            });
        }

        return res.json(successResponse({
            ...finalOrder,
            paymentCode: paymentCode ? String(paymentCode) : null
        }, 'Tạo đơn hàng thành công'));
    } catch (error: unknown) {
        if (error instanceof ZodError) {
            return res.status(400).json(errorResponse('VALIDATION_ERROR', error.issues[0]?.message));
        }
        console.error('[MiniappEcom] Lỗi tạo đơn hàng:', error);
        
        // Trùng lặp request (Idempotency key check)
        if (
            error !== null &&
            typeof error === 'object' &&
            'code' in error &&
            (error as { code: string }).code === 'P2002' &&
            req.body.idempotencyKey
        ) {
            const existingOrder = await prisma.order.findUnique({
                where: { idempotencyKey: req.body.idempotencyKey }
            });
            if (existingOrder) {
                return res.json(successResponse({
                    ...existingOrder,
                    paymentCode: existingOrder.paymentCode ? String(existingOrder.paymentCode) : null
                }, 'Đơn hàng đã được tạo thành công trước đó'));
            }
        }

        if (error instanceof Error) {
            if (error.message === 'RESERVATION_NOT_FOUND') {
                return res.status(404).json(errorResponse('RESERVATION_NOT_FOUND', 'Không tìm thấy thông tin khóa kho sản phẩm'));
            }
            if (error.message.startsWith('RESERVATION_ALREADY_')) {
                return res.status(400).json(errorResponse('RESERVATION_INVALID', 'Mã đặt kho đã được sử dụng hoặc đã hủy bỏ'));
            }
        }
        return res.status(500).json(errorResponse('CREATE_ORDER_FAILED', 'Gặp sự cố khi tạo đơn hàng'));
    }
});

/**
 * GET /orders/customer/:customerId
 * Lấy lịch sử đơn hàng của khách hàng
 */
router.get('/orders/customer/:customerId', async (req: MiniappRequest, res: Response) => {
    try {
        // Dùng identity đã xác thực, ngăn user A xem lịch sử đơn hàng của user B
        const customerId = req.customer!.id;
        const orders = await prisma.order.findMany({
            where: {
                accountId: req.workspaceId!,
                customerId,
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        
        // Chuyển đổi BigInt thành String để tránh lỗi JSON.stringify crash của Express
        const serializedOrders = orders.map(order => ({
            ...order,
            paymentCode: order.paymentCode ? String(order.paymentCode) : null
        }));

        return res.json(successResponse(serializedOrders));
    } catch (error) {
        console.error('[MiniappEcom] Lỗi tải danh sách đơn hàng:', error);
        return res.status(500).json(errorResponse('LOAD_ORDERS_FAILED', 'Lỗi tải danh sách đơn hàng'));
    }
});

/**
 * GET /sync/status
 * Lấy trạng thái đồng bộ sản phẩm e-commerce
 */
router.get('/sync/status', async (req: MiniappRequest, res: Response) => {
    try {
        const accountId = req.workspaceId!;
        const platform = req.query.platform as string;

        if (!platform) {
            const checkpoints = await prisma.syncCheckpoint.findMany({
                where: { accountId }
            });
            return res.json(successResponse(checkpoints));
        }

        const checkpoint = await prisma.syncCheckpoint.findUnique({
            where: {
                accountId_platform: { accountId, platform: platform.toLowerCase() }
            }
        });

        if (!checkpoint) {
            return res.json(successResponse({
                accountId,
                platform: platform.toLowerCase(),
                status: 'IDLE',
                lastSyncedPage: 0,
                errorCount: 0
            }));
        }

        return res.json(successResponse(checkpoint));
    } catch (error: unknown) {
        console.error('[MiniappEcom] Lỗi lấy trạng thái đồng bộ:', error);
        return res.status(500).json(errorResponse('GET_SYNC_STATUS_FAILED', 'Lỗi lấy trạng thái đồng bộ'));
    }
});

/**
 * POST /sync/trigger
 * Kích hoạt đồng bộ sản phẩm chạy ngầm từ Haravan / Nhanh.vn
 * Áp dụng timeout 5 phút để chặn zombie process memory leak
 */
router.post('/sync/trigger', async (req: MiniappRequest, res: Response) => {
    try {
        const accountId = req.workspaceId!;
        const { platform } = req.body;

        if (!platform || (platform !== 'NHANH' && platform !== 'HARAVAN')) {
            return res.status(400).json(errorResponse('INVALID_PLATFORM', 'Nền tảng đồng bộ không hợp lệ (NHANH hoặc HARAVAN)'));
        }

        const { syncEcomProducts } = await import('../services/ecomService.js');
        const correlationId = req.correlationId ?? `sync-${Date.now()}`;

        // Chạy async ngầm với timeout guard chặn zombie process
        withTimeout(
            syncEcomProducts(accountId, platform),
            SYNC_TIMEOUT_MS,
            `sync_${platform}_${accountId}`
        )
            .then(result => {
                console.log(`[SyncTrigger] Sync ${platform} thành công cho workspace ${accountId}:`, result);
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                if (message.startsWith('TIMEOUT:')) {
                    logger.error(
                        { correlationId, workspaceId: accountId, action: 'SYNC_TRIGGER_TIMEOUT' },
                        `Sync ${platform} vượt quá ${SYNC_TIMEOUT_MS / 1000}s — đã hủy`,
                        err
                    );
                } else {
                    logger.error(
                        { correlationId, workspaceId: accountId, action: 'SYNC_TRIGGER_ERROR' },
                        `Sync ${platform} thất bại`,
                        err
                    );
                }
            });

        return res.json(successResponse({
            success: true
        }, `Tiến trình đồng bộ sản phẩm ${platform} đã bắt đầu chạy ngầm.`));
    } catch (error: unknown) {
        console.error('[MiniappEcom] Lỗi kích hoạt đồng bộ:', error);
        return res.status(500).json(errorResponse('SYNC_TRIGGER_FAILED', 'Gặp sự cố khi kích hoạt tiến trình đồng bộ'));
    }
});

/**
 * POS Packages Integration - Proxy/Forward to sale-funnel backend
 *
 * FIX BUG 1: Thêm AbortSignal.timeout(12_000) cho tất cả 3 proxy routes.
 * Trước đây không có timeout → request treo 60-120s khi sale-funnel chậm/down.
 * Refactor thành helper chung để tránh lặp code và đảm bảo consistency.
 */
const SALE_FUNNEL_BACKEND = process.env.SALE_FUNNEL_BACKEND_URL || 'http://localhost:10007';
const PROXY_TIMEOUT_MS = 12_000; // 12 giây — đủ cho POS xử lý nhưng không treo mobile

/**
 * Helper proxy tới sale-funnel backend với timeout cứng và structured logging.
 * Forwards: Authorization, idempotency-key, x-correlation-id headers.
 */
async function proxyToSaleFunnel(
    req: MiniappRequest,
    res: Response,
    targetPath: string,
    method: 'GET' | 'POST' = 'GET'
): Promise<void> {
    const accountId = req.workspaceId!;
    const url = `${SALE_FUNNEL_BACKEND}/api/t/${accountId}${targetPath}`;
    const token = req.headers['authorization'];
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    const correlationId = req.correlationId ?? `proxy-${Date.now()}`;

    try {
        logger.info(
            { correlationId, workspaceId: accountId, action: 'SALE_FUNNEL_PROXY' },
            `${method} ${url}`
        );

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-correlation-id': correlationId,
                ...(token ? { 'Authorization': token } : {}),
                ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
            },
            ...(method === 'POST' ? { body: JSON.stringify(req.body) } : {}),
            signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
        });

        const data = await response.json() as Record<string, unknown>;
        res.status(response.status).json(data);
    } catch (err: unknown) {
        const isTimeout = err instanceof Error && err.name === 'TimeoutError';
        logger.error(
            { correlationId, workspaceId: accountId, action: 'SALE_FUNNEL_PROXY_ERROR' },
            isTimeout ? `Proxy timeout sau ${PROXY_TIMEOUT_MS}ms tới sale-funnel` : 'Proxy lỗi kết nối sale-funnel',
            err
        );
        res.status(isTimeout ? 504 : 502).json({
            success: false,
            error: isTimeout ? 'GATEWAY_TIMEOUT' : 'PROXY_FAILED',
            message: isTimeout
                ? 'Hệ thống POS đang bận, vui lòng thử lại sau.'
                : 'Không thể kết nối với dịch vụ POS.'
        });
    }
}

router.get('/express-packages', (req: MiniappRequest, res: Response) =>
    proxyToSaleFunnel(req, res, '/express-packages')
);

router.post('/express-packages/purchase', (req: MiniappRequest, res: Response) =>
    proxyToSaleFunnel(req, res, '/express-packages/purchase', 'POST')
);

router.get('/express-packages/orders/:customerId', (req: MiniappRequest, res: Response) =>
    proxyToSaleFunnel(req, res, `/express-packages/orders/${req.params.customerId}`)
);

/**
 * Catalog Categories & Products Integration - Proxy/Forward to sale-funnel backend (localhost:10007)
 */
router.get('/categories', async (req: MiniappRequest, res: Response) => {
    const accountId = req.workspaceId!;
    const url = `${SALE_FUNNEL_BACKEND}/api/t/${accountId}/categories`;
    const token = req.headers['authorization'];
    
    try {
        console.log(`[CategoriesProxy] Forwarding GET to: ${url}`);
        const response = await fetch(url, {
            headers: {
                ...(token ? { 'Authorization': token } : {}),
                'Accept': 'application/json'
            }
        });
        
        const data = await response.json() as any;
        res.status(response.status).json(data);
    } catch (err: any) {
        console.error('[CategoriesProxy] GET Error:', err.message);
        res.status(502).json({ success: false, error: 'PROXY_FAILED', message: 'Không thể kết nối với dịch vụ danh mục.' });
    }
});

router.get('/popups/active', async (req: MiniappRequest, res: Response) => {
    const accountId = req.workspaceId!;
    const url = `${SALE_FUNNEL_BACKEND}/api/t/${accountId}/popups/active`;
    const token = req.headers['authorization'];
    
    try {
        console.log(`[PopupProxy] Forwarding GET to: ${url}`);
        const response = await fetch(url, {
            headers: {
                ...(token ? { 'Authorization': token } : {}),
                'Accept': 'application/json'
            }
        });
        
        const data = await response.json() as any;
        res.status(response.status).json(data);
    } catch (err: any) {
        console.error('[PopupProxy] GET Error:', err.message);
        res.status(502).json({ success: false, error: 'PROXY_FAILED', message: 'Không thể kết nối với dịch vụ popup.' });
    }
});

router.get('/products', async (req: MiniappRequest, res: Response) => {
    const accountId = req.workspaceId!;
    const { categoryId } = req.query;
    let url = `${SALE_FUNNEL_BACKEND}/api/t/${accountId}/products`;
    if (categoryId) {
        url += `?categoryId=${categoryId}`;
    }
    const token = req.headers['authorization'];
    
    try {
        console.log(`[ProductsProxy] Forwarding GET to: ${url}`);
        const response = await fetch(url, {
            headers: {
                ...(token ? { 'Authorization': token } : {}),
                'Accept': 'application/json'
            }
        });
        
        const data = await response.json() as any;
        res.status(response.status).json(data);
    } catch (err: any) {
        console.error('[ProductsProxy] GET Error:', err.message);
        res.status(502).json({ success: false, error: 'PROXY_FAILED', message: 'Không thể kết nối với dịch vụ sản phẩm.' });
    }
});

router.get('/products/:id', async (req: MiniappRequest, res: Response) => {
    const accountId = req.workspaceId!;
    const productId = req.params.id;
    const url = `${SALE_FUNNEL_BACKEND}/api/t/${accountId}/products/${productId}`;
    const token = req.headers['authorization'];
    
    try {
        console.log(`[ProductDetailProxy] Forwarding GET to: ${url}`);
        const response = await fetch(url, {
            headers: {
                ...(token ? { 'Authorization': token } : {}),
                'Accept': 'application/json'
            }
        });
        
        const data = await response.json() as any;
        res.status(response.status).json(data);
    } catch (err: any) {
        console.error('[ProductDetailProxy] GET Error:', err.message);
        res.status(502).json({ success: false, error: 'PROXY_FAILED', message: 'Không thể kết nối với dịch vụ chi tiết sản phẩm.' });
    }
});

/**
 * POST /orders/:id/ready
 * Webhook từ POS (warehouse-express) thông báo khi nước uống đã chuẩn bị xong.
 */
router.post('/orders/:id/ready', async (req: any, res: Response) => {
    const orderId = req.params.id;
    const apiKey = req.headers['x-api-key'];
    const EXPECTED_KEY = process.env.EXPRESSCAFE_API_KEY || 'sf_live_replace_this_with_random_32_chars';
    
    if (apiKey !== EXPECTED_KEY) {
        return res.status(401).json(errorResponse('UNAUTHORIZED', 'API Key không hợp lệ.'));
    }

    try {
        // Cập nhật trạng thái đơn hàng thành "ready"
        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: { status: 'ready' }
        });

        // Gửi thông báo Zalo OA ZNS lập tức tới khách hàng
        const sent = await orderNotificationService.sendOrderReadyNotification(orderId);

        return res.json(successResponse({ 
            sent, 
            order: {
                ...updatedOrder,
                paymentCode: updatedOrder.paymentCode ? String(updatedOrder.paymentCode) : null
            }
        }, 'Thông báo sẵn sàng đã được xử lý thành công!'));
    } catch (err: any) {
        console.error('[POS_WEBHOOK_READY] Failed to process ready webhook:', err.message);
        return res.status(500).json(errorResponse('WEBHOOK_FAILED', err.message));
    }
});

/**
 * GET /ecom/orders/:id/payment-status
 * Frontend polling để biết khi nào thanh toán thành công
 */
router.get('/ecom/orders/:id/payment-status', async (req: MiniappRequest, res: Response) => {
    try {
        const { id } = req.params;
        const order = await prisma.order.findFirst({
            where: {
                id,
                accountId: req.workspaceId!,
            },
            select: {
                id: true,
                status: true,
                paymentStatus: true,
                paymentMethod: true,
                paymentUrl: true,
                total: true,
            }
        });

        if (!order) {
            return res.status(404).json(errorResponse('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng'));
        }

        return res.json(successResponse({
            orderId: order.id,
            paymentStatus: order.paymentStatus,
            status: order.status,
            paymentMethod: order.paymentMethod,
        }, 'Lấy trạng thái thanh toán thành công'));
    } catch (error: any) {
        console.error('[MiniappEcom] Lỗi lấy trạng thái thanh toán:', error.message);
        return res.status(500).json(errorResponse('GET_PAYMENT_STATUS_FAILED', error.message));
    }
});

export default router;
