import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Columns returned to callers, e.g. `{ id: true, name: true }`. */
export type CrudSelect = Record<string, boolean>;

/** Row data handed to Prisma, e.g. `{ name: 'Cars', categoryId: 1 }`. */
export type CrudData = Record<string, unknown>;

interface CrudWhere {
  id: number;
}

/**
 * The subset of a Prisma model delegate that `CrudService` needs. Concrete
 * services pass their delegate (for example `prisma.listing`) cast to this
 * shape, which keeps the shared implementation free of per-model types.
 */
export interface CrudDelegate<Row> {
  create(args: { data: CrudData; select: CrudSelect }): Promise<Row>;
  findMany(args: {
    select: CrudSelect;
    orderBy: { id: 'asc' };
  }): Promise<Row[]>;
  findUnique(args: {
    where: CrudWhere;
    select: CrudSelect;
  }): Promise<Row | null>;
  update(args: {
    where: CrudWhere;
    data: CrudData;
    select: CrudSelect;
  }): Promise<Row>;
  delete(args: { where: CrudWhere }): Promise<Row>;
}

/**
 * Shared CRUD implementation for the ER entities, mirroring `UsersService`.
 *
 * Audit columns are filled here: `createdAt` and `updatedAt` are managed by
 * Prisma, while `createdBy` and `updatedBy` are taken from the actor id. Concrete
 * services can override `create`/`update` to stamp additional entity-level user
 * ids, such as the user who created a chat message.
 */
export abstract class CrudService<
  TCreate extends object,
  TUpdate extends object,
  TRow,
> {
  protected constructor(
    protected readonly delegate: CrudDelegate<TRow>,
    protected readonly select: CrudSelect,
    protected readonly model: string,
  ) {}

  async create(dto: TCreate, actorId: number | null = null): Promise<TRow> {
    const data = { ...dto } as CrudData;

    if (actorId !== null) {
      data.createdBy = actorId;
    }

    try {
      return await this.delegate.create({ data, select: this.select });
    } catch (error) {
      this.rethrow(error);
    }
  }

  findAll(): Promise<TRow[]> {
    return this.delegate.findMany({
      select: this.select,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number): Promise<TRow> {
    const row = await this.delegate.findUnique({
      where: { id },
      select: this.select,
    });

    if (!row) {
      throw new NotFoundException(`${this.model} ${id} not found`);
    }

    return row;
  }

  async update(
    id: number,
    dto: TUpdate,
    actorId: number | null = null,
  ): Promise<TRow> {
    const data = { ...dto } as CrudData;

    if (actorId !== null) {
      data.updatedBy = actorId;
    }

    try {
      return await this.delegate.update({
        where: { id },
        data,
        select: this.select,
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  async remove(id: number): Promise<void> {
    try {
      await this.delegate.delete({ where: { id } });
    } catch (error) {
      this.rethrow(error);
    }
  }

  /**
   * Turns Prisma's known errors into HTTP errors. Anything else is rethrown
   * unchanged, so unexpected failures still surface as a 500.
   */
  protected rethrow(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          throw new ConflictException(
            `A ${this.model} with the same unique value already exists`,
          );
        case 'P2003':
          throw new BadRequestException(
            `A related record for this ${this.model} does not exist`,
          );
        case 'P2025':
          throw new NotFoundException(`${this.model} not found`);
      }
    }

    throw error;
  }
}
