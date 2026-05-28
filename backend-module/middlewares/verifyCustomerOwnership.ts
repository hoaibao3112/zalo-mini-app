import { Response, NextFunction } from 'express';
import { MiniappRequest } from '../types';
import prisma from '../../../lib/prisma.js';

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

        const customer = await prisma.customer.findFirst({
            where: {
                id: customerId,
                accountId: workspaceId
            }
        });

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
        console.error('[verifyCustomerOwnership] Lỗi xác thực quyền sở hữu:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: 'Lỗi hệ thống khi xác thực quyền sở hữu khách hàng'
        });
    }
};
