import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { CrudService, type CrudDelegate } from '../common/crud.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateInboxListDto } from './dto/create-inbox-list.dto.js';
import type { UpdateInboxListDto } from './dto/update-inbox-list.dto.js';

const inboxListSelect = {
  id: true,
  userId: true,
  ...auditSelect,
} satisfies Prisma.InboxListSelect;

export type InboxList = Prisma.InboxListGetPayload<{
  select: typeof inboxListSelect;
}>;

@Injectable()
export class InboxListsService extends CrudService<
  CreateInboxListDto,
  UpdateInboxListDto,
  InboxList
> {
  constructor(prisma: PrismaService) {
    super(
      prisma.inboxList as unknown as CrudDelegate<InboxList>,
      inboxListSelect,
      'InboxList',
    );
  }
}
