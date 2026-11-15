import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { CrudService, type CrudDelegate } from '../common/crud.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateFacetSchemaDto } from './dto/create-facet-schema.dto.js';
import type { UpdateFacetSchemaDto } from './dto/update-facet-schema.dto.js';

const facetSchemaSelect = {
  id: true,
  descriptionId: true,
  name: true,
  categoryId: true,
  ...auditSelect,
} satisfies Prisma.FacetSchemaSelect;

export type FacetSchema = Prisma.FacetSchemaGetPayload<{
  select: typeof facetSchemaSelect;
}>;

@Injectable()
export class FacetSchemasService extends CrudService<
  CreateFacetSchemaDto,
  UpdateFacetSchemaDto,
  FacetSchema
> {
  constructor(prisma: PrismaService) {
    super(
      prisma.facetSchema as unknown as CrudDelegate<FacetSchema>,
      facetSchemaSelect,
      'FacetSchema',
    );
  }
}
