import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CrudService, type CrudDelegate } from './crud.service.js';

interface Widget {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number | null;
  updatedBy: number | null;
}

class WidgetsService extends CrudService<
  { name: string },
  { name?: string },
  Widget
> {
  constructor(delegate: CrudDelegate<Widget>) {
    super(delegate, { id: true, name: true }, 'Widget');
  }
}

function createDelegateMock() {
  return {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('prisma error', {
    code,
    clientVersion: 'test',
  });
}

const widget: Widget = {
  id: 1,
  name: 'Sprocket',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: 7,
  updatedBy: null,
};

describe('CrudService', () => {
  let delegate: ReturnType<typeof createDelegateMock>;
  let service: WidgetsService;

  beforeEach(() => {
    delegate = createDelegateMock();
    service = new WidgetsService(delegate as unknown as CrudDelegate<Widget>);
  });

  describe('create', () => {
    it('stores the actor id in the createdBy audit column', async () => {
      delegate.create.mockResolvedValue(widget);

      await expect(service.create({ name: 'Sprocket' }, 7)).resolves.toEqual(
        widget,
      );
      expect(delegate.create).toHaveBeenCalledWith({
        data: { name: 'Sprocket', createdBy: 7 },
        select: { id: true, name: true },
      });
    });

    it('leaves createdBy to the default when there is no actor', async () => {
      delegate.create.mockResolvedValue(widget);

      await service.create({ name: 'Sprocket' });

      const { data } = delegate.create.mock.calls[0][0];
      expect(data).toEqual({ name: 'Sprocket' });
    });

    it('reports a unique constraint violation as a conflict', async () => {
      delegate.create.mockRejectedValue(knownError('P2002'));

      await expect(service.create({ name: 'Sprocket' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('reports a missing related record as a bad request', async () => {
      delegate.create.mockRejectedValue(knownError('P2003'));

      await expect(service.create({ name: 'Sprocket' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('returns every row ordered by id', async () => {
      delegate.findMany.mockResolvedValue([widget]);

      await expect(service.findAll()).resolves.toEqual([widget]);
      expect(delegate.findMany).toHaveBeenCalledWith({
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('returns the row when it exists', async () => {
      delegate.findUnique.mockResolvedValue(widget);

      await expect(service.findOne(1)).resolves.toEqual(widget);
      expect(delegate.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true, name: true },
      });
    });

    it('throws 404 when the row does not exist', async () => {
      delegate.findUnique.mockResolvedValue(null);

      await expect(service.findOne(404)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('stores the actor id in the updatedBy audit column', async () => {
      delegate.update.mockResolvedValue(widget);

      await service.update(1, { name: 'Gear' }, 9);

      expect(delegate.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Gear', updatedBy: 9 },
        select: { id: true, name: true },
      });
    });

    it('leaves updatedBy alone when there is no actor', async () => {
      delegate.update.mockResolvedValue(widget);

      await service.update(1, { name: 'Gear' });

      const { data } = delegate.update.mock.calls[0][0];
      expect(data).toEqual({ name: 'Gear' });
    });

    it('throws 404 when the row does not exist', async () => {
      delegate.update.mockRejectedValue(knownError('P2025'));

      await expect(
        service.update(404, { name: 'Gear' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the row', async () => {
      delegate.delete.mockResolvedValue(widget);

      await service.remove(1);

      expect(delegate.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('throws 404 when the row does not exist', async () => {
      delegate.delete.mockRejectedValue(knownError('P2025'));

      await expect(service.remove(404)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
