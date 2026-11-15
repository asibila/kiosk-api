/**
 * Audit columns shared by every entity.
 *
 * `createdAt` and `updatedAt` are maintained by Prisma. `createdBy` and
 * `updatedBy` are set by `CrudService` from the actor id supplied through the
 * optional `x-actor-id` request header (see `@ActorId()`).
 */
export const auditSelect = {
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
} as const;
