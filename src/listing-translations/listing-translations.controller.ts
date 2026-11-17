import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import {
  upsertListingTranslationSchema,
  type UpsertListingTranslationDto,
} from './dto/upsert-listing-translation.dto.js';
import {
  ListingTranslationsService,
  type ListingTranslation,
} from './listing-translations.service.js';

@Controller('listing-translations')
export class ListingTranslationsController {
  constructor(
    private readonly listingTranslationsService: ListingTranslationsService,
  ) {}

  /** Upsert one title; safe to call for every language edit. */
  @Post()
  upsert(
    @Body({ schema: upsertListingTranslationSchema })
    dto: UpsertListingTranslationDto,
    @CurrentUser() user: RequestUser,
  ): Promise<ListingTranslation> {
    return this.listingTranslationsService.upsert(dto, user);
  }

  @Public()
  @Get()
  findAll(@Query('listingId') listingId?: string): Promise<ListingTranslation[]> {
    if (listingId === undefined) {
      return this.listingTranslationsService.findAll();
    }

    const id = Number(listingId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('listingId must be a positive integer');
    }
    return this.listingTranslationsService.findAll(id);
  }

  @Public()
  @Get(':listingId/:language')
  findOne(
    @Param('listingId', ParseIntPipe) listingId: number,
    @Param('language') language: string,
  ): Promise<ListingTranslation> {
    return this.listingTranslationsService.findOne(listingId, language);
  }

  @Delete(':listingId/:language')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('listingId', ParseIntPipe) listingId: number,
    @Param('language') language: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.listingTranslationsService.remove(listingId, language, user);
  }
}
