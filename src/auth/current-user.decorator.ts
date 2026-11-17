import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * The user resolved from the session cookie by `AuthGuard`, or `null` on a
 * public request from a guest.
 */
export type RequestUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | null => {
    const request = ctx.switchToHttp().getRequest<{ user?: RequestUser | null }>();
    return request.user ?? null;
  },
);
