import prisma from '../lib/prisma.js';
import { ZaloApiClient } from '../lib/zaloApi.js';
import { logger } from '../lib/logger.js';

export const orderNotificationService = {
    /**
     * Gửi tin nhắn Zalo OA ZNS thông báo nước uống đã chuẩn bị xong cho Click & Collect.
     * 
     * @param orderId - ID đơn hàng local hệ thống
     */
    async sendOrderReadyNotification(orderId: string): Promise<boolean> {
        try {
            // Lấy thông tin đơn hàng
            const order = await prisma.order.findUnique({
                where: { id: orderId }
            });
            if (!order) {
                logger.pino.warn({ orderId }, 'Không tìm thấy đơn hàng để gửi thông báo sẵn sàng');
                return false;
            }

            const customerId = order.customerId;
            const workspaceId = order.accountId;

            // Lấy thông tin khách hàng và OA từ DB
            const [customerObj, activeOA] = await Promise.all([
                prisma.customer.findUnique({ where: { id: customerId } }),
                prisma.zaloOA.findFirst({ where: { accountId: workspaceId, isActive: true } }),
            ]);

            const targetZaloUserId = customerObj?.zaloOaId || customerObj?.zaloId;

            if (!activeOA || !targetZaloUserId) {
                logger.pino.warn(
                    { workspaceId, customerId },
                    `Bỏ qua — không tìm thấy OA hoặc Zalo User ID cho customerId ${customerId}`
                );
                return false;
            }

            // Khởi tạo Zalo API client
            const client = new ZaloApiClient({
                encryptedAccessToken: activeOA.accessToken,
                encryptedRefreshToken: activeOA.refreshToken,
                tokenExpiresAt: activeOA.tokenExpiresAt,
                oaId: activeOA.oaId,
                onTokenRefresh: async (tokens) => {
                    await prisma.zaloOA.update({
                        where: { id: activeOA.id },
                        data: {
                            accessToken: tokens.accessToken,
                            refreshToken: tokens.refreshToken,
                            tokenExpiresAt: tokens.expiresAt,
                        }
                    });
                }
            });

            // Ghi nhận món trong đơn
            const parsedItems = JSON.parse(order.items || '[]');
            const itemsList = Array.isArray(parsedItems)
                ? parsedItems.map((it: any) => `${it.name || 'Nước uống'} (x${it.quantity || 1})`).join(', ')
                : '';

            const timeStr = order.pickupTime 
                ? new Date(order.pickupTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) 
                : 'Ngay bây giờ';

            const textMessage = 
                `🎉 Tin vui từ Express Cafe!\n` +
                `Nước uống trong đơn #${order.id.slice(-6).toUpperCase()} của bạn đã chuẩn bị xong!\n` +
                `📋 Chi tiết: ${itemsList}\n` +
                `⏱ Hẹn lấy: ${timeStr}\n` +
                `🚗 Nhận tại xe: ${order.note || 'Không có'}\n\n` +
                `Mời bạn ghé quầy phục vụ số 1 để nhận nước nhé. Chúc bạn thưởng thức ngon miệng! ☕✨`;

            await client.sendText(targetZaloUserId, textMessage);

            logger.pino.info({ orderId }, `Đã gửi tin nhắn OA ZNS báo nước uống sẵn sàng thành công cho khách hàng ${customerId}`);
            return true;
        } catch (error: any) {
            logger.pino.error({ orderId, error: error.message }, 'Lỗi khi gửi tin nhắn OA nước sẵn sàng');
            return false;
        }
    }
};
