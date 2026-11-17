import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { DescriptionsService } from './descriptions.service.js';

const now = new Date('2026-01-01T00:00:00.000Z');

function row(
  id: number,
  language: string,
  name: string | null,
  text: string,
) {
  return {
    id,
    language,
    name,
    text,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    updatedBy: null,
  };
}

describe('DescriptionsService name', () => {
  it('stores the name on every language row when creating', async () => {
    const created: unknown[] = [];
    const prisma = {
      description: {
        findFirst: vi.fn(async (args: { orderBy?: unknown }) =>
          args.orderBy ? { id: 4 } : null,
        ),
        createMany: vi.fn(async ({ data }: { data: unknown[] }) => {
          created.push(...data);
          return { count: data.length };
        }),
        findMany: vi.fn(async () => [
          row(5, 'en', 'common.close', 'Close'),
          row(5, 'hr', 'common.close', 'Zatvori'),
        ]),
      },
      language: {
        findMany: vi.fn(async () => [{ code: 'en' }, { code: 'hr' }]),
      },
    };
    const service = new DescriptionsService(
      prisma as unknown as PrismaService,
    );

    const description = await service.create({
      name: 'common.close',
      translations: { en: 'Close', hr: 'Zatvori' },
    });

    expect(created).toEqual([
      { id: 5, language: 'en', name: 'common.close', text: 'Close' },
      { id: 5, language: 'hr', name: 'common.close', text: 'Zatvori' },
    ]);
    expect(description.name).toBe('common.close');
  });

  it('rejects a name that another description already uses', async () => {
    const prisma = {
      description: {
        findFirst: vi.fn(async () => ({ id: 1 })),
      },
    };
    const service = new DescriptionsService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.create({
        name: 'common.close',
        translations: { en: 'Close', hr: 'Zatvori' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('renames every language row of a description', async () => {
    const prisma = {
      description: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ language: 'en' }, { language: 'hr' }])
          .mockResolvedValueOnce([
            row(3, 'en', 'common.ok', 'OK'),
            row(3, 'hr', 'common.ok', 'U redu'),
          ]),
        findFirst: vi.fn(async () => null),
        updateMany: vi.fn(async () => ({ count: 2 })),
        update: vi.fn(async () => ({})),
      },
      $transaction: vi.fn(async (operations: unknown[]) =>
        Promise.all(operations),
      ),
    };
    const service = new DescriptionsService(
      prisma as unknown as PrismaService,
    );

    const description = await service.update(3, { name: 'common.ok' }, 9);

    expect(prisma.description.updateMany).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { name: 'common.ok', updatedBy: 9 },
    });
    expect(prisma.description.update).not.toHaveBeenCalled();
    expect(description.name).toBe('common.ok');
  });
});
