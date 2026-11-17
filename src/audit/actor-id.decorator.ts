import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * Audit actor: the signed-in user resolved from the session cookie. Returns
 * `null` on public/guest requests. The client can no longer choose this value.
 */
export const ActorId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number | null => {
    const request = ctx.switchToHttp().getRequest<{
      user?: { id?: number } | null;
    }>();
    const id = request.user?.id;
    return typeof id === 'number' && id > 0 ? id : null;
  },
);
