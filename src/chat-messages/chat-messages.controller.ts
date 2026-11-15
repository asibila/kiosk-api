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
  createChatMessageSchema,
  type CreateChatMessageDto,
} from './dto/create-chat-message.dto.js';
import {
  updateChatMessageSchema,
  type UpdateChatMessageDto,
} from './dto/update-chat-message.dto.js';
import {
  ChatMessagesService,
  type ChatMessage,
} from './chat-messages.service.js';

@Controller('chat-messages')
export class ChatMessagesController {
  constructor(private readonly chatMessagesService: ChatMessagesService) {}

  @Post()
  create(
    @Body({ schema: createChatMessageSchema }) dto: CreateChatMessageDto,
    @ActorId() actorId: number | null,
  ): Promise<ChatMessage> {
    return this.chatMessagesService.create(dto, actorId);
  }

  @Get()
  findAll(): Promise<ChatMessage[]> {
    return this.chatMessagesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ChatMessage> {
    return this.chatMessagesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateChatMessageSchema }) dto: UpdateChatMessageDto,
    @ActorId() actorId: number | null,
  ): Promise<ChatMessage> {
    return this.chatMessagesService.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.chatMessagesService.remove(id);
  }
}
