import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { CrudService, type CrudDelegate } from '../common/crud.service.js';
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
export class FacetValueSelectionsService extends CrudService<
  CreateFacetValueSelectionDto,
  UpdateFacetValueSelectionDto,
  FacetValueSelection
> {
  constructor(prisma: PrismaService) {
    super(
      prisma.facetValueSelection as unknown as CrudDelegate<FacetValueSelection>,
      facetValueSelectionSelect,
      'FacetValueSelection',
    );
  }
}
