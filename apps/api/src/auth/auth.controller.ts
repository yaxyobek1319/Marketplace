import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { parse, phone } from '../common/core';
import { Actor, CurrentActor, Permissions, Public } from './access';
import { AuthService } from './auth.service';
const otp = z.object({ phone, purpose: z.enum(['REGISTER', 'LOGIN']) }).strict();
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Get('session') @Permissions('session:read') session(@CurrentActor() actor: Actor) {
    return {
      id: actor.id,
      type: actor.type,
      sellerId: actor.sellerId,
      permissions: actor.permissions,
    };
  }
  @Public() @Post('register') register(@Body() body: unknown, @Req() req: { ip: string }) {
    const dto = parse(z.object({ phone, password: z.string().min(8).max(256) }).strict(), body);
    return this.auth.registerPassword(dto.phone, dto.password, req.ip);
  }
  @Public() @Post('login') passwordLogin(@Body() body: unknown, @Req() req: { ip: string }) {
    const dto = parse(z.object({ phone, password: z.string().min(1).max(256) }).strict(), body);
    return this.auth.passwordLogin(dto.phone, dto.password, req.ip);
  }
  @Public() @Post('otp/request') request(@Body() body: unknown, @Req() req: { ip: string }) {
    const dto = parse(otp, body);
    return this.auth.requestOtp(dto.phone, dto.purpose, req.ip);
  }
  @Public() @Post('otp/verify') verify(@Body() body: unknown, @Req() req: { ip: string }) {
    const dto = parse(otp.extend({ code: z.string().regex(/^\d{6}$/) }), body);
    return this.auth.verifyOtp(dto.phone, dto.purpose, dto.code, req.ip);
  }
  @Public() @Post('staff/login') login(@Body() body: unknown, @Req() req: { ip: string }) {
    const dto = parse(
      z
        .object({
          email: z
            .string()
            .email()
            .transform((v) => v.toLowerCase()),
          password: z.string().min(1).max(256),
          code: z
            .string()
            .regex(/^\d{6}$/)
            .optional(),
        })
        .strict(),
      body,
    );
    return this.auth.staffLogin(dto.email, dto.password, dto.code, req.ip);
  }
  @Public() @Post('refresh') refresh(@Body() body: unknown) {
    return this.auth.refresh(
      parse(z.object({ refreshToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict(), body)
        .refreshToken,
    );
  }
  @Post('logout-all') logout(@CurrentActor() actor: Actor) {
    return this.auth.logout(actor.id, actor.type);
  }
}
