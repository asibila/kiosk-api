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
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        throw new ConflictException(
          `A ${model} with the same unique value already exists`,
        );
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
