import prisma from './prisma.js';

/**
 * Chọn phần thưởng ngẫu nhiên theo xác suất, bỏ qua prize đã hết số lượng
 */
export async function selectPrize(prizes: any[]) {
    if (!prizes || prizes.length === 0) {
        return { error: 'NO_CONFIG', message: 'Game chưa được cấu hình phần thưởng. Vui lòng liên hệ admin.' };
    }

    const validInfos = prizes.map((p, i) => {
        const isOutOfStock = p.maxQuantity !== null && p.maxQuantity !== undefined && p.quantityUsed >= p.maxQuantity;
        return {
            prize: p,
            arrayIndex: i,
            isOutOfStock,
            prob: Number(p.probability || 0)
        };
    });

    const availablePrizes = validInfos.filter(info => !info.isOutOfStock);

    if (availablePrizes.length === 0) {
        return { error: 'OUT_OF_STOCK', message: 'Tất cả phần quà hiện đã được trao hết. Hẹn bạn dịp khác nhé!' };
    }

    if (availablePrizes.length === 1) {
        const won = availablePrizes[0];
        const visualIndex = won.prize.slotIndex ? (won.prize.slotIndex - 1) : won.arrayIndex;
        return { prize: won.prize, index: visualIndex };
    }

    const totalProbability = availablePrizes.reduce((sum, p) => sum + p.prob, 0);

    if (totalProbability <= 0) {
        const randomIndex = Math.floor(Math.random() * availablePrizes.length);
        const won = availablePrizes[randomIndex];
        const visualIndex = won.prize.slotIndex ? (won.prize.slotIndex - 1) : won.arrayIndex;
        return { prize: won.prize, index: visualIndex };
    }

    const random = Math.random() * totalProbability;
    let cumulative = 0;

    for (const p of availablePrizes) {
        cumulative += p.prob;
        if (random <= cumulative && p.prob > 0) {
            const visualIndex = p.prize.slotIndex ? (p.prize.slotIndex - 1) : p.arrayIndex;
            return { prize: p.prize, index: visualIndex };
        }
    }
    
    const validPrizes = availablePrizes.filter(p => p.prob > 0);
    const last = validPrizes.length > 0 ? validPrizes[validPrizes.length - 1] : availablePrizes[availablePrizes.length - 1];
    const visualIndex = last.prize.slotIndex ? (last.prize.slotIndex - 1) : last.arrayIndex;
    return { prize: last.prize, index: visualIndex };
}

/**
 * Lấy 1 voucher chưa phát cho prize, dùng transaction để tránh duplicate
 */
export async function assignVoucher(prizeId: string, playRewardId: string): Promise<string | null> {
    return await prisma.$transaction(async (tx) => {
        const voucher = await tx.gameVoucher.findFirst({
            where: { prizeId, isDistributed: false },
            orderBy: { createdAt: 'asc' }
        });
        if (!voucher) return null;

        await tx.gameVoucher.update({
            where: { id: voucher.id },
            data: {
                isDistributed: true,
                distributedAt: new Date(),
                playRewardId
            }
        });
        return voucher.code;
    });
}

/**
 * Lấy hoặc khởi tạo GamePlayerCredit. Tự cộng daily bonus nếu ngày mới
 */
export async function getOrInitPlayerCredit(customerId: string, game: any) {
    const startBalance = Number(game.initialSpins) || 1;
    let credit = await prisma.gamePlayerCredit.upsert({
        where: { customerId_gameId: { customerId, gameId: game.id } },
        update: {},
        create: {
            customerId,
            gameId: game.id,
            balance: startBalance,
            totalEarned: startBalance,
            lastDailyBonusAt: new Date()
        }
    });

    if (game.dailyBonus > 0) {
        const now = new Date();
        const vnTimeOffset = 7 * 60 * 60 * 1000;
        const nowVnStr = new Date(now.getTime() + vnTimeOffset).toISOString().slice(0, 10);

        let isNewDay = true;
        if (credit.lastDailyBonusAt) {
            const lastBonusVnStr = new Date(credit.lastDailyBonusAt.getTime() + vnTimeOffset).toISOString().slice(0, 10);
            isNewDay = lastBonusVnStr < nowVnStr;
        }

        if (isNewDay) {
            const newBalance = game.dailyBonusAccumulates
                ? credit.balance + game.dailyBonus
                : Math.max(credit.balance, game.dailyBonus);

            const cappedBalance = game.maxTotalSpins !== null
                ? Math.min(newBalance, game.maxTotalSpins)
                : newBalance;

            credit = await prisma.gamePlayerCredit.update({
                where: { id: credit.id },
                data: {
                    balance: cappedBalance,
                    totalEarned: { increment: game.dailyBonus },
                    lastDailyBonusAt: now
                }
            });
        }
    }

    return credit;
}

/**
 * Chỉ đọc balance hiện tại
 */
export async function getPlayerCreditBalance(customerId: string, game: any): Promise<number> {
    const credit = await prisma.gamePlayerCredit.findUnique({
        where: { customerId_gameId: { customerId, gameId: game.id } }
    });
    if (!credit) return game.initialSpins ?? 1;
    return credit.balance;
}

/**
 * Lưu kết quả spin và xử lý prize theo type (VOUCHER / POINT / PHYSICAL_ITEM / TEXT)
 */
export async function processPrizeResult(params: {
    customerId: string;
    gameId: string;
    selectedPrize: any;
    sendZaloMessage?: (customerId: string, message: string) => Promise<void>;
}) {
    const { customerId, gameId, selectedPrize, sendZaloMessage } = params;
    const isPhysical = selectedPrize.rewardType === 'PHYSICAL_ITEM' || selectedPrize.rewardType === 'NHANH_PRODUCT' || selectedPrize.rewardType === 'HARAVAN_PRODUCT';

    let reward;
    try {
        reward = await prisma.playReward.create({
            data: {
                customerId,
                gameId,
                prizeId: selectedPrize.id,
                prizeName: selectedPrize.name,
                prizeValue: selectedPrize.value ?? null,
                status: 'PENDING',
                requiresCollection: isPhysical,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000)
            }
        });
    } catch (e: any) {
        console.error('[processPrizeResult] Failed to create PlayReward:', e?.message);
        throw e;
    }

    let voucherCode: string | null = null;

    if (selectedPrize.rewardType === 'VOUCHER') {
        voucherCode = await assignVoucher(selectedPrize.id, reward.id);
        if (voucherCode) {
            await prisma.playReward.update({
                where: { id: reward.id },
                data: { voucherCode }
            });
        }
    } else if (selectedPrize.rewardType === 'POINT' && selectedPrize.value) {
        const points = parseInt(selectedPrize.value) || 0;
        if (points > 0) {
            await prisma.playCredit.upsert({
                where: { customerId },
                create: { customerId, balance: points, totalEarned: points, totalUsed: 0 },
                update: { balance: { increment: points }, totalEarned: { increment: points } }
            });
            await prisma.playCreditLog.create({
                data: { customerId, amount: points, type: 'PRIZE_POINT', reference: reward.id }
            });
        }
    }

    if (selectedPrize.tagId) {
        try {
            const tagAction = selectedPrize.tagAction || 'ADD';
            await prisma.customer.update({
                where: { id: customerId },
                data: {
                    tags: tagAction === 'REMOVE' 
                        ? { disconnect: { id: selectedPrize.tagId } }
                        : { connect: { id: selectedPrize.tagId } }
                }
            });
        } catch (tagErr: any) {
            console.error('[processPrizeResult] Tagging error:', tagErr?.message);
        }
    }

    if (isPhysical && sendZaloMessage) {
        try {
            await sendZaloMessage(customerId,
                `Chúc mừng bạn đã trúng "${selectedPrize.name}"! ` +
                `Vui lòng nhắn lại SĐT và địa chỉ nhận hàng để chúng tôi giao quà cho bạn.`
            );
        } catch (e) {
            console.error('[Games] Failed to send physical prize message:', e);
        }
    }

    try {
        await prisma.gamePrize.update({
            where: { id: selectedPrize.id },
            data: { quantityUsed: { increment: 1 } }
        });
    } catch (e: any) {
        console.error('[Games] quantityUsed increment failed:', e?.message);
    }

    return { rewardId: reward.id, voucherCode };
}
