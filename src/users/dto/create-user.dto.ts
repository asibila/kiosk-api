import { z } from 'zod';

export const USER_ROLES = ['USER', 'ADMIN'] as const;

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email('Email must be a valid email address')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(200),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
