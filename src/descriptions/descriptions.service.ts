import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { CrudService, type CrudDelegate } from '../common/crud.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateDescriptionDto } from './dto/create-description.dto.js';
import type { UpdateDescriptionDto } from './dto/update-description.dto.js';

const descriptionSelect = {
  id: true,
  language: true,
  text: true,
  ...auditSelect,
} satisfies Prisma.DescriptionSelect;

export type Description = Prisma.DescriptionGetPayload<{
  select: typeof descriptionSelect;
}>;

@Injectable()
export class DescriptionsService extends CrudService<
  CreateDescriptionDto,
  UpdateDescriptionDto,
  Description
> {
  constructor(prisma: PrismaService) {
    super(
      prisma.description as unknown as CrudDelegate<Description>,
      descriptionSelect,
      'Description',
    );
  }
}
