import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import type { RequestUser } from '../auth/current-user.decorator.js';
import { AccessService } from '../common/access.service.js';
import { rethrowPrismaError } from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateListingDto } from './dto/create-listing.dto.js';
import type { UpdateListingDto } from './dto/update-listing.dto.js';

const listingSelect = {
  id: true,
  categoryId: true,
  regionId: true,
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
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async create(dto: CreateListingDto, user: RequestUser): Promise<Listing> {
    try {
      // The owner always comes from the session; a body `userId` is ignored.
      const row = await this.prisma.listing.create({
        data: { ...dto, userId: user.id, createdBy: user.id },
        select: listingSelect,
      });
      // A listing that was just created cannot have selections yet, but
      // orientation, price and year already count as answered questions.
      return this.withFacetsCount({ ...row, _count: { facetValueSelections: 0 } });
    } catch (error) {
      rethrowPrismaError(error, 'Listing');
    }
  }

  /**
   * Public catalog: active listings plus the caller's own drafts. Guests never
   * see somebody else's unpublished listing.
   */
  async findAll(user: RequestUser | null = null): Promise<Listing[]> {
    const where = user
      ? { OR: [{ isActive: true }, { userId: user.id }] }
      : { isActive: true };

    const rows = await this.prisma.listing.findMany({
      where,
      select: listingWithCountSelect,
      orderBy: { id: 'asc' },
    });

    return rows.map((row) => this.withFacetsCount(row));
  }

  async findOne(id: number, user: RequestUser | null = null): Promise<Listing> {
    const row = await this.prisma.listing.findUnique({
      where: { id },
      select: listingWithCountSelect,
    });

    if (!row || (!row.isActive && row.userId !== user?.id)) {
      // A draft is indistinguishable from a missing listing for everyone else.
      throw new NotFoundException(`Listing ${id} not found`);
    }

    return this.withFacetsCount(row);
  }

  async update(
    id: number,
    dto: UpdateListingDto,
    user: RequestUser,
  ): Promise<Listing> {
    await this.access.assertListingOwner(id, user);

    // Ownership is never transferred through an update.
    const { userId: _userId, ...changes } = dto;

    try {
      const row = await this.prisma.listing.update({
        where: { id },
        data: { ...changes, updatedBy: user.id },
        select: listingSelect,
      });
      const selectionCount = await this.prisma.facetValueSelection.count({
        where: { listingId: id },
      });

      return {
        ...row,
        facetsCount: selectionCount + this.fieldAnswerCount(row),
      };
    } catch (error) {
      rethrowPrismaError(error, 'Listing');
    }
  }

  async remove(id: number, user: RequestUser): Promise<void> {
    await this.access.assertListingOwner(id, user);
    try {
      await this.prisma.listing.delete({ where: { id } });
    } catch (error) {
      rethrowPrismaError(error, 'Listing');
    }
  }

  private withFacetsCount({ _count, ...row }: ListingWithCount): Listing {
    return {
      ...row,
      facetsCount: _count.facetValueSelections + this.fieldAnswerCount(row),
    };
  }

  /** Orientation, price and year are interview answers stored on the listing. */
  private fieldAnswerCount(row: {
    orientation: string | null;
    price: number | null;
    year: number | null;
  }): number {
    return (
      (row.orientation != null ? 1 : 0) +
      (row.price != null ? 1 : 0) +
      (row.year != null ? 1 : 0)
    );
  }
}
