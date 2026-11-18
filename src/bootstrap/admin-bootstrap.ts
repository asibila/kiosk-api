import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword } from '../users/password.js';

/**
 * Ensures the owner account exists and is an admin.
 *
 * `POST /auth/register` always creates `USER` rows, so a fresh deployment has no
 * way to reach admin-only endpoints. When `ADMIN_EMAIL` is set this runs on boot:
 * an existing account is promoted, and a missing one is created when
 * `ADMIN_PASSWORD` is provided too. Idempotent, so it is safe on every restart.
 */
export async function ensureAdmin(
  prisma: PrismaService,
  logger = new Logger('admin-bootstrap'),
): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (existing) {
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'ADMIN', isActive: true },
      });
      logger.log(`Promoted ${email} to ADMIN`);
    }
    return;
  }

  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    logger.warn(
      `ADMIN_EMAIL is set but ${email} does not exist; set ADMIN_PASSWORD to create it`,
    );
    return;
  }

  await prisma.user.create({
    data: {
      name: process.env.ADMIN_NAME?.trim() || 'Admin',
      email,
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
      isActive: true,
      acceptedTermsAt: new Date(),
    },
  });
  logger.log(`Created admin ${email}`);
}
