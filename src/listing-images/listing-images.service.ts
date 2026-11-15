import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Shape of a file uploaded through multer's memory storage. Mirrors the parts
 * of `Express.Multer.File` this module needs, without requiring `@types/multer`.
 */
export interface UploadedImage {
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Accepted image types and the extension used for the stored file. The original
 * upload name is not kept; the stored name is a generated UUID.
 */
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

/** Largest accepted image, mirrored by the multer limit in the controller. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const listingImageSelect = {
  id: true,
  listingId: true,
  mimeType: true,
  size: true,
  primaryImage: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
} satisfies Prisma.ListingImageSelect;

export type ListingImage = Prisma.ListingImageGetPayload<{
  select: typeof listingImageSelect;
}>;

/** Image metadata returned over HTTP; `url` points at the binary endpoint. */
export type ListingImageDto = ListingImage & { url: string };

const toDto = (row: ListingImage): ListingImageDto => ({
  ...row,
  url: `/listing-images/${row.id}/file`,
});

/**
 * Stores listing images on disk (`uploads/listing-images/`) and keeps only the
 * metadata in SQLite. There can be zero or more images per listing.
 */
@Injectable()
export class ListingImagesService implements OnModuleInit {
  private readonly storageDir = join(process.cwd(), 'uploads', 'listing-images');

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await mkdir(this.storageDir, { recursive: true });
  }

  async findAll(listingId?: number): Promise<ListingImageDto[]> {
    const rows = await this.prisma.listingImage.findMany({
      where: listingId === undefined ? undefined : { listingId },
      select: listingImageSelect,
      // The primary image sorts first so UIs can pick the head of the list.
      orderBy: [{ primaryImage: 'desc' }, { id: 'asc' }],
    });
    return rows.map(toDto);
  }

  async findOne(id: number): Promise<ListingImageDto> {
    const row = await this.prisma.listingImage.findUnique({
      where: { id },
      select: listingImageSelect,
    });
    if (!row) throw new NotFoundException(`ListingImage ${id} not found`);
    return toDto(row);
  }

  async create(
    listingId: number,
    file: UploadedImage,
    actorId: number | null,
  ): Promise<ListingImageDto> {
    const extension = EXTENSION_BY_MIME[file.mimetype];
    if (!extension) {
      throw new BadRequestException(
        'Only JPEG, PNG, WebP, GIF or AVIF images are supported',
      );
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('The uploaded file is empty');
    }
    if (file.buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException(
        `Images must be at most ${MAX_IMAGE_BYTES} bytes`,
      );
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);

    // The first image of a listing becomes its primary image automatically.
    const existingCount = await this.prisma.listingImage.count({
      where: { listingId },
    });

    const fileName = `${randomUUID()}${extension}`;
    const target = join(this.storageDir, fileName);
    await writeFile(target, file.buffer);

    try {
      const row = await this.prisma.listingImage.create({
        data: {
          listingId,
          fileName,
          mimeType: file.mimetype,
          size: file.buffer.length,
          primaryImage: existingCount === 0,
          ...(actorId === null ? {} : { createdBy: actorId }),
        },
        select: listingImageSelect,
      });
      return toDto(row);
    } catch (error) {
      // Never leave an orphan file behind when the row cannot be written.
      await unlink(target).catch(() => undefined);
      throw error;
    }
  }

  /**
   * Marks an image as the listing's primary image. Setting it clears the flag
   * on its siblings so a listing has at most one primary image.
   */
  async setPrimary(
    id: number,
    primaryImage: boolean,
    actorId: number | null,
  ): Promise<ListingImageDto> {
    const row = await this.prisma.listingImage.findUnique({
      where: { id },
      select: { listingId: true },
    });
    if (!row) throw new NotFoundException(`ListingImage ${id} not found`);

    if (primaryImage) {
      await this.prisma.listingImage.updateMany({
        where: { listingId: row.listingId },
        data: { primaryImage: false },
      });
    }

    const updated = await this.prisma.listingImage.update({
      where: { id },
      data: {
        primaryImage,
        ...(actorId === null ? {} : { updatedBy: actorId }),
      },
      select: listingImageSelect,
    });
    return toDto(updated);
  }

  /** Resolves the stored file for the streaming endpoint. */
  async getFile(id: number): Promise<{
    path: string;
    mimeType: string;
    size: number;
  }> {
    const row = await this.prisma.listingImage.findUnique({
      where: { id },
      select: { fileName: true, mimeType: true, size: true },
    });
    if (!row) throw new NotFoundException(`ListingImage ${id} not found`);

    const path = join(this.storageDir, row.fileName);
    try {
      await access(path);
    } catch {
      throw new NotFoundException(
        `Image file for ListingImage ${id} is missing on disk`,
      );
    }

    return { path, mimeType: row.mimeType, size: row.size };
  }

  async remove(id: number): Promise<void> {
    const row = await this.prisma.listingImage.findUnique({
      where: { id },
      select: { fileName: true },
    });
    if (!row) throw new NotFoundException(`ListingImage ${id} not found`);

    await this.prisma.listingImage.delete({ where: { id } });
    await unlink(join(this.storageDir, row.fileName)).catch(() => undefined);
  }
}
