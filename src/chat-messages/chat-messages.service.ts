import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { ChatEventsService } from '../chat-events/chat-events.service.js';
import type { RequestUser } from '../auth/current-user.decorator.js';
import { AccessService } from '../common/access.service.js';
import { rethrowPrismaError } from '../common/prisma-errors.js';
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
export class ChatMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatEvents: ChatEventsService,
    private readonly access: AccessService,
  ) {}

  /** Messages of threads the caller takes part in, or one accessible thread. */
  async findAll(user: RequestUser, threadId?: number): Promise<ChatMessage[]> {
    if (threadId !== undefined) {
      await this.access.assertThreadParticipant(user, threadId);
      return this.prisma.chatMessage.findMany({
        where: { threadId },
        select: chatMessageSelect,
        orderBy: { id: 'asc' },
      });
    }

    const ids = await this.access.accessibleThreadIds(user);
    if (ids.length === 0) return [];

    return this.prisma.chatMessage.findMany({
      where: { threadId: { in: ids } },
      select: chatMessageSelect,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number, user: RequestUser): Promise<ChatMessage> {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id },
      select: chatMessageSelect,
    });
    if (!message) throw new NotFoundException(`ChatMessage ${id} not found`);

    await this.access.assertThreadParticipant(user, message.threadId);
    return message;
  }

  async create(dto: CreateChatMessageDto, user: RequestUser): Promise<ChatMessage> {
    await this.access.assertThreadParticipant(user, dto.threadId);

    try {
      // The sender is always the signed-in user; a body `userId` is ignored.
      const message = await this.prisma.chatMessage.create({
        data: { ...dto, userId: user.id, createdBy: user.id },
        select: chatMessageSelect,
      });

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

      this.chatEvents.publish({ type: 'message.created', message });
      return message;
    } catch (error) {
      rethrowPrismaError(error, 'ChatMessage');
    }
  }

  async update(
    id: number,
    dto: UpdateChatMessageDto,
    user: RequestUser,
  ): Promise<ChatMessage> {
    const row = await this.prisma.chatMessage.findUnique({
      where: { id },
      select: { userId: true, threadId: true },
    });
    if (!row) throw new NotFoundException(`ChatMessage ${id} not found`);
    await this.access.assertThreadParticipant(user, row.threadId);
    if (!this.access.isAdmin(user) && row.userId !== user.id) {
      throw new ForbiddenException('Only the sender can edit a message');
    }

    try {
      const message = await this.prisma.chatMessage.update({
        where: { id },
        data: { ...dto, updatedBy: user.id },
        select: chatMessageSelect,
      });
      this.chatEvents.publish({ type: 'message.updated', message });
      return message;
    } catch (error) {
      rethrowPrismaError(error, 'ChatMessage');
    }
  }

  async remove(id: number, user: RequestUser): Promise<void> {
    const row = await this.prisma.chatMessage.findUnique({
      where: { id },
      select: { userId: true, threadId: true },
    });
    if (!row) return;
    await this.access.assertThreadParticipant(user, row.threadId);
    if (!this.access.isAdmin(user) && row.userId !== user.id) {
      throw new ForbiddenException('Only the sender can delete a message');
    }

    try {
      await this.prisma.chatMessage.delete({ where: { id } });
    } catch (error) {
      rethrowPrismaError(error, 'ChatMessage');
    }
  }
}
