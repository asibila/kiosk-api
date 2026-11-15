import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { ChatEventsService } from '../chat-events/chat-events.service.js';
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
  constructor(
    protected readonly prisma: PrismaService,
    private readonly chatEvents: ChatEventsService,
  ) {
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
      const message = await this.delegate.create({ data, select: this.select });

      // Live chat: the recipient's view gets the red unread badge. The listing
      // owner's drawer row (ListingChatThread) is unread when somebody else
      // writes; the other participant's inbox row (InboxItem) is unread when
      // the owner or the other side writes to them. The sender's own row is
      // always cleared because they just wrote.
      const thread = await this.prisma.chatThread.findUnique({
        where: { id: message.threadId },
        include: { listingLink: { include: { listing: true } } },
      });
      const ownerId = thread?.listingLink ? thread.listingLink.listing.userId : null;

      if (ownerId != null) {
        await this.prisma.listingChatThread.update({
          where: { chatThreadId: message.threadId },
          data: { hasUnread: message.userId !== ownerId },
          select: { id: true },
        });
      }

      await this.prisma.inboxItem.updateMany({
        where: { chatThreadId: message.threadId, userId: { not: message.userId } },
        data: { hasUnread: true },
      });
      await this.prisma.inboxItem.updateMany({
        where: { chatThreadId: message.threadId, userId: message.userId },
        data: { hasUnread: false },
      });

      // Live chat: push the saved row to every connected client immediately.
      this.chatEvents.publish({ type: 'message.created', message });
      return message;
    } catch (error) {
      this.rethrow(error);
    }
  }

  async update(
    id: number,
    dto: UpdateChatMessageDto,
    actorId: number | null = null,
  ): Promise<ChatMessage> {
    const message = await super.update(id, dto, actorId);
    this.chatEvents.publish({ type: 'message.updated', message });
    return message;
  }
}
