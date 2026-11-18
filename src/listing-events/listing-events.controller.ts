import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import {
  createListingViewSchema,
  type CreateListingViewDto,
} from './dto/create-listing-view.dto.js';
import {
  ListingEventsService,
  type ListingStats,
} from './listing-events.service.js';
import { VISITOR_COOKIE, visitorCookieOptions } from './visitor-cookie.js';

/**
 * Listing statistics. `POST /listings/:id/view` is the beacon fired by the
 * listing page (public, deduped per visitor and day); the stats endpoint is for
 * the owner (and admins).
 */
@Controller('listings')
export class ListingEventsController {
  constructor(private readonly listingEventsService: ListingEventsService) {}

  @Public()
  @Post(':id/view')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordView(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: createListingViewSchema }) dto: CreateListingViewDto,
    @CurrentUser() user: RequestUser | null,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.listingEventsService.recordView({
      listingId: id,
      dto,
      user,
      headers: request.headers,
      setVisitorId: (visitorId) =>
        response.cookie(VISITOR_COOKIE, visitorId, visitorCookieOptions()),
    });
  }

  @Get(':id/stats')
  stats(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser | null,
    @Query('days') days?: string,
  ): Promise<ListingStats> {
    return this.listingEventsService.stats(id, days, user);
  }
}
