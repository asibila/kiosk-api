import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { verifyPassword } from '../users/password.js';
import { authUserSelect, type AuthUser } from '../users/user-select.js';
import { sessionTtlMs } from './session-cookie.js';

/** The cookie token itself is never stored; only its SHA-256 digest is. */
const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates a sign-in attempt. Throws `UnauthorizedException` when the email
   * is unknown, the password does not match, or the account is deactivated.
   */
  async login(email: string, password: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...authUserSelect, passwordHash: true },
    });

    const valid = user ? await verifyPassword(password, user.passwordHash) : false;

    // A deactivated account gets the same answer as a wrong password.
    if (!user || !user.isActive || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  /** Creates a session for a signed-in user and returns the cookie token. */
  async createSession(
    userId: number,
    userAgent?: string | null,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + sessionTtlMs());

    await this.prisma.session.create({
      data: {
        id: hashToken(token),
        userId,
        expiresAt,
        userAgent: userAgent?.slice(0, 255) ?? null,
      },
      select: { id: true },
    });

    return { token, expiresAt };
  }

  /** User for a session token, or `null` when missing, expired or deactivated. */
  async resolveSession(token: string): Promise<AuthUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: hashToken(token) },
      select: {
        id: true,
        expiresAt: true,
        user: { select: authUserSelect },
      },
    });

    if (!session) return null;

    if (session.expiresAt <= new Date() || !session.user.isActive) {
      await this.prisma.session
        .delete({ where: { id: session.id }, select: { id: true } })
        .catch(() => undefined);
      return null;
    }

    return session.user;
  }

  async revokeSession(token: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: hashToken(token) } });
  }

  async revokeAllForUser(userId: number): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}
