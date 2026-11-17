import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service.js';
import { readSessionToken } from './session-cookie.js';
import { IS_PUBLIC } from './public.decorator.js';
import { ROLES } from './roles.decorator.js';

/**
 * Resolves the session cookie into `request.user` for every request. Guests are
 * allowed through only on `@Public()` routes; `@Roles()` adds a role check.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: unknown;
    }>();

    const cookie = request.headers.cookie;
    const token = readSessionToken(
      Array.isArray(cookie) ? cookie[0] : cookie,
    );
    const user = token ? await this.auth.resolveSession(token) : null;
    request.user = user;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!user && !isPublic) {
      throw new UnauthorizedException('Sign in required');
    }

    const roles =
      this.reflector.getAllAndOverride<string[]>(ROLES, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (roles.length > 0 && (!user || !roles.includes(user.role))) {
      throw new ForbiddenException('Not allowed');
    }

    return true;
  }
}
