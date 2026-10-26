import { Module } from '@nestjs/common';
import { SellersModule } from '../sellers/sellers.module';
import { LedgerService } from './ledger.service';
import { CartService } from './cart.service';
import { OrdersService } from './orders.service';
import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';
import { CartController, OrdersController, PaymentsController } from './commerce.controller';
import { FinanceController } from './payouts.controller';
@Module({
  imports: [SellersModule],
  controllers: [CartController, OrdersController, PaymentsController, FinanceController],
  providers: [LedgerService, CartService, OrdersService, PaymentsService, PayoutsService],
  exports: [LedgerService, OrdersService, PaymentsService, PayoutsService],
})
export class CommerceModule {}
