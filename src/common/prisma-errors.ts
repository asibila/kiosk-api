import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Maps Prisma's known request errors onto HTTP exceptions. Anything else is
 * rethrown unchanged so unexpected failures still surface as a 500.
 */
export function rethrowPrismaError(error: unknown, model: string): never {
  if (isUniqueConstraintError(error)) {
    throw new ConflictException(
      `A ${model} with the same unique value already exists`,
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2003':
        throw new BadRequestException(
          `A related record for this ${model} does not exist`,
        );
      case 'P2025':
        throw new NotFoundException(`${model} not found`);
    }
  }

  throw error;
}

/** True when Prisma rejected a write because a unique value already exists. */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
