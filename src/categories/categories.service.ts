import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { CrudService, type CrudDelegate } from '../common/crud.service.js';
import { DescriptionsService } from '../descriptions/descriptions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';

const categorySelect = {
  id: true,
  descriptionId: true,
  parentCategoryId: true,
  ...auditSelect,
} satisfies Prisma.CategorySelect;

export type Category = Prisma.CategoryGetPayload<{
  select: typeof categorySelect;
}>;

@Injectable()
export class CategoriesService extends CrudService<
  CreateCategoryDto,
  UpdateCategoryDto,
  Category
> {
  constructor(
    prisma: PrismaService,
    private readonly descriptions: DescriptionsService,
  ) {
    super(
      prisma.category as unknown as CrudDelegate<Category>,
      categorySelect,
      'Category',
    );
  }

  override async create(
    dto: CreateCategoryDto,
    actorId: number | null = null,
  ): Promise<Category> {
    await this.descriptions.assertExists(dto.descriptionId);
    return super.create(dto, actorId);
  }

  override async update(
    id: number,
    dto: UpdateCategoryDto,
    actorId: number | null = null,
  ): Promise<Category> {
    if (dto.descriptionId !== undefined) {
      await this.descriptions.assertExists(dto.descriptionId);
    }
    return super.update(id, dto, actorId);
  }
}
