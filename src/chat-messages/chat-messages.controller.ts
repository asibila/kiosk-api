import {
  BadRequestException,
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
  Query,
} from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import {
  createChatMessageSchema,
  type CreateChatMessageDto,
} from './dto/create-chat-message.dto.js';
import {
  updateChatMessageSchema,
  type UpdateChatMessageDto,
} from './dto/update-chat-message.dto.js';
import { ChatMessagesService, type ChatMessage } from './chat-messages.service.js';

@Controller('chat-messages')
export class ChatMessagesController {
  constructor(private readonly chatMessagesService: ChatMessagesService) {}

  @Post()
  create(
    @Body({ schema: createChatMessageSchema }) dto: CreateChatMessageDto,
    @CurrentUser() user: RequestUser,
  ): Promise<ChatMessage> {
    return this.chatMessagesService.create(dto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query('threadId') threadId?: string,
  ): Promise<ChatMessage[]> {
    if (threadId === undefined) {
      return this.chatMessagesService.findAll(user);
    }

    const parsed = Number(threadId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException('threadId must be a positive integer');
    }
    return this.chatMessagesService.findAll(user, parsed);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ): Promise<ChatMessage> {
    return this.chatMessagesService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateChatMessageSchema }) dto: UpdateChatMessageDto,
    @CurrentUser() user: RequestUser,
  ): Promise<ChatMessage> {
    return this.chatMessagesService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.chatMessagesService.remove(id, user);
  }
}
