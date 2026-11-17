import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RequestUser } from '../auth/current-user.decorator.js';

/**
 * Shared ownership rules. A signed-in user may act on their own listings,
 * conversations they take part in, and their own inbox; admins bypass the
 * ownership checks but not existence checks.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(user: RequestUser | null): boolean {
    return user?.role === 'ADMIN';
  }

  /** Throws unless `user` owns the listing (admins always pass). */
  async assertListingOwner(
    listingId: number,
    user: RequestUser | null,
  ): Promise<{ id: number; userId: number; isActive: boolean }> {
    if (!user) throw new ForbiddenException('Sign in required');

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, userId: true, isActive: true },
    });

    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (!this.isAdmin(user) && listing.userId !== user.id) {
      throw new ForbiddenException('Not the listing owner');
    }

    return listing;
  }

  /** Threads the user takes part in: created by them, their listings, inbox. */
  async accessibleThreadIds(user: RequestUser): Promise<number[]> {
    if (this.isAdmin(user)) {
      const rows = await this.prisma.chatThread.findMany({ select: { id: true } });
      return rows.map((row) => row.id);
    }

    const [created, listingLinks, inboxItems] = await Promise.all([
      this.prisma.chatThread.findMany({
        where: { createdBy: user.id },
        select: { id: true },
      }),
      this.prisma.listingChatThread.findMany({
        where: { listing: { userId: user.id } },
        select: { chatThreadId: true },
      }),
      this.prisma.inboxItem.findMany({
        where: { userId: user.id },
        select: { chatThreadId: true },
      }),
    ]);

    return [
      ...new Set([
        ...created.map((thread) => thread.id),
        ...listingLinks.map((link) => link.chatThreadId),
        ...inboxItems.map((item) => item.chatThreadId),
      ]),
    ];
  }

  async isThreadParticipant(
    user: RequestUser | null,
    threadId: number,
  ): Promise<boolean> {
    if (!user) return false;
    if (this.isAdmin(user)) return true;

    const [thread, inbox, link] = await Promise.all([
      this.prisma.chatThread.findFirst({
        where: { id: threadId, createdBy: user.id },
        select: { id: true },
      }),
      this.prisma.inboxItem.findFirst({
        where: { chatThreadId: threadId, userId: user.id },
        select: { id: true },
      }),
      this.prisma.listingChatThread.findFirst({
        where: { chatThreadId: threadId, listing: { userId: user.id } },
        select: { id: true },
      }),
    ]);

    return Boolean(thread || inbox || link);
  }

  async assertThreadParticipant(
    user: RequestUser | null,
    threadId: number,
  ): Promise<void> {
    if (!(await this.isThreadParticipant(user, threadId))) {
      throw new ForbiddenException('Not a participant in this conversation');
    }
  }

  /**
   * A chat thread may be linked to a listing only by the user who created it
   * (the contact starting the conversation).
   */
  async assertThreadCreator(
    user: RequestUser | null,
    threadId: number,
  ): Promise<void> {
    if (!user) throw new ForbiddenException('Sign in required');

    const thread = await this.prisma.chatThread.findUnique({
      where: { id: threadId },
      select: { createdBy: true },
    });

    if (!thread) throw new NotFoundException(`Chat thread ${threadId} not found`);
    if (!this.isAdmin(user) && thread.createdBy !== user.id) {
      throw new ForbiddenException('Not the creator of this conversation');
    }
  }
}
