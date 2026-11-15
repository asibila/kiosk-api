import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { CrudService, type CrudDelegate } from '../common/crud.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateChatThreadDto } from './dto/create-chat-thread.dto.js';
import type { UpdateChatThreadDto } from './dto/update-chat-thread.dto.js';

const chatThreadSelect = {
  id: true,
  ...auditSelect,
} satisfies Prisma.ChatThreadSelect;

export type ChatThread = Prisma.ChatThreadGetPayload<{
  select: typeof chatThreadSelect;
}>;

@Injectable()
export class ChatThreadsService extends CrudService<
  CreateChatThreadDto,
  UpdateChatThreadDto,
  ChatThread
> {
  constructor(prisma: PrismaService) {
    super(
      prisma.chatThread as unknown as CrudDelegate<ChatThread>,
      chatThreadSelect,
      'ChatThread',
    );
  }
}
