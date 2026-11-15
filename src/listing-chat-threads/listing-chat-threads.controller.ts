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
  createListingChatThreadSchema,
  type CreateListingChatThreadDto,
} from './dto/create-listing-chat-thread.dto.js';
import {
  updateListingChatThreadSchema,
  type UpdateListingChatThreadDto,
} from './dto/update-listing-chat-thread.dto.js';
import {
  ListingChatThreadsService,
  type ListingChatThread,
} from './listing-chat-threads.service.js';

@Controller('listing-chat-threads')
export class ListingChatThreadsController {
  constructor(
    private readonly listingChatThreadsService: ListingChatThreadsService,
  ) {}

  @Post()
  create(
    @Body({ schema: createListingChatThreadSchema })
    dto: CreateListingChatThreadDto,
    @ActorId() actorId: number | null,
  ): Promise<ListingChatThread> {
    return this.listingChatThreadsService.create(dto, actorId);
  }

  @Get()
  findAll(): Promise<ListingChatThread[]> {
    return this.listingChatThreadsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ListingChatThread> {
    return this.listingChatThreadsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateListingChatThreadSchema })
    dto: UpdateListingChatThreadDto,
    @ActorId() actorId: number | null,
  ): Promise<ListingChatThread> {
    return this.listingChatThreadsService.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.listingChatThreadsService.remove(id);
  }
}
