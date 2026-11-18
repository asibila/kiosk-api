import { z } from 'zod';

export const createCategorySchema = z.object({
  descriptionId: z.number().int().positive(),
  parentCategoryId: z.number().int().positive().nullish(),
  /**
   * Inline SVG markup; the service sanitizes it against a strict allow-list
   * and stores the normalized result (see `category-icon.ts`). The limit is
   * generous so pasted icons with whitespace are accepted; the sanitizer
   * enforces the real, normalized budget.
   */
  iconSvg: z.string().trim().min(1).max(8192).nullish(),
});

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
