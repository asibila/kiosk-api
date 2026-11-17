import { BadRequestException, Injectable } from '@nestjs/common';
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

export type CategoryRow = Prisma.CategoryGetPayload<{
  select: typeof categorySelect;
}>;

export type Category = CategoryRow & {
  /**
   * Number of interview questions that apply to the category: the facet
   * schemas defined on it and its ancestors (plus the generic ones) and the
   * two numeric range questions that have no `FacetSchema` row.
   */
  facetsCountMax: number;
  /**
   * The subset of `facetsCountMax` that can be answered with a
   * `FacetValueSelection`. Price and year are numeric range questions and are
   * excluded, so this is the denominator for a listing's completion score.
   */
  facetsCountMaxAnswerable: number;
};

/**
 * Virtual category that groups the questions every category shares. It is
 * returned by `GET /categories` and `GET /categories/0`, but it has no row in
 * the database.
 */
export const ALL_CATEGORY_ID = 0;

/**
 * Price and year are numeric range questions rendered by the clients. They have
 * `FacetSchema` rows of type `numeric` in a seeded database, but the clients
 * always render them, so the count has to add any that are missing.
 */
export const RANGE_FACET_COUNT = 2;

/**
 * The questions every category has at minimum: orientation, price and year.
 * Condition is normally a generic `FacetSchema` too, but the minimum keeps the
 * contract even on a database where those seed rows have not been created yet.
 */
export const MIN_FACETS_COUNT_MAX = 3;

type CategoryForTree = {
  id: number;
  parentCategoryId: number | null;
};

type FacetSchemaForCount = {
  id: number;
  categoryId: number;
  isGeneric: boolean;
  name?: string;
  /** Numeric facets are answered through Listing fields, not selections. */
  type?: 'numeric' | 'option';
};

export type FacetCounts = {
  /** Option facets that can be answered with a `FacetValueSelection`. */
  answerable: number;
  /** `answerable` plus the price/year range questions, never below three. */
  max: number;
};

/**
 * Counts the interview questions for one category. A question applies when it
 * is generic or when its facet schema belongs to the category or one of its
 * ancestors. Option facets are answerable through selections; numeric facets
 * (price and year) are answered on the listing itself and only count towards
 * `max`. Missing orientation and range rows are added so the total always
 * matches the questions the clients render.
 */
export function facetCountsFor(
  categoryId: number,
  categories: CategoryForTree[],
  facetSchemas: FacetSchemaForCount[],
): FacetCounts {
  let applicable: FacetSchemaForCount[];

  if (categoryId === ALL_CATEGORY_ID) {
    applicable = facetSchemas.filter((schema) => schema.isGeneric);
  } else {
    const parents = new Map(
      categories.map((category) => [category.id, category.parentCategoryId]),
    );
    const chain = new Set<number>();
    let currentId: number | null = categoryId;

    // Stop at a null parent or at a repeated id, so a corrupt tree cannot loop.
    while (currentId !== null && !chain.has(currentId)) {
      chain.add(currentId);
      currentId = parents.get(currentId) ?? null;
    }

    applicable = facetSchemas.filter(
      (schema) => schema.isGeneric || chain.has(schema.categoryId),
    );
  }

  let answerable = 0;
  let numeric = 0;
  let hasOrientation = false;
  let hasPrice = false;
  let hasYear = false;

  for (const schema of applicable) {
    if (schema.type === 'numeric') {
      numeric += 1;
      if (schema.name === 'price') hasPrice = true;
      if (schema.name === 'year') hasYear = true;
      continue;
    }

    answerable += 1;
    if (schema.name === 'orientation') hasOrientation = true;
  }

  // The clients always render orientation as a required generic question and
  // price/year as range questions, even when their facet rows are missing from
  // an older database.
  if (!hasOrientation) answerable += 1;
  const missingRangeQuestions =
    RANGE_FACET_COUNT - (hasPrice ? 1 : 0) - (hasYear ? 1 : 0);

  return {
    answerable,
    max: Math.max(
      MIN_FACETS_COUNT_MAX,
      answerable + numeric + missingRangeQuestions,
    ),
  };
}

export function facetsCountMaxFor(
  categoryId: number,
  categories: CategoryForTree[],
  facetSchemas: FacetSchemaForCount[],
): number {
  return facetCountsFor(categoryId, categories, facetSchemas).max;
}

export function facetsCountMaxAnswerableFor(
  categoryId: number,
  categories: CategoryForTree[],
  facetSchemas: FacetSchemaForCount[],
): number {
  return facetCountsFor(categoryId, categories, facetSchemas).answerable;
}

@Injectable()
export class CategoriesService extends CrudService<
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryRow
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly descriptions: DescriptionsService,
  ) {
    super(
      prisma.category as unknown as CrudDelegate<CategoryRow>,
      categorySelect,
      'Category',
    );
  }

  override async create(
    dto: CreateCategoryDto,
    actorId: number | null = null,
  ): Promise<Category> {
    await this.descriptions.assertExists(dto.descriptionId);
    const row = await super.create(dto, actorId);
    return this.withFacetCounts(row);
  }

  /**
   * Returns the virtual "all" category first, then every stored category with
   * its question total.
   */
  override async findAll(): Promise<Category[]> {
    const [rows, facetSchemas] = await Promise.all([
      super.findAll(),
      this.loadFacetSchemas(),
    ]);
    const categories = rows.map((row) => ({
      id: row.id,
      parentCategoryId: row.parentCategoryId,
    }));
    const all = this.allCategory(categories, facetSchemas);

    return [
      all,
      ...rows.map((row) => {
        const counts = facetCountsFor(row.id, categories, facetSchemas);
        return {
          ...row,
          facetsCountMax: counts.max,
          facetsCountMaxAnswerable: counts.answerable,
        };
      }),
    ];
  }

  override async findOne(id: number): Promise<Category> {
    if (id === ALL_CATEGORY_ID) {
      const [categories, facetSchemas] = await Promise.all([
        this.loadCategoryTree(),
        this.loadFacetSchemas(),
      ]);
      return this.allCategory(categories, facetSchemas);
    }

    const row = await super.findOne(id);
    return this.withFacetCounts(row);
  }

  override async update(
    id: number,
    dto: UpdateCategoryDto,
    actorId: number | null = null,
  ): Promise<Category> {
    if (id === ALL_CATEGORY_ID) {
      throw new BadRequestException('The all category cannot be modified');
    }
    if (dto.descriptionId !== undefined) {
      await this.descriptions.assertExists(dto.descriptionId);
    }
    if (dto.parentCategoryId != null) {
      await this.assertNoCycle(id, dto.parentCategoryId);
    }
    const row = await super.update(id, dto, actorId);
    return this.withFacetCounts(row);
  }

  override async remove(id: number): Promise<void> {
    if (id === ALL_CATEGORY_ID) {
      throw new BadRequestException('The all category cannot be deleted');
    }
    return super.remove(id);
  }

  private async withFacetCounts(row: CategoryRow): Promise<Category> {
    const [categories, facetSchemas] = await Promise.all([
      this.loadCategoryTree(),
      this.loadFacetSchemas(),
    ]);
    const counts = facetCountsFor(row.id, categories, facetSchemas);

    return {
      ...row,
      facetsCountMax: counts.max,
      facetsCountMaxAnswerable: counts.answerable,
    };
  }

  private allCategory(
    categories: CategoryForTree[],
    facetSchemas: FacetSchemaForCount[],
  ): Category {
    const counts = facetCountsFor(ALL_CATEGORY_ID, categories, facetSchemas);

    return {
      id: ALL_CATEGORY_ID,
      descriptionId: 0,
      parentCategoryId: null,
      // The virtual row has no audit trail; keep the response shape stable.
      createdAt: new Date(0),
      updatedAt: new Date(0),
      createdBy: null,
      updatedBy: null,
      facetsCountMax: counts.max,
      facetsCountMaxAnswerable: counts.answerable,
    };
  }

  private loadCategoryTree(): Promise<CategoryForTree[]> {
    return this.prisma.category.findMany({
      select: { id: true, parentCategoryId: true },
      orderBy: { id: 'asc' },
    });
  }

  private loadFacetSchemas(): Promise<FacetSchemaForCount[]> {
    return this.prisma.facetSchema.findMany({
      select: { id: true, categoryId: true, isGeneric: true, name: true, type: true },
    });
  }

  /**
   * Rejects a parent that would make the category its own ancestor. The walk
   * starts at the proposed parent and climbs towards the root. The visited set
   * stops it if the stored tree already contains a cycle elsewhere.
   */
  private async assertNoCycle(
    categoryId: number,
    parentCategoryId: number,
  ): Promise<void> {
    const visited = new Set<number>();
    let currentId: number | null = parentCategoryId;

    while (currentId !== null && !visited.has(currentId)) {
      if (currentId === categoryId) {
        throw new BadRequestException(
          'A category cannot be placed under itself or one of its descendants',
        );
      }
      visited.add(currentId);

      const parent: { parentCategoryId: number | null } | null =
        await this.prisma.category.findUnique({
          where: { id: currentId },
          select: { parentCategoryId: true },
        });
      currentId = parent?.parentCategoryId ?? null;
    }
  }
}
