import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import type { RequestUser } from '../auth/current-user.decorator.js';
import { AccessService } from '../common/access.service.js';
import { rethrowPrismaError } from '../common/prisma-errors.js';
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
export class ChatThreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async create(dto: CreateChatThreadDto, user: RequestUser): Promise<ChatThread> {
    try {
      return await this.prisma.chatThread.create({
        data: { ...dto, createdBy: user.id },
        select: chatThreadSelect,
      });
    } catch (error) {
      rethrowPrismaError(error, 'ChatThread');
    }
  }

  /** Only threads the caller takes part in are listed. */
  async findAll(user: RequestUser): Promise<ChatThread[]> {
    const ids = await this.access.accessibleThreadIds(user);
    if (ids.length === 0) return [];

    return this.prisma.chatThread.findMany({
      where: { id: { in: ids } },
      select: chatThreadSelect,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number, user: RequestUser): Promise<ChatThread> {
    await this.access.assertThreadParticipant(user, id);
    return this.readRow(id);
  }

  async update(
    id: number,
    dto: UpdateChatThreadDto,
    user: RequestUser,
  ): Promise<ChatThread> {
    await this.access.assertThreadParticipant(user, id);
    try {
      return await this.prisma.chatThread.update({
        where: { id },
        data: { ...dto, updatedBy: user.id },
        select: chatThreadSelect,
      });
    } catch (error) {
      rethrowPrismaError(error, 'ChatThread');
    }
  }

  async remove(id: number, user: RequestUser): Promise<void> {
    await this.access.assertThreadParticipant(user, id);
    try {
      await this.prisma.chatThread.delete({ where: { id } });
    } catch (error) {
      rethrowPrismaError(error, 'ChatThread');
    }
  }

  private async readRow(id: number): Promise<ChatThread> {
    const row = await this.prisma.chatThread.findUnique({
      where: { id },
      select: chatThreadSelect,
    });
    if (!row) throw new NotFoundException(`ChatThread ${id} not found`);
    return row;
  }
}
