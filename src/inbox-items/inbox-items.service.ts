import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { CrudService, type CrudDelegate } from '../common/crud.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateInboxItemDto } from './dto/create-inbox-item.dto.js';
import type { UpdateInboxItemDto } from './dto/update-inbox-item.dto.js';

const inboxItemSelect = {
  id: true,
  listId: true,
  chatThreadId: true,
  ...auditSelect,
} satisfies Prisma.InboxItemSelect;

export type InboxItem = Prisma.InboxItemGetPayload<{
  select: typeof inboxItemSelect;
}>;

@Injectable()
export class InboxItemsService extends CrudService<
  CreateInboxItemDto,
  UpdateInboxItemDto,
  InboxItem
> {
  constructor(prisma: PrismaService) {
    super(
      prisma.inboxItem as unknown as CrudDelegate<InboxItem>,
      inboxItemSelect,
      'InboxItem',
    );
  }
}
