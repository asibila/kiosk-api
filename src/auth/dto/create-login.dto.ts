import { z } from 'zod';

export const createLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email('Email must be a valid email address')),
  password: z.string().min(1, 'Password is required').max(200),
});

export type CreateLoginDto = z.infer<typeof createLoginSchema>;
