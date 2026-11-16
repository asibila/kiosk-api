import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { CrudService, type CrudDelegate } from '../common/crud.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateListingDto } from './dto/create-listing.dto.js';
import type { UpdateListingDto } from './dto/update-listing.dto.js';

const listingSelect = {
  id: true,
  categoryId: true,
  orientation: true,
  userId: true,
  isActive: true,
  ...auditSelect,
} satisfies Prisma.ListingSelect;

export type Listing = Prisma.ListingGetPayload<{
  select: typeof listingSelect;
}>;

@Injectable()
export class ListingsService extends CrudService<
  CreateListingDto,
  UpdateListingDto,
  Listing
> {
  constructor(prisma: PrismaService) {
    super(
      prisma.listing as unknown as CrudDelegate<Listing>,
      listingSelect,
      'Listing',
    );
  }
}
