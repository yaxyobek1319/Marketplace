import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ProfileController } from './profile.controller';
import { AccessGuard } from './access';
@Module({
  controllers: [AuthController, ProfileController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AccessGuard }],
  exports: [AuthService],
})
export class AuthModule {}
