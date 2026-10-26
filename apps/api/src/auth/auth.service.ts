import {
  ConflictException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthSubjectType, OtpPurpose } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { authenticator } from 'otplib';
import { PrismaService } from '../prisma.service';
import { SmsProvider } from '../integrations/providers';
import { hoursFromNow, lock, Tx } from '../common/core';
import { decrypt, digest, hashSecret, newToken, verifySecret } from './security';
@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly sms: SmsProvider,
  ) {}
  async throttle(key: string, limit: number, seconds: number) {
    await this.db.$transaction(async (tx) => {
      await lock(tx, `rate:${key}`);
      const count = await tx.authAttempt.count({
        where: { key, createdAt: { gt: new Date(Date.now() - seconds * 1000) } },
      });
      if (count >= limit)
        throw new HttpException('Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.', 429);
      await tx.authAttempt.create({ data: { key } });
    });
  }
  async registerPassword(phone: string, password: string, ip: string) {
    await this.throttle(`register-ip:${ip}`, 10, 3600);
    await this.throttle(`register-phone:${phone}`, 5, 3600);
    const passwordHash = await hashSecret(password);
    return this.db.$transaction(async (tx) => {
      await lock(tx, `otp:${phone}`);
      if (await tx.user.findUnique({ where: { phone } }))
        throw new ConflictException('Bu raqam bilan hisob mavjud. Hisobingizga kiring.');
      const user = await tx.user.create({ data: { phone, passwordHash } });
      return this.session(tx, 'USER', user.id);
    });
  }
  async passwordLogin(phone: string, password: string, ip: string) {
    await this.throttle(`login-ip:${ip}`, 30, 900);
    await this.throttle(`login-phone:${phone}`, 10, 900);
    const user = await this.db.user.findUnique({ where: { phone } });
    if (!user?.isActive || !user.passwordHash || !(await verifySecret(password, user.passwordHash)))
      throw new UnauthorizedException('Telefon raqami yoki parol noto‘g‘ri');
    return this.db.$transaction(async (tx) => {
      await lock(tx, `otp:${phone}`);
      const current = await tx.user.findUniqueOrThrow({ where: { phone } });
      if (!current.isActive || current.passwordHash !== user.passwordHash)
        throw new UnauthorizedException('Telefon raqami yoki parol noto‘g‘ri');
      return this.session(tx, 'USER', user.id);
    });
  }
  async requestOtp(phone: string, purpose: OtpPurpose, ip: string) {
    await this.throttle(`otp-ip:${ip}`, 20, 3600);
    const code = randomInt(100000, 1000000).toString();
    const codeHash = await hashSecret(code);
    const otp = await this.db.$transaction(async (tx) => {
      await lock(tx, `otp:${phone}`);
      const recent = await tx.otpCode.findMany({
        where: { phone, createdAt: { gt: hoursFromNow(-1) } },
        orderBy: { createdAt: 'desc' },
      });
      if (recent.length >= 5 || (recent[0] && Date.now() - recent[0].createdAt.getTime() < 60000))
        throw new HttpException('OTP so‘rovi limiti', 429);
      await tx.otpCode.updateMany({
        where: { phone, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      return tx.otpCode.create({
        data: { phone, purpose, codeHash, expiresAt: new Date(Date.now() + 180000) },
      });
    });
    try {
      await this.sms.send(phone, `Tasdiqlash kodi: ${code}`, otp.id);
    } catch (error) {
      await this.db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      throw error;
    }
    return { expiresIn: 180, retryAfter: 60 };
  }
  async verifyOtp(phone: string, purpose: OtpPurpose, code: string, ip: string) {
    await this.throttle(`otp-verify:${ip}`, 50, 3600);
    const result = await this.db.$transaction(async (tx) => {
      await lock(tx, `otp:${phone}`);
      const otp = await tx.otpCode.findFirst({
        where: { phone, purpose, consumedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (!otp || otp.expiresAt <= new Date() || otp.attempts >= 5) return null;
      await tx.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      if (!(await verifySecret(code, otp.codeHash))) return null; // Commit failed attempt counter.
      await tx.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      const user =
        purpose === 'REGISTER'
          ? await tx.user.upsert({ where: { phone }, create: { phone }, update: {} })
          : await tx.user.findUnique({ where: { phone } });
      if (!user?.isActive) return null;
      return this.session(tx, 'USER', user.id);
    });
    if (!result) throw new UnauthorizedException('Kod noto‘g‘ri yoki muddati tugagan');
    return result;
  }
  async staffLogin(email: string, password: string, code: string | undefined, ip: string) {
    await this.throttle(`staff-ip:${ip}`, 30, 900);
    await this.throttle(`staff-email:${email}`, 10, 900);
    const staff = await this.db.staffAccount.findUnique({ where: { email } });
    if (!staff?.isActive || !(await verifySecret(password, staff.passwordHash)))
      throw new UnauthorizedException();
    return this.db.$transaction(async (tx) => {
      await lock(tx, `staff:${staff.id}`);
      const current = await tx.staffAccount.findUniqueOrThrow({ where: { id: staff.id } });
      if (!current.isActive || current.passwordHash !== staff.passwordHash)
        throw new UnauthorizedException();
      if (current.twoFactorEnabled || current.role === 'SUPER_ADMIN') {
        if (!current.twoFactorEnabled || !current.twoFactorSecretEncrypted || !code)
          throw new UnauthorizedException('2FA talab qilinadi');
        const valid = authenticator.check(code, decrypt(current.twoFactorSecretEncrypted));
        const step = BigInt(Math.floor(Date.now() / 30000));
        if (!valid || (current.lastTotpStep !== null && current.lastTotpStep >= step))
          throw new UnauthorizedException('2FA kodi noto‘g‘ri yoki ishlatilgan');
        await tx.staffAccount.update({ where: { id: staff.id }, data: { lastTotpStep: step } });
      }
      await tx.staffAccount.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
      return this.session(tx, 'STAFF', staff.id);
    });
  }
  async session(tx: Tx, subjectType: AuthSubjectType, subjectId: string) {
    const accessToken = newToken(),
      refreshToken = newToken();
    await tx.refreshToken.create({
      data: {
        subjectType,
        subjectId,
        tokenHash: digest(refreshToken),
        accessTokenHash: digest(accessToken),
        accessExpiresAt: new Date(Date.now() + 900000),
        expiresAt: hoursFromNow(24 * 30),
      },
    });
    return { accessToken, refreshToken, expiresIn: 900 };
  }
  async refresh(token: string) {
    const result = await this.db.$transaction(async (tx) => {
      await lock(tx, `refresh:${digest(token)}`);
      const old = await tx.refreshToken.findUnique({ where: { tokenHash: digest(token) } });
      if (!old || old.expiresAt <= new Date() || old.revokedAt) return null;
      const subject =
        old.subjectType === 'USER'
          ? await tx.user.findUnique({ where: { id: old.subjectId } })
          : await tx.staffAccount.findUnique({ where: { id: old.subjectId } });
      if (!subject?.isActive) return null;
      await tx.refreshToken.update({ where: { id: old.id }, data: { revokedAt: new Date() } });
      return this.session(tx, old.subjectType, old.subjectId);
    });
    if (!result) throw new UnauthorizedException();
    return result;
  }
  logout(subjectId: string, subjectType: AuthSubjectType) {
    return this.db.refreshToken.updateMany({
      where: { subjectId, subjectType, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
