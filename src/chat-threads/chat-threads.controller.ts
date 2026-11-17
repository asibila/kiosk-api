import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
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
    @CurrentUser() user: RequestUser,
  ): Promise<ChatThread> {
    return this.chatThreadsService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser): Promise<ChatThread[]> {
    return this.chatThreadsService.findAll(user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ): Promise<ChatThread> {
    return this.chatThreadsService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateChatThreadSchema }) dto: UpdateChatThreadDto,
    @CurrentUser() user: RequestUser,
  ): Promise<ChatThread> {
    return this.chatThreadsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.chatThreadsService.remove(id, user);
  }
}
