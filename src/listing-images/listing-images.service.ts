import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
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

/** Accepted upload types. Every image is re-encoded to WebP before storage. */
const ACCEPTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

/** Largest accepted image, mirrored by the multer limit in the controller. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Longest side kept after resizing; smaller images are not enlarged. */
const MAX_IMAGE_DIMENSION = 1600;
const WEBP_QUALITY = 82;

/**
 * Normalizes an upload to a reasonably sized WebP. Animated GIFs are stored as
 * their first frame, which is fine for listing photos.
 */
async function compressImage(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .rotate() // apply EXIF orientation before stripping metadata
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch {
    throw new BadRequestException('The uploaded file is not a valid image');
  }
}

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
 * Stores listing images compressed as WebP in PostgreSQL (`ListingImageData`),
 * so the bytes survive redeploys and every instance sees the same image. There
 * can be zero or more images per listing.
 */
@Injectable()
export class ListingImagesService {
  constructor(private readonly prisma: PrismaService) {}

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
    if (!ACCEPTED_IMAGE_TYPES.has(file.mimetype)) {
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

    const bytes = new Uint8Array(await compressImage(file.buffer));

    // The first image of a listing becomes its primary image automatically.
    const existingCount = await this.prisma.listingImage.count({
      where: { listingId },
    });

    const row = await this.prisma.listingImage.create({
      data: {
        listingId,
        fileName: `${randomUUID()}.webp`,
        mimeType: 'image/webp',
        size: bytes.length,
        primaryImage: existingCount === 0,
        ...(actorId === null ? {} : { createdBy: actorId }),
        data: { create: { bytes } },
      },
      select: listingImageSelect,
    });
    return toDto(row);
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

  /** Resolves the stored bytes for the binary endpoint. */
  async getFile(id: number): Promise<{
    bytes: Buffer;
    mimeType: string;
    size: number;
  }> {
    const row = await this.prisma.listingImage.findUnique({
      where: { id },
      select: {
        mimeType: true,
        data: { select: { bytes: true } },
      },
    });
    if (!row) throw new NotFoundException(`ListingImage ${id} not found`);
    if (!row.data) {
      throw new NotFoundException(
        `Image data for ListingImage ${id} has not been migrated`,
      );
    }

    const bytes = Buffer.from(row.data.bytes);
    return { bytes, mimeType: row.mimeType, size: bytes.length };
  }

  async remove(id: number): Promise<void> {
    const row = await this.prisma.listingImage.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) throw new NotFoundException(`ListingImage ${id} not found`);

    // ListingImageData cascades with the row.
    await this.prisma.listingImage.delete({ where: { id } });
  }
}
