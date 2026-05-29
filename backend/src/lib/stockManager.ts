import prisma from './prisma.js';
import { Prisma } from '@prisma/client';

export interface StockReservation {
  id: string;
  productId: string;
  accountId: string;
  quantity: number;
  expiresAt: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function reserveStock(
  productId: string,
  accountId: string,
  quantity: number,
  ttlMinutes = 15
): Promise<any> {
  if (quantity <= 0) {
    throw new Error('QUANTITY_MUST_BE_GREATER_THAN_ZERO');
  }

  return await prisma.$transaction(
    async (tx) => {
      const products: any[] = await tx.$queryRaw`
        SELECT * FROM "Product" 
        WHERE "id" = ${productId} AND "accountId" = ${accountId} 
        FOR UPDATE
      `;

      if (!products || products.length === 0) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      const product = products[0];

      const availableStock = product.stock - product.reservedQuantity;
      if (availableStock < quantity) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      await tx.$executeRaw`
        UPDATE "Product" 
        SET "reservedQuantity" = "reservedQuantity" + ${quantity},
            "updatedAt" = NOW()
        WHERE "id" = ${productId}
      `;

      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      const reservation = await tx.stockReservation.create({
        data: {
          productId,
          accountId,
          quantity,
          expiresAt,
          status: 'PENDING'
        }
      });

      return reservation;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 5000,
    }
  );
}

export async function confirmStockReservation(
  reservationId: string,
  accountId: string,
  txClient?: any
): Promise<void> {
  const executeConfirm = async (tx: any) => {
    const reservation = await tx.stockReservation.findUnique({
      where: { id: reservationId, accountId }
    });

    if (!reservation) {
      throw new Error('RESERVATION_NOT_FOUND');
    }

    if (reservation.status !== 'PENDING') {
      throw new Error(`RESERVATION_ALREADY_${reservation.status}`);
    }

    await tx.stockReservation.update({
      where: { id: reservationId },
      data: { status: 'CONFIRMED' }
    });

    await tx.$queryRaw`
      SELECT * FROM "Product" 
      WHERE "id" = ${reservation.productId} AND "accountId" = ${accountId} 
      FOR UPDATE
    `;

    await tx.$executeRaw`
      UPDATE "Product" 
      SET "stock" = "stock" - ${reservation.quantity},
          "reservedQuantity" = "reservedQuantity" - ${reservation.quantity},
          "updatedAt" = NOW()
      WHERE "id" = ${reservation.productId}
    `;
  };

  if (txClient) {
    await executeConfirm(txClient);
  } else {
    await prisma.$transaction(async (tx) => {
      await executeConfirm(tx);
    });
  }
}

export async function releaseStockReservation(
  reservationId: string,
  accountId: string,
  txClient?: any
): Promise<void> {
  const executeRelease = async (tx: any) => {
    const reservation = await tx.stockReservation.findUnique({
      where: { id: reservationId, accountId }
    });

    if (!reservation) {
      throw new Error('RESERVATION_NOT_FOUND');
    }

    if (reservation.status !== 'PENDING') {
      return;
    }

    await tx.stockReservation.update({
      where: { id: reservationId },
      data: { status: 'RELEASED' }
    });

    await tx.$queryRaw`
      SELECT * FROM "Product" 
      WHERE "id" = ${reservation.productId} AND "accountId" = ${accountId} 
      FOR UPDATE
    `;

    await tx.$executeRaw`
      UPDATE "Product" 
      SET "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${reservation.quantity}),
          "updatedAt" = NOW()
      WHERE "id" = ${reservation.productId}
    `;
  };

  if (txClient) {
    await executeRelease(txClient);
  } else {
    await prisma.$transaction(async (tx) => {
      await executeRelease(tx);
    });
  }
}

export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  const expiredReservations = await prisma.stockReservation.findMany({
    where: {
      status: 'PENDING',
      expiresAt: {
        lte: now
      }
    }
  });

  if (expiredReservations.length === 0) {
    return 0;
  }

  console.log(`[StockManager] Phát hiện ${expiredReservations.length} đơn đặt trước kho hết hạn. Tiến hành giải phóng...`);

  let successCount = 0;
  for (const res of expiredReservations) {
    try {
      await releaseStockReservation(res.id, res.accountId);
      successCount++;
    } catch (err) {
      console.error(`[StockManager] Giải phóng reservation ${res.id} thất bại:`, err);
    }
  }

  return successCount;
}
