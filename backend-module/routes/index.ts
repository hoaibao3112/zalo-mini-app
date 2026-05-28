import { Router } from 'express';
import authRoutes from './auth.routes.js';
import gameRoutes from './game.routes.js';
import ecommerceRoutes from './ecommerce.routes.js';
import { miniappRateLimit } from '../middlewares/miniappRateLimit.js';

import { verifyZaloToken } from '../middlewares/verifyZaloToken.js';

const router = Router();

// Áp dụng Rate Limiting chung để bảo vệ toàn bộ APIs Mini App
router.use(miniappRateLimit as any);

// Áp dụng verifyZaloToken middleware cho các routes nhạy cảm
router.post('/spin-games/:id/spin', verifyZaloToken as any);
router.post('/spin-credits/add', verifyZaloToken as any);
router.get('/spin-credits/:customerId/history', verifyZaloToken as any);
router.get('/spin-rewards/:customerId', verifyZaloToken as any);
router.put('/spin-rewards/:id/use', verifyZaloToken as any);
router.post('/customers/phone/update', verifyZaloToken as any);
router.post('/products/:id/reserve', verifyZaloToken as any);
router.post('/orders', verifyZaloToken as any);
router.get('/orders/customer/:customerId', verifyZaloToken as any);

// Định tuyến các phân hệ nghiệp vụ con
router.use('/', authRoutes);
router.use('/', gameRoutes);
router.use('/', ecommerceRoutes);

export default router;
