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
    @CurrentUser() user: RequestUser,
  ): Promise<InboxItem> {
    return this.inboxItemsService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser): Promise<InboxItem[]> {
    return this.inboxItemsService.findAll(user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ): Promise<InboxItem> {
    return this.inboxItemsService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateInboxItemSchema }) dto: UpdateInboxItemDto,
    @CurrentUser() user: RequestUser,
  ): Promise<InboxItem> {
    return this.inboxItemsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.inboxItemsService.remove(id, user);
  }
}
