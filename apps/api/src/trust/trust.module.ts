import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { CatalogModule } from '../catalog/catalog.module';
import { TrustService } from './trust.service';
import { TrustController } from './trust.controller';
@Module({
  imports: [CommerceModule, CatalogModule],
  controllers: [TrustController],
  providers: [TrustService],
  exports: [TrustService],
})
export class TrustModule {}
