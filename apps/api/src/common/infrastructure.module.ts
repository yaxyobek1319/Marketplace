import { Global, Module } from '@nestjs/common';
import { StatsService } from '../operations/stats.service';
import { PrismaService } from '../prisma.service';
import { ProviderRegistry, SmsProvider, UnconfiguredSmsProvider } from '../integrations/providers';
@Global()
@Module({
  providers: [
    PrismaService,
    StatsService,
    ProviderRegistry,
    { provide: SmsProvider, useClass: UnconfiguredSmsProvider },
  ],
  exports: [PrismaService, StatsService, ProviderRegistry, SmsProvider],
})
export class InfrastructureModule {}
