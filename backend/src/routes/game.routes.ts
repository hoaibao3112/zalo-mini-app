import { Router, Response } from 'express';
import { MiniappRequest } from '../types.js';
import prisma from '../lib/prisma.js';
import { successResponse, errorResponse } from '../lib/response.helper.js';
import { verifyCustomerOwnership } from '../middlewares/verifyCustomerOwnership.js';
import { spinGameSchema, addCreditsSchema } from '../validators/game.validator.js';
import { spinGameService } from '../services/spinGame.service.js';
import { rewardNotificationService } from '../services/rewardNotification.service.js';
import { getPlayerCreditBalance } from '../lib/games.js';
import { ZodError } from 'zod';
import redis from '../lib/redis.js';
import { parseCursorPagination, buildCursorResponse } from '../lib/pagination.js';

const router = Router();

/**
 * Helper Single Flight Caching chống Cache Stampede
 */
async function getWithSingleFlight<T>(
    cacheKey: string,
    lockKey: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 30 // Giảm xuống 30 giây để dev thấy ngay kết quả
): Promise<T> {
    try {
        // 1. Thử lấy từ Redis Cache trước
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            return JSON.parse(cachedData);
        }

        // 2. Miss cache: Thử acquire lock (SET lockKey locked NX EX 10)
        const acquired = await redis.set(lockKey, 'locked', 'EX', 10, 'NX');
        
        if (acquired === 'OK') {
            try {
                // Đóng vai trò là request "đại diện" đi query DB
                const data = await fetcher();
                // Lưu vào cache
                await redis.setex(cacheKey, ttlSeconds, JSON.stringify(data));
                return data;
            } finally {
                // Giải phóng lock
                await redis.del(lockKey);
            }
        } else {
            // Không lấy được lock: Đợi 100ms rồi thử đọc lại từ Cache 1 lần nữa (kẻ có lock đang fetch dữ liệu)
            await new Promise((resolve) => setTimeout(resolve, 100));
            const retriedData = await redis.get(cacheKey);
            if (retriedData) {
                return JSON.parse(retriedData);
            }
            
            // Fallback cuối cùng: Nếu vẫn miss cache sau khi retry, gọi fetcher trực tiếp để không block người dùng quá lâu
            return await fetcher();
        }
    } catch (error) {
        // Fail-safe: Nếu gặp lỗi Redis, chạy trực tiếp fetcher từ DB
        console.error('[SingleFlight] Lỗi Redis, chạy fallback DB fetcher:', error);
        return await fetcher();
    }
}

/**
 * GET /spin-games/active
 * Tải game vòng quay đang hoạt động
 */
router.get('/spin-games/active', async (req: MiniappRequest, res: Response) => {
    try {
        const type = req.query.type as string;
        const workspaceId = req.workspaceId!;
        const cacheKey = `zalo_mini_app:active_game:${workspaceId}:${type || 'default'}`;
        const lockKey = `lock:active_game:${workspaceId}:${type || 'default'}`;

        const fetcher = async () => {
            const where: any = { accountId: workspaceId, isActive: true };
            if (type) where.gameType = type;

            const game = await prisma.game.findFirst({
                where,
                include: {
                    prizes: {
                        select: {
                            id: true, name: true, probability: true,
                            rewardType: true, imageUrl: true, color: true,
                            maxQuantity: true, quantityUsed: true
                        }
                    }
                }
            });
            
            if (!game) {
                throw new Error('GAME_NOT_FOUND');
            }
            return game;
        };

        const game = await getWithSingleFlight(cacheKey, lockKey, fetcher, 30); // 30s cache cho game active

        // Tăng lượt view game bất đồng bộ ngầm
        prisma.game.update({
            where: { id: game.id },
            data: { views: { increment: 1 } }
        }).catch(err => console.error('[ActiveGameCache] Lỗi tăng views ngầm:', err.message));

        return res.json(successResponse(game));
    } catch (error: any) {
        if (error.message === 'GAME_NOT_FOUND') {
            return res.status(404).json(errorResponse('GAME_NOT_FOUND', 'Cửa hàng chưa mở chương trình vòng quay'));
        }
        console.error('[MiniappGame] Lỗi khi tải game active:', error);
        return res.status(500).json(errorResponse('LOAD_GAME_FAILED', 'Lỗi khi tải thông tin chương trình'));
    }
});

/**
 * GET /spin-games/:id
 * Tải chi tiết game theo ID
 */
router.get('/spin-games/:id', async (req: MiniappRequest, res: Response) => {
    try {
        const game = await prisma.game.findFirst({
            where: { id: req.params.id, accountId: req.workspaceId! },
            include: {
                prizes: {
                    select: {
                        id: true, name: true, probability: true,
                        rewardType: true, imageUrl: true, color: true,
                        maxQuantity: true, quantityUsed: true
                    }
                }
            }
        });
        if (!game) return res.status(404).json(errorResponse('GAME_NOT_FOUND', 'Game không tồn tại hoặc đã bị ẩn'));

        // Tăng lượt view game
        await prisma.game.update({
            where: { id: game.id },
            data: { views: { increment: 1 } }
        });

        return res.json(successResponse(game));
    } catch (error) {
        return res.status(500).json(errorResponse('LOAD_GAME_FAILED', 'Lỗi khi tải thông tin game'));
    }
});

/**
 * POST /spin-games/:id/spin
 * Thực hiện quay thưởng an toàn và chống race condition
 */
router.post('/spin-games/:id/spin', async (req: MiniappRequest, res: Response) => {
    try {
        // Validate dữ liệu đầu vào bằng Zod
        const validatedBody = spinGameSchema.parse(req.body);
        const customerId = req.customer!.id;
        const gameId = req.params.id;

        // Gọi service spin an toàn
        const spinResult = await spinGameService.spin(customerId, gameId, req.workspaceId!);

        // Gửi tin nhắn OA chúc mừng trúng thưởng (Không block response)
        if (spinResult.rewardId) {
            rewardNotificationService.send(
                spinResult.rewardId,
                customerId,
                req.workspaceId!,
                spinResult.prize,
                spinResult.voucherCode,
                'Vòng quay may mắn'
            ).catch(err => console.error('[SpinGameRouter] Lỗi gửi thông báo trúng thưởng:', err.message));
        }

        return res.json(successResponse(spinResult, 'Quay thưởng thành công'));
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json(errorResponse('VALIDATION_ERROR', error.issues[0]?.message));
        }
        if (error.message === 'GAME_NOT_FOUND') {
            return res.status(404).json(errorResponse('GAME_NOT_FOUND', 'Game không tồn tại hoặc đã bị ẩn'));
        }
        if (error.message === 'OUT_OF_SPINS') {
            return res.status(400).json(errorResponse('OUT_OF_SPINS', 'Bạn đã hết lượt chơi hôm nay'));
        }
        console.error('[MiniappGame] Lỗi spin game:', error.message);
        return res.status(500).json(errorResponse('SPIN_FAILED', 'Hệ thống bận, vui lòng thử lại sau'));
    }
});

/**
 * GET /spin-games/:id/player-credits/:customerId
 * Lấy số lượt chơi per-game hiện tại của người dùng
 */
router.get('/spin-games/:id/player-credits/:customerId', async (req: MiniappRequest, res: Response) => {
    try {
        const game = await prisma.game.findFirst({
            where: { id: req.params.id, accountId: req.workspaceId! }
        });
        if (!game) return res.status(404).json(errorResponse('GAME_NOT_FOUND', 'Game không tồn tại'));

        const balance = await getPlayerCreditBalance(req.params.customerId, game);
        return res.json(successResponse({
            balance,
            gameId: game.id,
            customerId: req.params.customerId
        }));
    } catch (error) {
        return res.status(500).json(errorResponse('LOAD_CREDIT_FAILED', 'Lỗi khi tải lượt chơi game'));
    }
});

/**
 * GET /spin-credits/:customerId
 * Lấy tổng số điểm thưởng/lượt chơi toàn cục (Global credits)
 */
router.get('/spin-credits/:customerId', async (req: MiniappRequest, res: Response) => {
    try {
        let credit = await prisma.playCredit.findUnique({
            where: { customerId: req.params.customerId },
        });
        if (!credit) {
            credit = await prisma.playCredit.create({
                data: { customerId: req.params.customerId },
            });
        }
        return res.json(successResponse(credit));
    } catch (error) {
        return res.status(500).json(errorResponse('LOAD_CREDITS_FAILED', 'Lỗi khi lấy điểm thưởng'));
    }
});

/**
 * POST /spin-credits/add
 * Làm nhiệm vụ tích lũy điểm thưởng/lượt chơi
 */
router.post('/spin-credits/add', async (req: MiniappRequest, res: Response) => {
    try {
        const validatedBody = addCreditsSchema.parse(req.body);
        const { type, reference } = validatedBody;
        const customerId = req.customer!.id;
        const workspaceId = req.workspaceId!;

        // Kiểm tra rule có hoạt động không
        const rule = await prisma.playCreditRule.findFirst({
            where: { accountId: workspaceId, type, isActive: true },
        });
        if (!rule) return res.status(400).json(errorResponse('RULE_UNAVAILABLE', 'Nhiệm vụ này chưa được cấu hình'));

        // Kiểm tra nhận trùng lặp cho FIRST_LOGIN và FOLLOW_OA
        if (type === 'FIRST_LOGIN' || type === 'FOLLOW_OA') {
            const existing = await prisma.playCreditLog.findFirst({
                where: { customerId, type },
            });
            if (existing) return res.status(400).json(errorResponse('CREDIT_ALREADY_RECEIVED', 'Bạn đã nhận lượt quay cho hoạt động này rồi'));
        }

        // DAILY_CHECKIN: chỉ 1 lần/ngày
        if (type === 'DAILY_CHECKIN') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const existing = await prisma.playCreditLog.findFirst({
                where: {
                    customerId,
                    type: 'DAILY_CHECKIN',
                    createdAt: { gte: today },
                },
            });
            if (existing) return res.status(400).json(errorResponse('CHECKIN_ALREADY_DONE', 'Hôm nay bạn đã điểm danh rồi'));
        }

        // Cộng điểm vào global PlayCredit + ghi log
        const txtTasks: any[] = [
            prisma.playCredit.upsert({
                where: { customerId },
                update: {
                    balance: { increment: rule.credits },
                    totalEarned: { increment: rule.credits },
                },
                create: {
                    customerId,
                    balance: rule.credits,
                    totalEarned: rule.credits,
                },
            }),
            prisma.playCreditLog.create({
                data: { customerId, amount: rule.credits, type, reference },
            })
        ];

        // Cộng lượt vào GamePlayerCredit (per-game) nếu có game đang chạy
        let gameToUpdate = null;
        if (reference) {
            gameToUpdate = await prisma.game.findUnique({ where: { id: reference } });
        }
        if (!gameToUpdate) {
            gameToUpdate = await prisma.game.findFirst({
                where: { accountId: workspaceId, isActive: true }
            });
        }

        if (gameToUpdate) {
            const ruleCredits = Number(rule.credits) || 0;
            const gameInitial = Number(gameToUpdate.initialSpins) || 0;

            txtTasks.push(prisma.gamePlayerCredit.upsert({
                where: { customerId_gameId: { customerId, gameId: gameToUpdate.id } },
                create: {
                    customerId,
                    gameId: gameToUpdate.id,
                    balance: gameInitial + ruleCredits,
                    totalEarned: gameInitial + ruleCredits,
                    lastDailyBonusAt: new Date()
                },
                update: {
                    balance: { increment: ruleCredits },
                    totalEarned: { increment: ruleCredits },
                }
            }));
        }

        await prisma.$transaction(txtTasks);

        return res.json(successResponse({ creditsAdded: rule.credits }, `Bạn đã nhận được +${rule.credits} lượt chơi miễn phí`));
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json(errorResponse('VALIDATION_ERROR', error.issues[0]?.message));
        }
        console.error('[MiniappGame] Lỗi cộng lượt chơi:', error);
        return res.status(500).json(errorResponse('ADD_CREDITS_FAILED', 'Lỗi khi ghi nhận điểm thưởng'));
    }
});

/**
 * GET /spin-credits/rules/list
 * Danh sách quy tắc làm nhiệm vụ nhận lượt quay
 */
router.get('/spin-credits/rules/list', async (req: MiniappRequest, res: Response) => {
    try {
        const rules = await prisma.playCreditRule.findMany({
            where: { accountId: req.workspaceId!, isActive: true },
        });
        return res.json(successResponse(rules));
    } catch (error) {
        return res.status(500).json(errorResponse('LOAD_RULES_FAILED', 'Lỗi khi tải danh sách nhiệm vụ'));
    }
});

/**
 * GET /spin-credits/:customerId/history
 * Lịch sử nhận lượt quay của khách hàng (Cursor-based pagination)
 * Query params: ?limit=20&cursor=<lastItemId>
 */
router.get('/spin-credits/:customerId/history', async (req: MiniappRequest, res: Response) => {
    try {
        const { cursor, limit } = parseCursorPagination(req.query as Record<string, unknown>);
        const customerId = req.customer!.id;

        const history = await prisma.playCreditLog.findMany({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
            take: limit + 1, // Lấy thêm 1 item để biết có trang tiếp theo không
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        return res.json(successResponse(buildCursorResponse(history, limit)));
    } catch (error) {
        return res.status(500).json(errorResponse('LOAD_HISTORY_FAILED', 'Lỗi tải lịch sử nhận điểm'));
    }
});

/**
 * GET /spin-rewards/:customerId
 * Kho quà tặng / voucher đã trúng của khách hàng (Cursor-based pagination)
 * Query params: ?limit=20&cursor=<lastItemId>&status=PENDING|USED|EXPIRED
 */
router.get('/spin-rewards/:customerId', async (req: MiniappRequest, res: Response) => {
    try {
        const { status } = req.query;
        const { cursor, limit } = parseCursorPagination(req.query as Record<string, unknown>);
        // Dùng identity đã được verifyZaloToken xác thực, bỏ qua URL param
        const customerId = req.customer!.id;

        const where: Record<string, unknown> = { customerId };
        if (status && typeof status === 'string') where['status'] = status;

        const rewards = await prisma.playReward.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit + 1, // Lấy thêm 1 item để biết có trang tiếp theo không
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            include: { game: { select: { name: true } } },
        });

        return res.json(successResponse(buildCursorResponse(rewards, limit)));
    } catch (error) {
        return res.status(500).json(errorResponse('LOAD_REWARDS_FAILED', 'Lỗi tải danh sách phần thưởng'));
    }
});

/**
 * PUT /spin-rewards/:id/use
 * Sử dụng quà tặng tại cửa hàng (Verify qua Zalo Access Token của chủ sở hữu)
 */
router.put('/spin-rewards/:id/use', verifyCustomerOwnership, async (req: MiniappRequest, res: Response) => {
    try {
        // req.zaloId đã được verifyZaloToken inject — không cần gọi lại Zalo API
        const zaloUserId = req.zaloId!;

        // 1. Tìm reward và kiểm tra quyền sở hữu trước để trả lỗi chi tiết
        const reward = await prisma.playReward.findUnique({
            where: { id: req.params.id },
            include: { customer: true },
        });

        if (!reward || reward.customer?.accountId !== req.workspaceId!) {
            return res.status(404).json(errorResponse('REWARD_NOT_FOUND', 'Không tìm thấy phần thưởng'));
        }

        if (reward.customer?.zaloId !== zaloUserId) {
            return res.status(403).json(errorResponse('FORBIDDEN_USER', 'Bạn không có quyền sử dụng phần thưởng này'));
        }

        if (reward.status !== 'PENDING') {
            return res.status(409).json(errorResponse('REWARD_ALREADY_USED', 'Phần thưởng này đã được sử dụng từ trước'));
        }

        // 2. Chạy atomic updateMany để đảm bảo chỉ có đúng 1 request thành công
        const updateResult = await prisma.playReward.updateMany({
            where: {
                id: req.params.id,
                status: 'PENDING'
            },
            data: {
                status: 'USED',
                usedAt: new Date()
            }
        });

        if (updateResult.count === 0) {
            return res.status(409).json(errorResponse('REWARD_ALREADY_USED', 'Phần thưởng này đã được sử dụng từ trước'));
        }

        // 3. Lấy lại phần thưởng đã được cập nhật thành công để trả về
        const updatedReward = await prisma.playReward.findUnique({
            where: { id: req.params.id }
        });

        return res.json(successResponse(updatedReward, 'Sử dụng phần thưởng thành công'));
    } catch (error) {
        console.error('[MiniappReward] Lỗi khi sử dụng quà:', error);
        return res.status(500).json(errorResponse('REWARD_USE_FAILED', 'Lỗi khi ghi nhận sử dụng phần thưởng'));
    }
});

export default router;
