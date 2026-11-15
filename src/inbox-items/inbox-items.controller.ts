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
  createInboxItemSchema,
  type CreateInboxItemDto,
} from './dto/create-inbox-item.dto.js';
import {
  updateInboxItemSchema,
  type UpdateInboxItemDto,
} from './dto/update-inbox-item.dto.js';
import { InboxItemsService, type InboxItem } from './inbox-items.service.js';

@Controller('inbox-items')
export class InboxItemsController {
  constructor(private readonly inboxItemsService: InboxItemsService) {}

  @Post()
  create(
    @Body({ schema: createInboxItemSchema }) dto: CreateInboxItemDto,
    @ActorId() actorId: number | null,
  ): Promise<InboxItem> {
    return this.inboxItemsService.create(dto, actorId);
  }

  @Get()
  findAll(): Promise<InboxItem[]> {
    return this.inboxItemsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<InboxItem> {
    return this.inboxItemsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateInboxItemSchema }) dto: UpdateInboxItemDto,
    @ActorId() actorId: number | null,
  ): Promise<InboxItem> {
    return this.inboxItemsService.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.inboxItemsService.remove(id);
  }
}
