import { Response, NextFunction } from 'express';
import { MiniappRequest } from '../types.js';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import type { Customer } from '@prisma/client';

/**
 * Middleware xác thực khách hàng (Customer) thuộc về không gian làm việc (Workspace/Tenant) hiện tại.
 * Chặn đứng mọi hành vi truy cập chéo dữ liệu giữa các Workspace khác nhau.
 *
 * CƠ CHẾ SUY LUẬN THÔNG MINH:
 * - Nếu request chứa customerId hoặc userId, middleware xác thực trực tiếp.
 * - Nếu request là các API phần thưởng chứa rewardId (:id của PlayReward), middleware tự động
 *   truy vấn DB để suy luận ra customerId của chủ sở hữu quà và thực hiện xác thực tương ứng.
 */
export const verifyCustomerOwnership = async (
    req: MiniappRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const workspaceId = req.workspaceId;
        if (!workspaceId) {
            return res.status(401).json({
                success: false,
                error: 'UNAUTHORIZED_TENANT',
                message: 'Không tìm thấy thông tin định danh không gian làm việc'
            });
        }

        // 1. Tìm customerId trực tiếp từ body hoặc params URL
        let customerId = req.body.customerId || req.body.userId || req.params.customerId;

        // 2. Cơ chế suy luận qua PlayReward nếu là route liên quan tới phần quà trúng thưởng (:id)
        if (!customerId && req.params.id && (req.baseUrl + req.path).includes('spin-rewards')) {
            const reward = await prisma.playReward.findUnique({
                where: { id: req.params.id },
                include: { customer: true }
            });
            if (reward && reward.customer) {
                customerId = reward.customerId;
            }
        }

        if (!customerId) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_CUSTOMER_ID',
                message: 'Thiếu thông tin định danh khách hàng để xác thực quyền sở hữu'
            });
        }

        // 3. Sử dụng Redis Cache để kiểm tra thông tin Customer (M4)
        const cacheKey = `customer:${customerId}:workspace:${workspaceId}`;
        let customer: Customer | null = null;

        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                customer = JSON.parse(cached) as Customer;
            }
        } catch (cacheErr) {
            logger.warn(
                { correlationId: req.correlationId || '', workspaceId, customerId, action: 'READ_CUSTOMER_CACHE_FAILED' },
                'Lỗi đọc cache customer, fallback query DB',
                cacheErr
            );
        }

        if (!customer) {
            customer = await prisma.customer.findFirst({
                where: {
                    id: customerId,
                    accountId: workspaceId
                }
            });

            if (customer) {
                try {
                    await redis.set(cacheKey, JSON.stringify(customer), 'EX', 300); // TTL 5 phút (300 giây)
                } catch (cacheErr) {
                    logger.warn(
                        { correlationId: req.correlationId || '', workspaceId, customerId, action: 'WRITE_CUSTOMER_CACHE_FAILED' },
                        'Lỗi ghi cache customer',
                        cacheErr
                    );
                }
            }
        }

        if (!customer) {
            return res.status(403).json({
                success: false,
                error: 'FORBIDDEN_CUSTOMER',
                message: 'Quyền truy cập bị từ chối: Khách hàng không thuộc không gian làm việc này'
            });
        }

        // Đính kèm bản ghi customer đã xác thực vào request
        req.customer = customer;
        next();
    } catch (error) {
        logger.error(
            { correlationId: req.correlationId || '', workspaceId: req.workspaceId || '', action: 'VERIFY_CUSTOMER_OWNERSHIP_FAILED' },
            'Lỗi hệ thống khi xác thực quyền sở hữu khách hàng',
            error
        );
        res.status(500).json({
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: 'Lỗi hệ thống khi xác thực quyền sở hữu khách hàng'
        });
    }
};
