import { z } from 'zod';

/**
 * Schema xác thực API thực hiện quay thưởng Spin
 */
export const spinGameSchema = z.object({});

/**
 * Schema xác thực API cộng lượt chơi nhiệm vụ
 */
export const addCreditsSchema = z.object({
    type: z.enum(['FIRST_LOGIN', 'FOLLOW_OA', 'DAILY_CHECKIN']),
    reference: z.string().optional().nullable()
});
