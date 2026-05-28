import prisma from '../lib/prisma.js';
import { getOrInitPlayerCredit, selectPrize, processPrizeResult } from '../lib/games.js';

export interface ISpinResult {
    prize: any;
    prizeIndex: number;
    rewardId: string | null;
    voucherCode: string | null;
    remainingSpins: number;
}

export const spinGameService = {
    /**
     * Thực hiện quay thưởng vòng quay may mắn
     * @param customerId ID khách hàng CRM
     * @param gameId ID trò chơi
     * @param workspaceId ID doanh nghiệp (accountId)
     */
    async spin(
        customerId: string,
        gameId: string,
        workspaceId: string
    ): Promise<ISpinResult> {
        const game = await prisma.game.findFirst({
            where: { id: gameId, accountId: workspaceId, isActive: true },
            include: { prizes: true }
        });

        if (!game) {
            throw new Error('GAME_NOT_FOUND');
        }

        const credit = await getOrInitPlayerCredit(customerId, game);
        if (!credit || credit.balance <= 0) {
            throw new Error('OUT_OF_SPINS');
        }

        // Chọn phần thưởng (có kiểm tra inventory)
        const selectResult = await selectPrize(game.prizes);
        if (!selectResult || selectResult.error) {
            throw new Error(selectResult?.error || 'NO_AVAILABLE_PRIZES');
        }

        const wonPrize = selectResult.prize;
        const wonIndex = selectResult.index;

        // Trừ lượt + ghi lịch sử quay nguyên tử (Atomic transaction)
        try {
            await prisma.$transaction(async (tx) => {
                // 1. Trừ lượt nguyên tử có check balance > 0 chống Spin Hack/Race Condition
                const updatedCredit = await tx.gamePlayerCredit.updateMany({
                    where: { id: credit.id, balance: { gt: 0 } },
                    data: { balance: { decrement: 1 }, totalUsed: { increment: 1 } }
                });

                if (updatedCredit.count === 0) {
                    throw new Error('HẾT_LƯỢT_CHƠI');
                }

                // 2. Ghi lịch sử quay
                await tx.playHistory.create({
                    data: {
                        gameId: game.id,
                        customerId,
                        prize: wonPrize.name
                    }
                });
            });
        } catch (dbErr: any) {
            if (dbErr.message === 'HẾT_LƯỢT_CHƠI') {
                throw new Error('OUT_OF_SPINS');
            }
            throw dbErr;
        }

        // Xử lý logic cấp phần thưởng (voucher, points, v.v.)
        let rewardId: string | null = null;
        let voucherCode: string | null = null;
        try {
            const rewardRes = await processPrizeResult({
                customerId,
                gameId: game.id,
                selectedPrize: wonPrize
            });
            rewardId = rewardRes.rewardId;
            voucherCode = rewardRes.voucherCode;
        } catch (prizeErr: any) {
            console.error('[SpinGameService] Lỗi xử lý cấp phần thưởng:', prizeErr.message);
        }

        return {
            prize: wonPrize,
            prizeIndex: wonIndex ?? 0,
            rewardId,
            voucherCode,
            remainingSpins: credit.balance - 1
        };
    }
};
