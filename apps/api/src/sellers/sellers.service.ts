import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { audit, emit, ensure, lock, money, required, Tx } from '../common/core';
@Injectable()
export class SellersService {
  constructor(private readonly db: PrismaService) {}
  async own(tx: Tx, userId: string, active = false) {
    const seller = required(await tx.seller.findUnique({ where: { userId } }), 'Do‘kon topilmadi');
    if (active) ensure(seller.status === 'ACTIVE', 'Do‘kon faol emas');
    return seller;
  }
  async requiredDeposit(tx: Tx, sellerId: string, additionalProducts = 0) {
    const count = await tx.product.count({ where: { sellerId, status: 'ACTIVE' } });
    const tier = await tx.depositTier.findFirst({
      where: { minProductCount: { lte: count + additionalProducts } },
      orderBy: { minProductCount: 'desc' },
    });
    return required(tier, 'Depozit bosqichlari sozlanmagan').depositAmount;
  }
  async canPublish(tx: Tx, sellerId: string) {
    await lock(tx, `seller:${sellerId}`);
    const seller = required(await tx.seller.findUnique({ where: { id: sellerId } }));
    ensure(seller.status === 'ACTIVE', 'Do‘kon faol emas');
    const needed = await this.requiredDeposit(tx, sellerId, 1);
    ensure(
      seller.depositBalance.minus(seller.depositHeldAmount).gte(needed),
      'Depozitni to‘ldirish kerak',
    );
  }
  async apply(
    userId: string,
    data: { storeName: string; legalTaxId: string; payoutAccount: string; pickupAddress: string },
  ) {
    return this.db.seller.create({ data: { ...data, userId } });
  }
  async review(staffId: string, sellerId: string, approve: boolean, reason: string) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `seller:${sellerId}`);
      const seller = required(await tx.seller.findUnique({ where: { id: sellerId } }));
      ensure(seller.status === 'PENDING', 'Ariza allaqachon ko‘rib chiqilgan');
      const result = await tx.seller.update({
        where: { id: sellerId },
        data: {
          status: approve ? 'APPROVED_AWAITING_DEPOSIT' : 'SUSPENDED',
          rejectionReason: approve ? null : reason,
        },
      });
      await audit(
        tx,
        staffId,
        approve ? 'SELLER_APPROVED' : 'SELLER_REJECTED',
        'Seller',
        sellerId,
        { reason },
      );
      return result;
    });
  }
  async rates(staffId: string, sellerId: string, commissionRate: string, taxRate: string) {
    ensure(
      money(commissionRate).plus(taxRate).lte(100),
      'Komissiya va soliq yig‘indisi 100%dan oshmasin',
    );
    return this.db.$transaction(async (tx) => {
      await lock(tx, `seller:${sellerId}`);
      const old = required(await tx.seller.findUnique({ where: { id: sellerId } }));
      const result = await tx.seller.update({
        where: { id: sellerId },
        data: { commissionRate, taxRate },
      });
      await audit(tx, staffId, 'COMMISSION_RATE_CHANGED', 'Seller', sellerId, {
        from: old.commissionRate.toString(),
        to: commissionRate,
      });
      await audit(tx, staffId, 'TAX_RATE_CHANGED', 'Seller', sellerId, {
        from: old.taxRate.toString(),
        to: taxRate,
      });
      return result;
    });
  }
  async sanction(
    staffId: string,
    sellerId: string,
    data: {
      type: 'RATING_PENALTY' | 'TEMP_SUSPENSION' | 'DEPOSIT_HOLD' | 'PERMANENT_BAN';
      reason: string;
      endAt?: string;
      amount?: string;
      points?: number;
    },
  ) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `seller:${sellerId}`);
      const seller = required(await tx.seller.findUnique({ where: { id: sellerId } }));
      if (data.type === 'DEPOSIT_HOLD') {
        ensure(
          data.amount && money(data.amount).lte(seller.depositBalance),
          'Noto‘g‘ri depozit miqdori',
        );
        await tx.seller.update({
          where: { id: sellerId },
          data: { depositHeldAmount: data.amount },
        });
      } else if (data.type === 'RATING_PENALTY') {
        ensure(data.points && data.points > 0 && data.points <= 5, 'Jarima 0–5 oralig‘ida bo‘lsin');
        await tx.seller.update({
          where: { id: sellerId },
          data: { rating: money(Math.max(0, seller.rating.toNumber() - data.points)) },
        });
      } else {
        if (data.type === 'TEMP_SUSPENSION')
          ensure(
            data.endAt && new Date(data.endAt) > new Date(),
            'Bloklash tugash muddatini belgilang',
          );
        await tx.seller.update({ where: { id: sellerId }, data: { status: 'SUSPENDED' } });
      }
      const sanction = await tx.sellerSanction.create({
        data: {
          sellerId,
          type: data.type,
          reason: data.reason,
          endAt: data.type === 'TEMP_SUSPENSION' ? new Date(data.endAt!) : null,
          appliedBy: staffId,
        },
      });
      await audit(tx, staffId, 'SANCTION_APPLIED', 'Seller', sellerId, data);
      await emit(tx, 'search.seller', { sellerId }, 1);
      return sanction;
    });
  }
}
