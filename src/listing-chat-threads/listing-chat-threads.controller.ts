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
    @CurrentUser() user: RequestUser,
  ): Promise<ListingChatThread> {
    return this.listingChatThreadsService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser): Promise<ListingChatThread[]> {
    return this.listingChatThreadsService.findAll(user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ): Promise<ListingChatThread> {
    return this.listingChatThreadsService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateListingChatThreadSchema })
    dto: UpdateListingChatThreadDto,
    @CurrentUser() user: RequestUser,
  ): Promise<ListingChatThread> {
    return this.listingChatThreadsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.listingChatThreadsService.remove(id, user);
  }
}
