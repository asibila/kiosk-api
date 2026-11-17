import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import type { RequestUser } from '../auth/current-user.decorator.js';
import { AccessService } from '../common/access.service.js';
import { rethrowPrismaError } from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateFacetValueSelectionDto } from './dto/create-facet-value-selection.dto.js';
import type { UpdateFacetValueSelectionDto } from './dto/update-facet-value-selection.dto.js';

const facetValueSelectionSelect = {
  id: true,
  facetValueOptionId: true,
  listingId: true,
  ...auditSelect,
} satisfies Prisma.FacetValueSelectionSelect;

export type FacetValueSelection = Prisma.FacetValueSelectionGetPayload<{
  select: typeof facetValueSelectionSelect;
}>;

@Injectable()
export class FacetValueSelectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async create(
    dto: CreateFacetValueSelectionDto,
    user: RequestUser,
  ): Promise<FacetValueSelection> {
    await this.access.assertListingOwner(dto.listingId, user);

    try {
      return await this.prisma.facetValueSelection.create({
        data: { ...dto, createdBy: user.id },
        select: facetValueSelectionSelect,
      });
    } catch (error) {
      rethrowPrismaError(error, 'FacetValueSelection');
    }
  }

  findAll(): Promise<FacetValueSelection[]> {
    return this.prisma.facetValueSelection.findMany({
      select: facetValueSelectionSelect,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number): Promise<FacetValueSelection> {
    const row = await this.prisma.facetValueSelection.findUnique({
      where: { id },
      select: facetValueSelectionSelect,
    });
    if (!row) throw new NotFoundException(`FacetValueSelection ${id} not found`);
    return row;
  }

  async update(
    id: number,
    dto: UpdateFacetValueSelectionDto,
    user: RequestUser,
  ): Promise<FacetValueSelection> {
    const selection = await this.prisma.facetValueSelection.findUnique({
      where: { id },
      select: { listingId: true },
    });
    if (!selection) {
      throw new NotFoundException(`FacetValueSelection ${id} not found`);
    }

    await this.access.assertListingOwner(selection.listingId, user);
    // A selection cannot be moved to another listing.
    const { listingId: _listingId, ...changes } = dto;

    try {
      return await this.prisma.facetValueSelection.update({
        where: { id },
        data: { ...changes, updatedBy: user.id },
        select: facetValueSelectionSelect,
      });
    } catch (error) {
      rethrowPrismaError(error, 'FacetValueSelection');
    }
  }

  async remove(id: number, user: RequestUser): Promise<void> {
    const selection = await this.prisma.facetValueSelection.findUnique({
      where: { id },
      select: { listingId: true },
    });
    if (!selection) return;

    await this.access.assertListingOwner(selection.listingId, user);
    try {
      await this.prisma.facetValueSelection.delete({ where: { id } });
    } catch (error) {
      rethrowPrismaError(error, 'FacetValueSelection');
    }
  }
}
