import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { authUserSelect, type AuthUser } from '../../users/user-select.js';
import { UsersService } from '../../users/users.service.js';

const PROVIDER = 'google';
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const TIMEOUT_MS = 8_000;

/** The fields this flow needs from the provider. */
export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

export type GoogleSignInResult =
  | { status: 'signed-in'; user: AuthUser }
  /** A password account already owns this email (no silent linking). */
  | { status: 'email-in-use' }
  | { status: 'email-unverified' }
  | { status: 'inactive' };

/**
 * Google OpenID Connect (authorization-code flow).
 *
 * The client secret never leaves the server: the browser is redirected to
 * Google, and the code is exchanged here. Accounts are matched by the stable
 * `sub` first and only then by email — see `signIn` for the collision policy.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.clientId() && this.clientSecret());
  }

  private clientId(): string {
    return this.config.get<string>('GOOGLE_CLIENT_ID')?.trim() ?? '';
  }

  private clientSecret(): string {
    return this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim() ?? '';
  }

  /** Random `state` value for the CSRF check. */
  newState(): string {
    return randomBytes(24).toString('base64url');
  }

  /** Consent-screen URL for the given state and callback. */
  authorizationUrl(state: string, redirectUri: string): string {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }

    const params = new URLSearchParams({
      client_id: this.clientId(),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });

    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  /** Exchange the authorization code and read the profile. Null on failure. */
  async exchangeCode(code: string, redirectUri: string): Promise<GoogleProfile | null> {
    if (!this.isConfigured()) return null;

    try {
      const tokenResponse = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId(),
          client_secret: this.clientSecret(),
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!tokenResponse.ok) {
        this.logger.warn(`Token exchange answered ${tokenResponse.status}`);
        return null;
      }

      const tokens = (await tokenResponse.json()) as { access_token?: string };
      if (!tokens.access_token) return null;

      const profileResponse = await fetch(USERINFO_URL, {
        headers: { authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!profileResponse.ok) {
        this.logger.warn(`Userinfo answered ${profileResponse.status}`);
        return null;
      }

      const info = (await profileResponse.json()) as {
        sub?: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
      };
      if (!info.sub || !info.email) return null;

      return {
        sub: info.sub,
        email: info.email.trim().toLowerCase(),
        emailVerified: info.email_verified === true,
        name: info.name?.trim() || null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Google sign-in failed: ${message}`);
      return null;
    }
  }

  /**
   * Resolve a Google profile to an account.
   *
   * Order matters:
   * 1. an existing link by `sub` signs in (even if the provider email changed);
   * 2. an email that already has a **password** account is refused — the email
   *    is unverified on our side, so linking could hand an attacker's account to
   *    the real mailbox owner;
   * 3. an email owned by a provider-only account is linked (both sides verified);
   * 4. otherwise the account is created.
   */
  async signIn(profile: GoogleProfile): Promise<GoogleSignInResult> {
    if (!profile.emailVerified) return { status: 'email-unverified' };

    const linked = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: PROVIDER,
          providerAccountId: profile.sub,
        },
      },
      select: { user: { select: authUserSelect } },
    });

    if (linked) {
      if (!linked.user.isActive) return { status: 'inactive' };
      return { status: 'signed-in', user: linked.user };
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: profile.email },
      select: { ...authUserSelect, passwordHash: true },
    });

    if (existing) {
      if (!existing.isActive) return { status: 'inactive' };
      if (existing.passwordHash != null) return { status: 'email-in-use' };

      await this.linkAccount(existing.id, profile);
      const { passwordHash: _passwordHash, ...user } = existing;
      return { status: 'signed-in', user };
    }

    const user = await this.users.createSocial({
      name: profile.name || profile.email.split('@')[0],
      email: profile.email,
    });
    await this.linkAccount(user.id, profile);

    return { status: 'signed-in', user };
  }

  /**
   * Link a Google identity to the signed-in account (started from the profile).
   * The Google email must match the account email, and one Google identity can
   * only belong to one account. Returns a result the controller turns into a
   * redirect parameter; it never throws for a policy refusal.
   */
  async linkToAccount(
    user: { id: number; email: string },
    profile: GoogleProfile,
  ): Promise<'linked' | 'already-linked' | 'email-mismatch' | 'google-taken'> {
    if (!profile.emailVerified) return 'email-mismatch';
    if (profile.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return 'email-mismatch';
    }

    const existing = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: PROVIDER,
          providerAccountId: profile.sub,
        },
      },
      select: { userId: true },
    });

    if (existing) {
      return existing.userId === user.id ? 'already-linked' : 'google-taken';
    }

    const own = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_userId: { provider: PROVIDER, userId: user.id },
      },
      select: { providerAccountId: true },
    });
    if (own) {
      return own.providerAccountId === profile.sub ? 'already-linked' : 'google-taken';
    }

    await this.linkAccount(user.id, profile);
    return 'linked';
  }

  /** Whether the signed-in account already has a Google identity. */
  async isLinked(userId: number): Promise<boolean> {
    const count = await this.prisma.oAuthAccount.count({
      where: { userId, provider: PROVIDER },
    });
    return count > 0;
  }

  /**
   * Store the provider link. A concurrent callback can win the unique index, so
   * a duplicate is treated as success (the link exists, which is all we need).
   */
  private async linkAccount(userId: number, profile: GoogleProfile): Promise<void> {
    try {
      await this.prisma.oAuthAccount.create({
        data: {
          userId,
          provider: PROVIDER,
          providerAccountId: profile.sub,
          email: profile.email,
        },
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== 'P2002') throw error;
    }
  }
}
