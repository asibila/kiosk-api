import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { CrudService, type CrudDelegate } from '../common/crud.service.js';
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
export class ListingChatThreadsService extends CrudService<
  CreateListingChatThreadDto,
  UpdateListingChatThreadDto,
  ListingChatThread
> {
  constructor(prisma: PrismaService) {
    super(
      prisma.listingChatThread as unknown as CrudDelegate<ListingChatThread>,
      listingChatThreadSelect,
      'ListingChatThread',
    );
  }
}
