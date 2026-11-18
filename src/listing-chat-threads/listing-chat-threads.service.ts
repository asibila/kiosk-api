import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import type { RequestUser } from '../auth/current-user.decorator.js';
import { AccessService } from '../common/access.service.js';
import {
  isUniqueConstraintError,
  rethrowPrismaError,
} from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateListingChatThreadDto } from './dto/create-listing-chat-thread.dto.js';
import type { UpdateListingChatThreadDto } from './dto/update-listing-chat-thread.dto.js';

const listingChatThreadSelect = {
  id: true,
  listingId: true,
  chatThreadId: true,
  userId: true,
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

  /**
   * Only the creator of a thread may attach it to a listing. The creator is
   * also the person who initiated the contact, stored as `userId` so the
   * listing owner gets one conversation per interested user.
   *
   * A user has at most one conversation per listing (`userId`, `listingId`),
   * so contacting the same listing again reuses the existing link instead of
   * creating a second one.
   */
  async create(
    dto: CreateListingChatThreadDto,
    user: RequestUser,
  ): Promise<ListingChatThread> {
    await this.access.assertThreadCreator(user, dto.chatThreadId);

    const existing = await this.findByUserAndListing(user.id, dto.listingId);
    if (existing) return existing;

    try {
      return await this.prisma.listingChatThread.create({
        data: { ...dto, userId: user.id, createdBy: user.id },
        select: listingChatThreadSelect,
      });
    } catch (error) {
      // Two simultaneous contacts can race past the lookup above. The unique
      // key then decides and the loser reuses the winner's conversation.
      if (isUniqueConstraintError(error)) {
        const concurrent = await this.findByUserAndListing(
          user.id,
          dto.listingId,
        );
        if (concurrent) return concurrent;
      }
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

  /** The one conversation a user has with a listing, if any. */
  private findByUserAndListing(
    userId: number,
    listingId: number,
  ): Promise<ListingChatThread | null> {
    return this.prisma.listingChatThread.findUnique({
      where: { userId_listingId: { userId, listingId } },
      select: listingChatThreadSelect,
    });
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
