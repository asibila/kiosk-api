import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import {
  createListingOutcomeSchema,
  type CreateListingOutcomeDto,
} from './dto/create-listing-outcome.dto.js';
import {
  ListingOutcomesService,
  type ListingOutcome,
} from './listing-outcomes.service.js';

/**
 * Why a listing was removed. The client records this before deleting the
 * listing, so the row keeps the listing's id/category without a foreign key.
 */
@Controller('listing-outcomes')
export class ListingOutcomesController {
  constructor(private readonly listingOutcomesService: ListingOutcomesService) {}

  @Post()
  create(
    @Body({ schema: createListingOutcomeSchema }) dto: CreateListingOutcomeDto,
    @CurrentUser() user: RequestUser | null,
  ): Promise<ListingOutcome> {
    return this.listingOutcomesService.create(dto, user);
  }
}
