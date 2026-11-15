import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

const ACTOR_HEADER = 'x-actor-id';

/**
 * Reads the optional `x-actor-id` request header and returns it as a number,
 * or `null` when it is missing or not a positive integer.
 *
 * It feeds the audit columns of the entity being written: a controller passes
 * the value to its service, which stores it as `createdBy` or `updatedBy`.
 */
export const ActorId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number | null => {
    const request = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const header = request.headers[ACTOR_HEADER];
    const value = Array.isArray(header) ? header[0] : header;

    if (value === undefined || !/^[1-9]\d*$/.test(value)) {
      return null;
    }

    return Number(value);
  },
);
