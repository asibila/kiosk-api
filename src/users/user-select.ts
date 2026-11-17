import { Prisma } from '@prisma/client';

/** Full user shape returned to the signed-in user (`/auth/me`, login). */
export const authUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type AuthUser = Prisma.UserGetPayload<{ select: typeof authUserSelect }>;

/** Fields safe to expose about other users (listing sellers, chat partners). */
export const publicUserSelect = {
  id: true,
  name: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
