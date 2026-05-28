import prisma from '../lib/prisma.js';
import { Customer, Prisma } from '@prisma/client';
import { logger } from '../lib/logger.js';
import crypto from 'crypto';

export interface IMergeResult {
    merged: boolean;
    primaryCustomer?: Customer;
    error?: 'MERGE_TIMEOUT';
}

export const customerMergeService = {
    /**
     * Hợp nhất tài khoản tạm thời (Anonymous) vào tài khoản chính (đã đăng ký SĐT trước đó)
     * @param anonymousCustomerId ID tài khoản tạm thời cần xóa sau khi gộp
     * @param phoneNumber Số điện thoại đăng nhập để tìm tài khoản chính
     * @param workspaceId ID doanh nghiệp (accountId)
     * @param correlationId correlationId tùy chọn để bám vết logs
     */
    async merge(
        anonymousCustomerId: string,
        phoneNumber: string,
        workspaceId: string,
        correlationId?: string
    ): Promise<IMergeResult> {
        const traceId = correlationId || crypto.randomUUID();

        // Tìm tài khoản chính có cùng số điện thoại (scoped by workspaceId)
        const primaryCustomer = await prisma.customer.findFirst({
            where: {
                accountId: workspaceId,
                phone: phoneNumber,
                id: { not: anonymousCustomerId }
            }
        });

        if (!primaryCustomer) {
            return { merged: false };
        }

        logger.info(
            {
                correlationId: traceId,
                workspaceId,
                action: 'CUSTOMER_MERGE'
            },
            `[MergeService] Bắt đầu gộp tài khoản tạm ${anonymousCustomerId} vào tài khoản chính ${primaryCustomer.id} (SĐT: ${phoneNumber})`
        );

        try {
            // Hợp nhất dữ liệu bằng Prisma Interactive Transaction để bảo đảm ACID tuyệt đối với timeout và isolation level Serializable
            await prisma.$transaction(async (tx) => {
                // 1. Gộp PlayCredit (SpinCredit) toàn cục
                const anonCredit = await tx.playCredit.findUnique({
                    where: { customerId: anonymousCustomerId }
                });
                if (anonCredit) {
                    const primCredit = await tx.playCredit.findUnique({
                        where: { customerId: primaryCustomer.id }
                    });
                    if (primCredit) {
                        // Cộng dồn dữ liệu vào Primary
                        await tx.playCredit.update({
                            where: { customerId: primaryCustomer.id },
                            data: {
                                balance: primCredit.balance + anonCredit.balance,
                                totalEarned: primCredit.totalEarned + anonCredit.totalEarned,
                                totalUsed: primCredit.totalUsed + anonCredit.totalUsed,
                            }
                        });
                        // Xóa bản ghi cũ của Anonymous
                        await tx.playCredit.delete({
                            where: { id: anonCredit.id }
                        });
                    } else {
                        // Cập nhật customerId từ Anonymous sang Primary
                        await tx.playCredit.update({
                            where: { id: anonCredit.id },
                            data: { customerId: primaryCustomer.id }
                        });
                    }
                }

                // 2. Chuyển đơn hàng (Order)
                await tx.order.updateMany({
                    where: { customerId: anonymousCustomerId },
                    data: { customerId: primaryCustomer.id }
                });

                // 3. Chuyển lịch sử quay game (PlayHistory)
                await tx.playHistory.updateMany({
                    where: { customerId: anonymousCustomerId },
                    data: { customerId: primaryCustomer.id }
                });

                // 4. Chuyển phần thưởng đã trúng (PlayReward)
                await tx.playReward.updateMany({
                    where: { customerId: anonymousCustomerId },
                    data: { customerId: primaryCustomer.id }
                });

                // 5. Chuyển game sessions (GameSession)
                await tx.gameSession.updateMany({
                    where: { customerId: anonymousCustomerId },
                    data: { customerId: primaryCustomer.id }
                });

                // 6. Chuyển logs điểm thưởng (PlayCreditLog)
                await tx.playCreditLog.updateMany({
                    where: { customerId: anonymousCustomerId },
                    data: { customerId: primaryCustomer.id }
                });

                // 7. Gộp lượt quay per-game (GamePlayerCredit)
                const anonymousGameCredits = await tx.gamePlayerCredit.findMany({
                    where: { customerId: anonymousCustomerId }
                });

                for (const cred of anonymousGameCredits) {
                    const primGameCredit = await tx.gamePlayerCredit.findUnique({
                        where: {
                            customerId_gameId: {
                                customerId: primaryCustomer.id,
                                gameId: cred.gameId
                            }
                        }
                    });

                    if (primGameCredit) {
                        // Cộng dồn và xóa của Anonymous
                        await tx.gamePlayerCredit.update({
                            where: { id: primGameCredit.id },
                            data: {
                                balance: primGameCredit.balance + cred.balance,
                                totalEarned: primGameCredit.totalEarned + cred.totalEarned,
                                totalUsed: primGameCredit.totalUsed + cred.totalUsed,
                            }
                        });
                        await tx.gamePlayerCredit.delete({
                            where: { id: cred.id }
                        });
                    } else {
                        // Cập nhật customerId từ Anonymous sang Primary
                        await tx.gamePlayerCredit.update({
                            where: { id: cred.id },
                            data: { customerId: primaryCustomer.id }
                        });
                    }
                }

                // 8. Chuyển Zalo ID, Zalo OA ID từ tài khoản tạm sang tài khoản chính nếu tài khoản chính chưa có
                const updateData: any = {};
                const anonCustomer = await tx.customer.findUnique({
                    where: { id: anonymousCustomerId }
                });
                if (anonCustomer) {
                    if (anonCustomer.zaloId && !primaryCustomer.zaloId) {
                        updateData.zaloId = anonCustomer.zaloId;
                    }
                    if (anonCustomer.zaloOaId && !primaryCustomer.zaloOaId) {
                        updateData.zaloOaId = anonCustomer.zaloOaId;
                    }
                    if (anonCustomer.avatar && !primaryCustomer.avatar) {
                        updateData.avatar = anonCustomer.avatar;
                    }
                    if (Object.keys(updateData).length > 0) {
                        await tx.customer.update({
                            where: { id: primaryCustomer.id },
                            data: updateData
                        });
                    }
                }

                // 9. Xóa tài khoản tạm (Anonymous Customer) sau khi đã chuyển toàn bộ dữ liệu an toàn
                await tx.customer.delete({
                    where: { id: anonymousCustomerId }
                });
            }, {
                maxWait: 5000,
                timeout: 15000,
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable
            });
        } catch (error: any) {
            // Prisma timeout error code là P2028. P2034 đại diện cho write conflicts / deadlocks
            if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2028' || error.code === 'P2034' || error.message.includes('timeout') || error.message.includes('deadlock'))) {
                logger.warn(
                    {
                        correlationId: traceId,
                        workspaceId,
                        action: 'CUSTOMER_MERGE'
                    },
                    `Prisma transaction timeout/deadlock during customer merge: ${error.message}`,
                    error
                );
                return { merged: false, error: 'MERGE_TIMEOUT' };
            }
            
            logger.error(
                {
                    correlationId: traceId,
                    workspaceId,
                    action: 'CUSTOMER_MERGE'
                },
                `Lỗi gộp tài khoản: ${error.message}`,
                error
            );
            throw error;
        }

        // Tìm lại primaryCustomer mới nhất kèm theo update nếu có
        const updatedPrimaryCustomer = await prisma.customer.findUnique({
            where: { id: primaryCustomer.id }
        });

        return {
            merged: true,
            primaryCustomer: updatedPrimaryCustomer || primaryCustomer
        };
    }
};
