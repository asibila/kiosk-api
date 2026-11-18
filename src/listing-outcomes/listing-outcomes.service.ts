import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessService } from '../common/access.service.js';
import type { RequestUser } from '../auth/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateListingOutcomeDto } from './dto/create-listing-outcome.dto.js';

const listingOutcomeSelect = {
  id: true,
  listingId: true,
  userId: true,
  categoryId: true,
  outcome: true,
  finalPrice: true,
  createdAt: true,
} satisfies Prisma.ListingOutcomeSelect;

export type ListingOutcome = Prisma.ListingOutcomeGetPayload<{
  select: typeof listingOutcomeSelect;
}>;

/**
 * The question set depends on the listing: a "sell" ad ends sold (or not),
 * while a "buy" ad ends purchased (or not). Mixing them is rejected.
 */
const OUTCOMES_BY_ORIENTATION: Record<string, ReadonlySet<string>> = {
  sell: new Set(['sold', 'sale_fell_through', 'kept', 'gave_away']),
  buy: new Set(['purchased', 'purchase_fell_through', 'no_longer_needed', 'bought_elsewhere']),
};

/** Outcomes that may carry the price actually paid. */
const PRICED_OUTCOMES = new Set(['sold', 'purchased']);

/**
 * Records what happened to a listing when its owner deletes it. The row has no
 * foreign keys so it outlives the deleted listing.
 */
@Injectable()
export class ListingOutcomesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async create(
    dto: CreateListingOutcomeDto,
    user: RequestUser | null,
  ): Promise<ListingOutcome> {
    if (!user) throw new ForbiddenException('Sign in required');

    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      select: { id: true, userId: true, categoryId: true, orientation: true },
    });

    if (!listing) {
      throw new NotFoundException(`Listing ${dto.listingId} not found`);
    }
    if (!this.access.isAdmin(user) && listing.userId !== user.id) {
      throw new ForbiddenException('Not the listing owner');
    }

    const allowed = OUTCOMES_BY_ORIENTATION[listing.orientation];
    if (!allowed?.has(dto.outcome)) {
      throw new BadRequestException(
        `Outcome ${dto.outcome} does not apply to a ${listing.orientation} listing`,
      );
    }

    return this.prisma.listingOutcome.create({
      data: {
        listingId: listing.id,
        userId: listing.userId,
        categoryId: listing.categoryId,
        outcome: dto.outcome,
        finalPrice: PRICED_OUTCOMES.has(dto.outcome)
          ? (dto.finalPrice ?? null)
          : null,
      },
      select: listingOutcomeSelect,
    });
  }
}
