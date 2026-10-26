import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma.service';
import { digest } from './security';
export const Public = () => SetMetadata('public', true);
export const Permissions = (...permissions: string[]) => SetMetadata('permissions', permissions);
export interface Actor {
  id: string;
  type: 'USER' | 'STAFF';
  sellerId?: string;
  sessionId: string;
  permissions: string[];
}
export const CurrentActor = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Actor => ctx.switchToHttp().getRequest().actor,
);
export const rolePermissions = {
  MODERATOR: [
    'sellers:review',
    'products:review',
    'disputes:resolve',
    'returns:resolve',
    'reviews:moderate',
    'sanctions:content',
    'keywords:manage',
    'notifications:templates',
    'admin:queues',
  ],
  SUPER_ADMIN: [
    'payouts:manage',
    'finance:read',
    'sellers:rates',
    'deposits:manage',
    'sanctions:finance',
    'categories:manage',
    'promotions:platform:create',
    'notifications:templates',
    'audit:read',
    'staff:manage',
  ],
};
export const userPermissions = [
  'session:read',
  'profile:own',
  'cart:own',
  'orders:own',
  'reviews:own',
  'disputes:own',
  'returns:own',
  'seller:apply',
  'notifications:own',
  'payouts:own',
];
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly db: PrismaService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('public', [ctx.getHandler(), ctx.getClass()]))
      return true;
    const request = ctx.switchToHttp().getRequest();
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !/^Bearer [A-Za-z0-9_-]{43}$/.test(header))
      throw new UnauthorizedException();
    const session = await this.db.refreshToken.findUnique({
      where: { accessTokenHash: digest(header.slice(7)) },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.accessExpiresAt <= new Date()
    )
      throw new UnauthorizedException();
    let actor: Actor;
    if (session.subjectType === 'USER') {
      const user = await this.db.user.findUnique({
        where: { id: session.subjectId },
        include: { seller: true },
      });
      if (!user?.isActive) throw new UnauthorizedException();
      actor = {
        id: user.id,
        type: 'USER',
        sellerId: user.seller?.id,
        sessionId: session.id,
        permissions: [...userPermissions, ...(user.seller ? ['seller:own'] : [])],
      };
    } else {
      const staff = await this.db.staffAccount.findUnique({ where: { id: session.subjectId } });
      if (!staff?.isActive || (staff.role === 'SUPER_ADMIN' && !staff.twoFactorEnabled))
        throw new UnauthorizedException();
      actor = {
        id: staff.id,
        type: 'STAFF',
        sessionId: session.id,
        permissions: ['session:read', ...rolePermissions[staff.role], ...staff.permissions],
      };
    }
    const required =
      this.reflector.getAllAndOverride<string[]>('permissions', [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];
    if (!required.every((p) => actor.permissions.includes(p))) throw new ForbiddenException();
    request.actor = actor;
    return true;
  }
}
