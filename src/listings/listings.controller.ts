import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import {
  createListingSchema,
  type CreateListingDto,
} from './dto/create-listing.dto.js';
import {
  updateListingSchema,
  type UpdateListingDto,
} from './dto/update-listing.dto.js';
import { ListingsService, type Listing } from './listings.service.js';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  create(
    @Body({ schema: createListingSchema }) dto: CreateListingDto,
    @CurrentUser() user: RequestUser,
  ): Promise<Listing> {
    return this.listingsService.create(dto, user);
  }

  @Public()
  @Get()
  findAll(@CurrentUser() user: RequestUser | null): Promise<Listing[]> {
    return this.listingsService.findAll(user);
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser | null,
  ): Promise<Listing> {
    return this.listingsService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateListingSchema }) dto: UpdateListingDto,
    @CurrentUser() user: RequestUser,
  ): Promise<Listing> {
    return this.listingsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.listingsService.remove(id, user);
  }
}
