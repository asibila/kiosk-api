import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import type { RequestUser } from '../auth/current-user.decorator.js';
import { AccessService } from '../common/access.service.js';
import { rethrowPrismaError } from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateInboxItemDto } from './dto/create-inbox-item.dto.js';
import type { UpdateInboxItemDto } from './dto/update-inbox-item.dto.js';

const inboxItemSelect = {
  id: true,
  userId: true,
  chatThreadId: true,
  hasUnread: true,
  ...auditSelect,
} satisfies Prisma.InboxItemSelect;

export type InboxItem = Prisma.InboxItemGetPayload<{
  select: typeof inboxItemSelect;
}>;

@Injectable()
export class InboxItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** An inbox is private: everyone only sees their own rows. */
  findAll(user: RequestUser): Promise<InboxItem[]> {
    return this.prisma.inboxItem.findMany({
      where: { userId: user.id },
      select: inboxItemSelect,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number, user: RequestUser): Promise<InboxItem> {
    const row = await this.prisma.inboxItem.findUnique({
      where: { id },
      select: inboxItemSelect,
    });
    if (!row) throw new NotFoundException(`InboxItem ${id} not found`);
    if (!this.access.isAdmin(user) && row.userId !== user.id) {
      throw new ForbiddenException('Not your inbox');
    }
    return row;
  }

  /** The row always belongs to the caller; a body `userId` is ignored. */
  async create(dto: CreateInboxItemDto, user: RequestUser): Promise<InboxItem> {
    await this.access.assertThreadParticipant(user, dto.chatThreadId);

    try {
      return await this.prisma.inboxItem.create({
        data: { ...dto, userId: user.id, createdBy: user.id },
        select: inboxItemSelect,
      });
    } catch (error) {
      rethrowPrismaError(error, 'InboxItem');
    }
  }

  async update(
    id: number,
    dto: UpdateInboxItemDto,
    user: RequestUser,
  ): Promise<InboxItem> {
    await this.findOne(id, user);
    const { userId: _userId, chatThreadId: _chatThreadId, ...changes } = dto;

    try {
      return await this.prisma.inboxItem.update({
        where: { id },
        data: { ...changes, updatedBy: user.id },
        select: inboxItemSelect,
      });
    } catch (error) {
      rethrowPrismaError(error, 'InboxItem');
    }
  }

  async remove(id: number, user: RequestUser): Promise<void> {
    await this.findOne(id, user);
    try {
      await this.prisma.inboxItem.delete({ where: { id } });
    } catch (error) {
      rethrowPrismaError(error, 'InboxItem');
    }
  }
}
