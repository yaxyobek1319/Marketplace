import { WorkspaceController } from './workspace.controller';
import { ReportsController } from './reports.controller';
import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { CatalogModule } from '../catalog/catalog.module';
import { TrustModule } from '../trust/trust.module';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import {
  NotificationsService,
  PushProvider,
  UnconfiguredPushProvider,
} from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { AdminController, PromotionsController } from './admin.controller';
import { JobsService } from './jobs.service';
@Module({
  imports: [CommerceModule, CatalogModule, TrustModule],
  controllers: [
    DeliveryController,
    NotificationsController,
    SearchController,
    ReportsController,
    WorkspaceController,
    AdminController,
    PromotionsController,
  ],
  providers: [
    DeliveryService,
    NotificationsService,
    { provide: PushProvider, useClass: UnconfiguredPushProvider },
    SearchService,
    JobsService,
  ],
})
export class OperationsModule {}
