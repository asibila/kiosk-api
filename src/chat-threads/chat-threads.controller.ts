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
  createChatThreadSchema,
  type CreateChatThreadDto,
} from './dto/create-chat-thread.dto.js';
import {
  updateChatThreadSchema,
  type UpdateChatThreadDto,
} from './dto/update-chat-thread.dto.js';
import { ChatThreadsService, type ChatThread } from './chat-threads.service.js';

@Controller('chat-threads')
export class ChatThreadsController {
  constructor(private readonly chatThreadsService: ChatThreadsService) {}

  @Post()
  create(
    @Body({ schema: createChatThreadSchema }) dto: CreateChatThreadDto,
    @ActorId() actorId: number | null,
  ): Promise<ChatThread> {
    return this.chatThreadsService.create(dto, actorId);
  }

  @Get()
  findAll(): Promise<ChatThread[]> {
    return this.chatThreadsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ChatThread> {
    return this.chatThreadsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateChatThreadSchema }) dto: UpdateChatThreadDto,
    @ActorId() actorId: number | null,
  ): Promise<ChatThread> {
    return this.chatThreadsService.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.chatThreadsService.remove(id);
  }
}
