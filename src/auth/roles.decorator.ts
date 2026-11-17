import { SetMetadata } from '@nestjs/common';

export const ROLES = 'roles';

/** Requires a signed-in user whose `role` is one of the given values. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES, roles);
