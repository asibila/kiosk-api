import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import type { RequestUser } from '../auth/current-user.decorator.js';
import { AccessService } from '../common/access.service.js';
import { rethrowPrismaError } from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateListingChatThreadDto } from './dto/create-listing-chat-thread.dto.js';
import type { UpdateListingChatThreadDto } from './dto/update-listing-chat-thread.dto.js';

const listingChatThreadSelect = {
  id: true,
  listingId: true,
  chatThreadId: true,
  hasUnread: true,
  ...auditSelect,
} satisfies Prisma.ListingChatThreadSelect;

export type ListingChatThread = Prisma.ListingChatThreadGetPayload<{
  select: typeof listingChatThreadSelect;
}>;

@Injectable()
export class ListingChatThreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** Links for the caller's own listings or conversations in their inbox. */
  async findAll(user: RequestUser): Promise<ListingChatThread[]> {
    if (this.access.isAdmin(user)) {
      return this.prisma.listingChatThread.findMany({
        select: listingChatThreadSelect,
        orderBy: { id: 'asc' },
      });
    }

    const threadIds = await this.access.accessibleThreadIds(user);

    return this.prisma.listingChatThread.findMany({
      where: {
        OR: [
          { listing: { userId: user.id } },
          { chatThreadId: { in: threadIds } },
        ],
      },
      select: listingChatThreadSelect,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number, user: RequestUser): Promise<ListingChatThread> {
    const link = await this.findLinkThread(id);
    await this.access.assertThreadParticipant(user, link.chatThreadId);
    return this.readRow(id);
  }

  /** Only the creator of a thread may attach it to a listing. */
  async create(
    dto: CreateListingChatThreadDto,
    user: RequestUser,
  ): Promise<ListingChatThread> {
    await this.access.assertThreadCreator(user, dto.chatThreadId);

    try {
      return await this.prisma.listingChatThread.create({
        data: { ...dto, createdBy: user.id },
        select: listingChatThreadSelect,
      });
    } catch (error) {
      rethrowPrismaError(error, 'ListingChatThread');
    }
  }

  async update(
    id: number,
    dto: UpdateListingChatThreadDto,
    user: RequestUser,
  ): Promise<ListingChatThread> {
    const link = await this.findLinkThread(id);
    await this.access.assertThreadParticipant(user, link.chatThreadId);

    const {
      listingId: _listingId,
      chatThreadId: _chatThreadId,
      ...changes
    } = dto;

    try {
      return await this.prisma.listingChatThread.update({
        where: { id },
        data: { ...changes, updatedBy: user.id },
        select: listingChatThreadSelect,
      });
    } catch (error) {
      rethrowPrismaError(error, 'ListingChatThread');
    }
  }

  async remove(id: number, user: RequestUser): Promise<void> {
    const link = await this.prisma.listingChatThread.findUnique({
      where: { id },
      select: { chatThreadId: true },
    });
    if (!link) return;

    await this.access.assertThreadParticipant(user, link.chatThreadId);
    try {
      await this.prisma.listingChatThread.delete({ where: { id } });
    } catch (error) {
      rethrowPrismaError(error, 'ListingChatThread');
    }
  }

  private async findLinkThread(
    id: number,
  ): Promise<{ chatThreadId: number }> {
    const link = await this.prisma.listingChatThread.findUnique({
      where: { id },
      select: { chatThreadId: true },
    });
    if (!link) throw new NotFoundException(`ListingChatThread ${id} not found`);
    return link;
  }

  private async readRow(id: number): Promise<ListingChatThread> {
    const row = await this.prisma.listingChatThread.findUnique({
      where: { id },
      select: listingChatThreadSelect,
    });
    if (!row) throw new NotFoundException(`ListingChatThread ${id} not found`);
    return row;
  }
}
