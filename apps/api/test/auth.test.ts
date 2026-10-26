import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AccessGuard } from '../src/auth/access';
import { AuthService } from '../src/auth/auth.service';
import { hashSecret } from '../src/auth/security';
import { PrismaService } from '../src/prisma.service';
import { SmsProvider } from '../src/integrations/providers';
function context(request: object): ExecutionContext {
  return {
    getHandler: () => () => {},
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}
test('moderator cannot access finance; revoked sessions and blocked staff are rejected', async () => {
  const session = {
    id: 'session',
    subjectId: 'staff',
    subjectType: 'STAFF',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 100000),
    accessExpiresAt: new Date(Date.now() + 100000),
  };
  const staff = { id: 'staff', isActive: true, role: 'MODERATOR', permissions: [] };
  const db = {
    refreshToken: { findUnique: async () => session },
    staffAccount: { findUnique: async () => staff },
  } as unknown as PrismaService;
  const reflector = {
    getAllAndOverride: (key: string) => (key === 'public' ? false : ['finance:read']),
  } as unknown as Reflector;
  const guard = new AccessGuard(db, reflector),
    req = { headers: { authorization: `Bearer ${'x'.repeat(43)}` } };
  await assert.rejects(guard.canActivate(context(req)), ForbiddenException);
  staff.isActive = false;
  await assert.rejects(guard.canActivate(context(req)), UnauthorizedException);
  staff.isActive = true;
  session.revokedAt = new Date() as any;
  await assert.rejects(guard.canActivate(context(req)), UnauthorizedException);
});
test('wrong OTP attempts persist and lock out even a later correct code', async () => {
  const otp = {
    id: 'otp',
    codeHash: await hashSecret('123456'),
    expiresAt: new Date(Date.now() + 100000),
    attempts: 0,
    consumedAt: null,
  };
  const tx = {
    $executeRaw: async () => 0,
    authAttempt: { count: async () => 0, create: async () => ({}) },
    otpCode: {
      findFirst: async () => otp,
      update: async ({ data }: any) => {
        if (data.attempts) otp.attempts++;
        return otp;
      },
    },
    user: { findUnique: async () => ({ id: 'u', isActive: true }) },
  };
  const db = { $transaction: async (fn: any) => fn(tx) } as PrismaService;
  const service = new AuthService(db, {} as SmsProvider);
  for (let n = 0; n < 5; n++)
    await assert.rejects(
      service.verifyOtp('+998901234567', 'LOGIN', '000000', '127.0.0.1'),
      UnauthorizedException,
    );
  assert.equal(otp.attempts, 5);
  await assert.rejects(
    service.verifyOtp('+998901234567', 'LOGIN', '123456', '127.0.0.1'),
    UnauthorizedException,
  );
});

test('password registration hashes secrets, prevents account takeover, and login rejects invalid credentials', async () => {
  let user: any = null;
  let sessions = 0;
  const tx = {
    $executeRaw: async () => 0,
    authAttempt: { count: async () => 0, create: async () => ({}) },
    user: {
      findUnique: async () => user,
      findUniqueOrThrow: async () => user,
      create: async ({ data }: any) => (user = { ...data, id: 'user', isActive: true }),
    },
    refreshToken: {
      create: async () => {
        sessions++;
        return {};
      },
    },
  };
  const db = { ...tx, $transaction: async (fn: any) => fn(tx) } as unknown as PrismaService;
  const service = new AuthService(db, {} as SmsProvider);
  const tokens = await service.registerPassword('+998901234567', 'my-password-123', '127.0.0.1');
  assert.equal(tokens.accessToken.length, 43);
  assert.notEqual(user.passwordHash, 'my-password-123');
  await assert.rejects(service.registerPassword(user.phone, 'replacement-password', '127.0.0.1'));
  await assert.rejects(
    service.passwordLogin(user.phone, 'wrong-password', '127.0.0.1'),
    UnauthorizedException,
  );
  await service.passwordLogin(user.phone, 'my-password-123', '127.0.0.1');
  user.isActive = false;
  await assert.rejects(
    service.passwordLogin(user.phone, 'my-password-123', '127.0.0.1'),
    UnauthorizedException,
  );
  user.isActive = true;
  user.passwordHash = null;
  await assert.rejects(
    service.passwordLogin(user.phone, 'my-password-123', '127.0.0.1'),
    UnauthorizedException,
  );
  assert.equal(sessions, 2);
});
