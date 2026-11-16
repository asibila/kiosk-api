import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { verifyPassword } from '../users/password.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates a sign-in attempt and returns the id of the user whose
   * credentials match. Throws `UnauthorizedException` when the email is
   * unknown, the password does not match, or the account is deactivated.
   */
  async login(email: string, password: string): Promise<{ userId: number }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, isActive: true },
    });

    const valid = user ? await verifyPassword(password, user.passwordHash) : false;

    // A deactivated account gets the same answer as a wrong password.
    if (!user || !user.isActive || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return { userId: user.id };
  }
}
