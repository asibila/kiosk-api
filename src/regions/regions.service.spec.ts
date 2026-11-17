import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { IpRegionService } from './ip-region.service.js';
import { ALL_REGION_ID, RegionsService } from './regions.service.js';

function createService({ countryCode = 'HR' as string | null } = {}) {
  const regions = [
    { id: 0, code: 'ALL', descriptionId: 300 },
    { id: 4, code: 'HR', descriptionId: 304 },
    { id: 11, code: 'DE', descriptionId: 311 },
  ];

  const prisma = {
    region: {
      findMany: vi.fn(async () => regions),
      findUnique: vi.fn(
        async ({ where }: { where: { id?: number; code?: string } }) =>
          regions.find(
            (region) =>
              (where.id != null && region.id === where.id) ||
              (where.code != null && region.code === where.code),
          ) ?? null,
      ),
    },
  };

  const ipRegions = {
    lookup: vi.fn(async () => countryCode),
  };

  const service = new RegionsService(
    prisma as unknown as PrismaService,
    ipRegions as unknown as IpRegionService,
  );

  return { service, prisma, ipRegions };
}

describe('RegionsService', () => {
  it('lists regions ordered by id so the global row comes first', async () => {
    const { service } = createService();

    const rows = await service.findAll();

    expect(rows.map((row) => row.code)).toEqual(['ALL', 'HR', 'DE']);
  });

  it('maps the detected country code to its region', async () => {
    const { service } = createService({ countryCode: 'DE' });

    await expect(service.detect('81.2.69.142')).resolves.toEqual({
      regionId: 11,
      countryCode: 'DE',
    });
  });

  it('falls back to the all-regions row for unknown or unlocatable addresses', async () => {
    const unknown = createService({ countryCode: 'US' });
    await expect(unknown.service.detect('8.8.8.8')).resolves.toEqual({
      regionId: ALL_REGION_ID,
      countryCode: 'US',
    });

    const privateIp = createService({ countryCode: null });
    await expect(privateIp.service.detect('127.0.0.1')).resolves.toEqual({
      regionId: ALL_REGION_ID,
      countryCode: null,
    });
  });
});
