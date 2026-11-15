import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { CrudService, type CrudData, type CrudDelegate } from '../common/crud.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateChatMessageDto } from './dto/create-chat-message.dto.js';
import type { UpdateChatMessageDto } from './dto/update-chat-message.dto.js';

const chatMessageSelect = {
  id: true,
  text: true,
  threadId: true,
  userId: true,
  ...auditSelect,
} satisfies Prisma.ChatMessageSelect;

export type ChatMessage = Prisma.ChatMessageGetPayload<{
  select: typeof chatMessageSelect;
}>;

@Injectable()
export class ChatMessagesService extends CrudService<
  CreateChatMessageDto,
  UpdateChatMessageDto,
  ChatMessage
> {
  constructor(prisma: PrismaService) {
    super(
      prisma.chatMessage as unknown as CrudDelegate<ChatMessage>,
      chatMessageSelect,
      'ChatMessage',
    );
  }

  async create(dto: CreateChatMessageDto, actorId: number | null = null): Promise<ChatMessage> {
    // The user which creates a message is the user sending it; the acting user
    // is the currently logged-in user when the payload does not name one.
    const data = { ...dto, userId: dto.userId ?? actorId } as CrudData;

    if (actorId !== null) {
      data.createdBy = actorId;
    }

    try {
      return await this.delegate.create({ data, select: this.select });
    } catch (error) {
      this.rethrow(error);
    }
  }
}
