import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateDescriptionDto } from './dto/create-description.dto.js';
import type { UpdateDescriptionDto } from './dto/update-description.dto.js';

const descriptionSelect = {
  id: true,
  language: true,
  text: true,
  ...auditSelect,
} satisfies Prisma.DescriptionSelect;

type DescriptionRow = Prisma.DescriptionGetPayload<{
  select: typeof descriptionSelect;
}>;

/** One description group, with every language's text under `translations`. */
export interface Description {
  id: number;
  translations: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number | null;
  updatedBy: number | null;
}

/**
 * Descriptions are stored one row per language under a shared `id`
 * (`@@id([id, language])`). This service exposes them as a single object per
 * id so callers always receive every translation together, and guarantees a
 * new description is created for each language in the `Language` table.
 */
@Injectable()
export class DescriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDescription(rows: DescriptionRow[]): Description {
    const translations: Record<string, string> = {};
    for (const row of rows) translations[row.language] = row.text;

    const latest = rows.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
    const earliest = rows.reduce((a, b) => (b.createdAt < a.createdAt ? b : a));

    return {
      id: rows[0].id,
      translations,
      createdAt: earliest.createdAt,
      updatedAt: latest.updatedAt,
      createdBy: latest.createdBy ?? earliest.createdBy,
      updatedBy: latest.updatedBy,
    };
  }

  async findAll(): Promise<Description[]> {
    const rows = await this.prisma.description.findMany({
      select: descriptionSelect,
      orderBy: [{ id: 'asc' }, { language: 'asc' }],
    });

    const groups = new Map<number, DescriptionRow[]>();
    for (const row of rows) {
      const group = groups.get(row.id) ?? [];
      group.push(row);
      groups.set(row.id, group);
    }

    return [...groups.values()].map((group) => this.toDescription(group));
  }

  async findOne(id: number): Promise<Description> {
    const rows = await this.prisma.description.findMany({
      where: { id },
      select: descriptionSelect,
      orderBy: { language: 'asc' },
    });

    if (rows.length === 0) {
      throw new NotFoundException(`Description ${id} not found`);
    }

    return this.toDescription(rows);
  }

  /** Used by Category/FacetSchema/FacetValueOption before writing a reference. */
  async assertExists(descriptionId: number): Promise<void> {
    const count = await this.prisma.description.count({
      where: { id: descriptionId },
    });
    if (count === 0) {
      throw new BadRequestException(
        `A related Description ${descriptionId} does not exist`,
      );
    }
  }

  async create(
    dto: CreateDescriptionDto,
    actorId: number | null = null,
  ): Promise<Description> {
    const languages = await this.prisma.language.findMany({
      select: { code: true },
      orderBy: { code: 'asc' },
    });
    const codes = languages.map((language) => language.code);
    const provided = Object.keys(dto.translations);

    const missing = codes.filter((code) => !provided.includes(code));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing translations for: ${missing.join(', ')}`,
      );
    }

    const unknown = provided.filter((code) => !codes.includes(code));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown language(s): ${unknown.join(', ')}`,
      );
    }

    const last = await this.prisma.description.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    const id = (last?.id ?? 0) + 1;

    await this.prisma.description.createMany({
      data: codes.map((language) => ({
        id,
        language,
        text: dto.translations[language],
        ...(actorId === null ? {} : { createdBy: actorId }),
      })),
    });

    return this.findOne(id);
  }

  async update(
    id: number,
    dto: UpdateDescriptionDto,
    actorId: number | null = null,
  ): Promise<Description> {
    const rows = await this.prisma.description.findMany({
      where: { id },
      select: { language: true },
    });

    if (rows.length === 0) {
      throw new NotFoundException(`Description ${id} not found`);
    }

    const existing = new Set(rows.map((row) => row.language));
    const unknown = Object.keys(dto.translations ?? {}).filter(
      (language) => !existing.has(language),
    );
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Description ${id} has no translation for: ${unknown.join(', ')}`,
      );
    }

    await this.prisma.$transaction(
      Object.entries(dto.translations ?? {}).map(([language, text]) =>
        this.prisma.description.update({
          where: { id_language: { id, language } },
          data: {
            text,
            ...(actorId === null ? {} : { updatedBy: actorId }),
          },
        }),
      ),
    );

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const count = await this.prisma.description.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException(`Description ${id} not found`);
    }

    const [categories, facetSchemas, facetValueOptions] = await Promise.all([
      this.prisma.category.count({ where: { descriptionId: id } }),
      this.prisma.facetSchema.count({ where: { descriptionId: id } }),
      this.prisma.facetValueOption.count({ where: { descriptionId: id } }),
    ]);

    if (categories + facetSchemas + facetValueOptions > 0) {
      throw new BadRequestException(
        `Description ${id} is still referenced by a category or facet`,
      );
    }

    await this.prisma.description.deleteMany({ where: { id } });
  }
}
