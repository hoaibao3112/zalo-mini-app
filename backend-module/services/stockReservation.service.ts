import { reserveStock } from '../../../lib/stockManager.js';

export interface IStockReservationResult {
    id: string;
    expiresAt: Date;
}

export const stockReservationService = {
    /**
     * Khóa kho sản phẩm tạm thời trong checkout
     * @param productId ID sản phẩm local
     * @param workspaceId ID doanh nghiệp (accountId)
     * @param quantity Số lượng muốn khóa
     */
    async reserve(
        productId: string,
        workspaceId: string,
        quantity: number
    ): Promise<IStockReservationResult> {
        try {
            const reservation = await reserveStock(productId, workspaceId, quantity);
            return {
                id: reservation.id,
                expiresAt: reservation.expiresAt
            };
        } catch (error: any) {
            console.error('[StockReservationService] Lỗi đặt kho:', error.message);
            throw error; // Ném lỗi để route handler catch
        }
    }
};
