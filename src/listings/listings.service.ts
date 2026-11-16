import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { CrudService, type CrudDelegate } from '../common/crud.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateListingDto } from './dto/create-listing.dto.js';
import type { UpdateListingDto } from './dto/update-listing.dto.js';

const listingSelect = {
  id: true,
  categoryId: true,
  orientation: true,
  userId: true,
  isActive: true,
  price: true,
  year: true,
  ...auditSelect,
} satisfies Prisma.ListingSelect;

const listingWithCountSelect = {
  ...listingSelect,
  _count: { select: { facetValueSelections: true } },
} satisfies Prisma.ListingSelect;

export type ListingRow = Prisma.ListingGetPayload<{
  select: typeof listingSelect;
}>;

export type Listing = ListingRow & {
  /** Number of interview questions answered for this listing. */
  facetsCount: number;
};

type ListingWithCount = Prisma.ListingGetPayload<{
  select: typeof listingWithCountSelect;
}>;

@Injectable()
export class ListingsService extends CrudService<
  CreateListingDto,
  UpdateListingDto,
  ListingRow
> {
  constructor(private readonly prisma: PrismaService) {
    super(
      prisma.listing as unknown as CrudDelegate<ListingRow>,
      listingSelect,
      'Listing',
    );
  }

  override async create(
    dto: CreateListingDto,
    actorId: number | null = null,
  ): Promise<Listing> {
    const row = await super.create(dto, actorId);
    // A listing that was just created cannot have selections yet, but price
    // and year already count as answered interview questions.
    return { ...row, facetsCount: this.fieldAnswerCount(row) };
  }

  override async findAll(): Promise<Listing[]> {
    const rows = await this.prisma.listing.findMany({
      select: listingWithCountSelect,
      orderBy: { id: 'asc' },
    });

    return rows.map((row) => this.withFacetsCount(row));
  }

  override async findOne(id: number): Promise<Listing> {
    const row = await this.prisma.listing.findUnique({
      where: { id },
      select: listingWithCountSelect,
    });

    if (!row) {
      throw new NotFoundException(`Listing ${id} not found`);
    }

    return this.withFacetsCount(row);
  }

  override async update(
    id: number,
    dto: UpdateListingDto,
    actorId: number | null = null,
  ): Promise<Listing> {
    const row = await super.update(id, dto, actorId);
    const selectionCount = await this.prisma.facetValueSelection.count({
      where: { listingId: id },
    });

    return { ...row, facetsCount: selectionCount + this.fieldAnswerCount(row) };
  }

  private withFacetsCount({ _count, ...row }: ListingWithCount): Listing {
    return {
      ...row,
      facetsCount: _count.facetValueSelections + this.fieldAnswerCount(row),
    };
  }

  /** Price and year are interview answers stored on the listing itself. */
  private fieldAnswerCount(row: { price: number | null; year: number | null }): number {
    return (row.price != null ? 1 : 0) + (row.year != null ? 1 : 0);
  }
}
