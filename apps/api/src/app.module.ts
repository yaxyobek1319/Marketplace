import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { InfrastructureModule } from './common/infrastructure.module';
import { AuthModule } from './auth/auth.module';
import { SellersModule } from './sellers/sellers.module';
import { CatalogModule } from './catalog/catalog.module';
import { CommerceModule } from './commerce/commerce.module';
import { TrustModule } from './trust/trust.module';
import { OperationsModule } from './operations/operations.module';
import { PrismaService } from './prisma.service';
import { Public } from './auth/access';
@Controller('health')
class HealthController {
  constructor(private readonly db: PrismaService) {}
  @Public() @Get('live') live() {
    return { status: 'ok', service: 'marketplace-api' };
  }
  @Public() @Get() async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
    return { status: 'ok', service: 'marketplace-api' };
  }
}
@Module({
  imports: [
    InfrastructureModule,
    AuthModule,
    SellersModule,
    CatalogModule,
    CommerceModule,
    TrustModule,
    OperationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
