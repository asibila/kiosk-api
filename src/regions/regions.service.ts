import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { IpRegionService } from './ip-region.service.js';

/** `Region.id` of the global "All regions" row; also the fallback for unknown IPs. */
export const ALL_REGION_ID = 0;

const regionSelect = {
  id: true,
  code: true,
  descriptionId: true,
  ...auditSelect,
} satisfies Prisma.RegionSelect;

export type RegionRow = Prisma.RegionGetPayload<{ select: typeof regionSelect }>;

export type DetectedRegion = {
  /** Region matching the visitor's country, or `ALL_REGION_ID` when unknown. */
  regionId: number;
  /** ISO code the IP resolved to, before the Region lookup. `null` if unknown. */
  countryCode: string | null;
};

@Injectable()
export class RegionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ipRegions: IpRegionService,
  ) {}

  findAll(): Promise<RegionRow[]> {
    return this.prisma.region.findMany({
      select: regionSelect,
      orderBy: { id: 'asc' },
    });
  }

  findOne(id: number): Promise<RegionRow | null> {
    return this.prisma.region.findUnique({ where: { id }, select: regionSelect });
  }

  /** Map the visitor's IP address to a seeded region. */
  async detect(ip: string | null): Promise<DetectedRegion> {
    const countryCode = await this.ipRegions.lookup(ip);
    if (!countryCode) {
      return { regionId: ALL_REGION_ID, countryCode: null };
    }

    const region = await this.prisma.region.findUnique({
      where: { code: countryCode },
      select: { id: true },
    });

    return {
      regionId: region?.id ?? ALL_REGION_ID,
      countryCode,
    };
  }
}
