import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { CrudService, type CrudDelegate } from '../common/crud.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateFacetValueOptionDto } from './dto/create-facet-value-option.dto.js';
import type { UpdateFacetValueOptionDto } from './dto/update-facet-value-option.dto.js';

const facetValueOptionSelect = {
  id: true,
  descriptionId: true,
  schemaId: true,
  ...auditSelect,
} satisfies Prisma.FacetValueOptionSelect;

export type FacetValueOption = Prisma.FacetValueOptionGetPayload<{
  select: typeof facetValueOptionSelect;
}>;

@Injectable()
export class FacetValueOptionsService extends CrudService<
  CreateFacetValueOptionDto,
  UpdateFacetValueOptionDto,
  FacetValueOption
> {
  constructor(prisma: PrismaService) {
    super(
      prisma.facetValueOption as unknown as CrudDelegate<FacetValueOption>,
      facetValueOptionSelect,
      'FacetValueOption',
    );
  }
}
