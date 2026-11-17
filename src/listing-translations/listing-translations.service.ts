import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import type { RequestUser } from '../auth/current-user.decorator.js';
import { AccessService } from '../common/access.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpsertListingTranslationDto } from './dto/upsert-listing-translation.dto.js';

const listingTranslationSelect = {
  listingId: true,
  language: true,
  title: true,
  ...auditSelect,
} satisfies Prisma.ListingTranslationSelect;

export type ListingTranslation = Prisma.ListingTranslationGetPayload<{
  select: typeof listingTranslationSelect;
}>;

@Injectable()
export class ListingTranslationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  findAll(listingId?: number): Promise<ListingTranslation[]> {
    return this.prisma.listingTranslation.findMany({
      where: listingId === undefined ? undefined : { listingId },
      select: listingTranslationSelect,
      orderBy: [{ listingId: 'asc' }, { language: 'asc' }],
    });
  }

  async findOne(
    listingId: number,
    language: string,
  ): Promise<ListingTranslation> {
    const row = await this.prisma.listingTranslation.findUnique({
      where: { listingId_language: { listingId, language } },
      select: listingTranslationSelect,
    });

    if (!row) {
      throw new NotFoundException(
        `Listing ${listingId} has no ${language} translation`,
      );
    }

    return row;
  }

  /** Insert a title or replace the existing one for that listing/language. */
  async upsert(
    dto: UpsertListingTranslationDto,
    user: RequestUser,
  ): Promise<ListingTranslation> {
    await this.access.assertListingOwner(dto.listingId, user);
    const actorId = user.id;
    try {
      return await this.prisma.listingTranslation.upsert({
        where: {
          listingId_language: {
            listingId: dto.listingId,
            language: dto.language,
          },
        },
        create: {
          ...dto,
          ...(actorId === null ? {} : { createdBy: actorId }),
        },
        update: {
          title: dto.title,
          ...(actorId === null ? {} : { updatedBy: actorId }),
        },
        select: listingTranslationSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2003':
            throw new BadRequestException(
              'The listing or language does not exist',
            );
          case 'P2025':
            throw new NotFoundException('Listing translation not found');
        }
      }
      throw error;
    }
  }

  async remove(
    listingId: number,
    language: string,
    user: RequestUser,
  ): Promise<void> {
    await this.access.assertListingOwner(listingId, user);
    try {
      await this.prisma.listingTranslation.delete({
        where: { listingId_language: { listingId, language } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Listing ${listingId} has no ${language} translation`,
        );
      }
      throw error;
    }
  }
}
