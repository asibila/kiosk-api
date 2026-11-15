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
  createInboxListSchema,
  type CreateInboxListDto,
} from './dto/create-inbox-list.dto.js';
import {
  updateInboxListSchema,
  type UpdateInboxListDto,
} from './dto/update-inbox-list.dto.js';
import { InboxListsService, type InboxList } from './inbox-lists.service.js';

@Controller('inbox-lists')
export class InboxListsController {
  constructor(private readonly inboxListsService: InboxListsService) {}

  @Post()
  create(
    @Body({ schema: createInboxListSchema }) dto: CreateInboxListDto,
    @ActorId() actorId: number | null,
  ): Promise<InboxList> {
    return this.inboxListsService.create(dto, actorId);
  }

  @Get()
  findAll(): Promise<InboxList[]> {
    return this.inboxListsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<InboxList> {
    return this.inboxListsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateInboxListSchema }) dto: UpdateInboxListDto,
    @ActorId() actorId: number | null,
  ): Promise<InboxList> {
    return this.inboxListsService.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.inboxListsService.remove(id);
  }
}
