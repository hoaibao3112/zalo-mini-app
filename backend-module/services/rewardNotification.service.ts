import prisma from '../../../lib/prisma.js';
import { ZaloApiClient } from '../../../lib/zaloApi.js';
import redis from '../../../lib/redis.js';

// Hằng số cấu hình
const IDEMPOTENCY_KEY_TTL_SECONDS = 86400; // 24 giờ — sau đó cho phép gửi lại nếu thực sự cần
const MAX_RETRY_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 500; // Backoff bắt đầu từ 500ms, x2 mỗi lần

interface WonPrize {
    name: string;
    rewardType: string;
    value?: number | string | null;
}

/**
 * Xây dựng nội dung tin nhắn OA dựa trên loại giải thưởng.
 * Tách riêng để dễ unit test độc lập không cần DB/Zalo.
 */
export function buildRewardMessage(
    wonPrize: WonPrize,
    gameName: string,
    voucherCode: string | null
): string {
    if (wonPrize.rewardType === 'VOUCHER' && voucherCode) {
        return (
            `Chúc mừng bạn đã trúng quà tặng "${wonPrize.name}" từ chương trình "${gameName}"!\n` +
            `Mã voucher của bạn là: ${voucherCode}\n` +
            `Hãy sử dụng ngay nhé!`
        );
    }

    if (wonPrize.rewardType === 'POINT' && wonPrize.value) {
        return `Chúc mừng bạn đã nhận được +${wonPrize.value} điểm thưởng từ chương trình "${gameName}"!`;
    }

    if (
        wonPrize.rewardType === 'PHYSICAL_ITEM' ||
        wonPrize.rewardType === 'NHANH_PRODUCT' ||
        wonPrize.rewardType === 'HARAVAN_PRODUCT'
    ) {
        return (
            `Chúc mừng bạn đã trúng giải thưởng "${wonPrize.name}" từ chương trình "${gameName}"!\n` +
            `Vui lòng cập nhật SĐT và địa chỉ nhận hàng để chúng tôi giao quà cho bạn sớm nhất nhé.`
        );
    }

    return `Chúc mừng bạn đã trúng thưởng "${wonPrize.name}" từ chương trình "${gameName}"!`;
}

/**
 * Thực hiện gọi API Zalo với retry và exponential backoff.
 * @param fn - Hàm async cần retry
 * @param maxAttempts - Số lần thử tối đa
 * @param baseDelayMs - Thời gian chờ ban đầu (ms)
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = MAX_RETRY_ATTEMPTS,
    baseDelayMs: number = BASE_RETRY_DELAY_MS
): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < maxAttempts) {
                const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }
    throw lastError;
}

export const rewardNotificationService = {
    /**
     * Gửi tin nhắn OA thông báo trúng thưởng cho người dùng.
     *
     * Đảm bảo Idempotent: mỗi rewardId chỉ gửi tin nhắn đúng 1 lần trong 24h
     * bằng cơ chế Redis SET NX (chống gửi trùng lặp khi retry từ upstream).
     *
     * @param rewardId  - ID phần thưởng (dùng làm idempotency key)
     * @param customerId - ID khách hàng CRM
     * @param workspaceId - ID doanh nghiệp
     * @param wonPrize  - Object giải thưởng trúng tuyển
     * @param voucherCode - Mã voucher nếu có
     * @param gameName  - Tên trò chơi
     */
    async send(
        rewardId: string,
        customerId: string,
        workspaceId: string,
        wonPrize: WonPrize,
        voucherCode: string | null,
        gameName: string
    ): Promise<void> {
        // 1. Kiểm tra idempotency key — chỉ gửi 1 lần/24h mỗi reward
        const idempotencyKey = `zalo_mini_app:notif_sent:${rewardId}`;
        try {
            const wasAlreadySent = await redis.set(idempotencyKey, '1', 'EX', IDEMPOTENCY_KEY_TTL_SECONDS, 'NX');
            if (wasAlreadySent === null) {
                // Key đã tồn tại → đã gửi trước đó → bỏ qua
                console.log(`[RewardNotification] Bỏ qua — rewardId ${rewardId} đã được gửi thông báo trước đó.`);
                return;
            }
        } catch (redisErr: any) {
            // Redis lỗi → cho phép gửi tiếp (fail-open), tránh chặn người dùng
            console.error('[RewardNotification] Không thể kiểm tra idempotency key Redis:', redisErr.message);
        }

        try {
            // 2. Lấy thông tin customer và OA từ DB
            const [customerObj, activeOA] = await Promise.all([
                prisma.customer.findUnique({ where: { id: customerId } }),
                prisma.zaloOA.findFirst({ where: { accountId: workspaceId, isActive: true } }),
            ]);

            const targetZaloUserId = customerObj?.zaloOaId || customerObj?.zaloId;

            if (!activeOA || !targetZaloUserId) {
                console.warn(
                    `[RewardNotification] Bỏ qua — không tìm thấy OA hoặc Zalo User ID cho customerId ${customerId}`
                );
                return;
            }

            // 3. Khởi tạo Zalo API client
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
                        },
                    });
                },
            });

            // 4. Xây dựng nội dung tin nhắn
            const msgText = buildRewardMessage(wonPrize, gameName, voucherCode);

            // 5. Gửi với retry exponential backoff
            await withRetry(() => client.sendText(targetZaloUserId, msgText));

            console.log(`[RewardNotification] Đã gửi thông báo trúng thưởng tới ${targetZaloUserId}`);
        } catch (error: any) {
            // Gửi thất bại sau retry → xóa idempotency key để cho phép thử lại sau
            try {
                await redis.del(idempotencyKey);
            } catch {
                // Ignore — Redis có thể offline
            }
            console.error('[RewardNotification] Gửi thông báo trúng thưởng thất bại sau tất cả retry:', error.message);
        }
    }
};

