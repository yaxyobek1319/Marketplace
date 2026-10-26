import { Module } from '@nestjs/common';
import { SellersModule } from '../sellers/sellers.module';
import { CatalogService } from './catalog.service';
import { MediaController } from './media.controller';
import { CatalogController } from './catalog.controller';
@Module({
  imports: [SellersModule],
  controllers: [CatalogController, MediaController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
