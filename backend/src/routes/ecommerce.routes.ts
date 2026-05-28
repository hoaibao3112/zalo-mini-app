import { Router, Response } from 'express';
import { MiniappRequest } from '../types.js';
import prisma from '../lib/prisma.js';
import { successResponse, errorResponse } from '../lib/response.helper.js';
import { stockReservationService } from '../services/stockReservation.service.js';
import { logger } from '../lib/logger.js';

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
 * Đẩy đơn hàng trực tiếp lên sàn e-commerce (Haravan / Nhanh.vn)
 */
router.post('/ecom/orders', async (req: MiniappRequest, res: Response) => {
    try {
        const { createEcomOrder } = await import('../services/ecomService.js');
        const result = await createEcomOrder(req.workspaceId!, req.body);
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
router.post('/orders', async (req: MiniappRequest, res: Response) => {
    try {
        const { items, total, idempotencyKey, reservationId } = req.body;
        // Lấy customerId từ identity đã xác thực, không tin tưởng body của client
        const customerId = req.customer!.id;
        const accountId = req.workspaceId!;

        if (!items || total === undefined) {
            return res.status(400).json(errorResponse('MISSING_ORDER_DATA', 'Thiếu thông tin tạo đơn hàng'));
        }

        const orderData = {
            accountId,
            customerId,
            items: typeof items === 'string' ? items : JSON.stringify(items),
            total,
            status: 'pending',
            idempotencyKey: idempotencyKey || null
        };

        if (reservationId) {
            const order = await prisma.$transaction(async (tx) => {
                const newOrder = await tx.order.create({
                    data: orderData
                });

                const { confirmStockReservation } = await import('../lib/stockManager.js');
                await confirmStockReservation(reservationId, accountId, tx);

                return newOrder;
            });
            return res.json(successResponse(order, 'Tạo đơn hàng thành công'));
        } else {
            const order = await prisma.order.create({
                data: orderData
            });
            return res.json(successResponse(order, 'Tạo đơn hàng thành công'));
        }
    } catch (error: unknown) {
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
                return res.json(successResponse(existingOrder, 'Đơn hàng đã được tạo thành công trước đó'));
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
        return res.json(successResponse(orders));
    } catch (error) {
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
 * POS Packages Integration - Proxy/Forward to sale-funnel backend (localhost:10007)
 */
const SALE_FUNNEL_BACKEND = process.env.SALE_FUNNEL_BACKEND_URL || 'http://localhost:10007';

router.get('/express-packages', async (req: MiniappRequest, res: Response) => {
    const accountId = req.workspaceId!;
    const url = `${SALE_FUNNEL_BACKEND}/api/t/${accountId}/express-packages`;
    const token = req.headers['authorization'];
    
    try {
        console.log(`[ExpressPackagesProxy] Forwarding GET to: ${url}`);
        const response = await fetch(url, {
            headers: {
                ...(token ? { 'Authorization': token } : {}),
                'Accept': 'application/json'
            }
        });
        
        const data = await response.json() as any;
        res.status(response.status).json(data);
    } catch (err: any) {
        console.error('[ExpressPackagesProxy] GET Error:', err.message);
        res.status(502).json({ success: false, error: 'PROXY_FAILED', message: 'Không thể kết nối với dịch vụ POS.' });
    }
});

router.post('/express-packages/purchase', async (req: MiniappRequest, res: Response) => {
    const accountId = req.workspaceId!;
    const url = `${SALE_FUNNEL_BACKEND}/api/t/${accountId}/express-packages/purchase`;
    const token = req.headers['authorization'];
    const idempotencyKey = req.headers['idempotency-key'] as string;
    
    try {
        console.log(`[ExpressPackagesProxy] Forwarding POST to: ${url}`);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': token } : {}),
                ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
                'Accept': 'application/json'
            },
            body: JSON.stringify(req.body)
        });
        
        const data = await response.json() as any;
        res.status(response.status).json(data);
    } catch (err: any) {
        console.error('[ExpressPackagesProxy] POST Error:', err.message);
        res.status(502).json({ success: false, error: 'PROXY_FAILED', message: 'Không thể kết nối với dịch vụ POS.' });
    }
});

router.get('/express-packages/orders/:customerId', async (req: MiniappRequest, res: Response) => {
    const accountId = req.workspaceId!;
    const customerId = req.params.customerId;
    const url = `${SALE_FUNNEL_BACKEND}/api/t/${accountId}/express-packages/orders/${customerId}`;
    const token = req.headers['authorization'];
    
    try {
        console.log(`[ExpressPackagesProxy] Forwarding GET orders to: ${url}`);
        const response = await fetch(url, {
            headers: {
                ...(token ? { 'Authorization': token } : {}),
                'Accept': 'application/json'
            }
        });
        
        const data = await response.json() as any;
        res.status(response.status).json(data);
    } catch (err: any) {
        console.error('[ExpressPackagesProxy] GET orders Error:', err.message);
        res.status(502).json({ success: false, error: 'PROXY_FAILED', message: 'Không thể kết nối với dịch vụ POS.' });
    }
});

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

export default router;
