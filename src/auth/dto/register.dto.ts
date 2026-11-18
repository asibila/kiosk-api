import { z } from 'zod';

/**
 * Signup form. Same rules as `createUserSchema`, plus the terms checkbox: the
 * account row records when it was accepted (`User.acceptedTermsAt`).
 */
export const registerSchema = z.object({
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
  acceptTerms: z
    .boolean()
    .refine((value) => value === true, 'You must accept the terms to sign up'),
});

export type RegisterDto = z.infer<typeof registerSchema>;
