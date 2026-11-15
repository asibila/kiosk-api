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
import { ActorId } from '../audit/actor-id.decorator.js';
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
    @ActorId() actorId: number | null,
  ): Promise<Listing> {
    return this.listingsService.create(dto, actorId);
  }

  @Get()
  findAll(): Promise<Listing[]> {
    return this.listingsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Listing> {
    return this.listingsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateListingSchema }) dto: UpdateListingDto,
    @ActorId() actorId: number | null,
  ): Promise<Listing> {
    return this.listingsService.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.listingsService.remove(id);
  }
}
