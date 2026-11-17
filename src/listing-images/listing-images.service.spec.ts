import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../auth/current-user.decorator.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  ListingImagesService,
  MAX_IMAGE_BYTES,
} from './listing-images.service.js';

/** Smallest valid 1×1 PNG used as upload input. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const prisma = {
  listing: { findUnique: vi.fn() },
  listingImage: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
};

const row = {
  id: 1,
  listingId: 25,
  mimeType: 'image/webp',
  size: 96,
  primaryImage: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: 7,
  updatedBy: null,
};

const image = (mimetype = 'image/png', buffer = PNG) => ({
  mimetype,
  size: buffer.length,
  buffer,
});

const user = { id: 7, role: 'USER' } as RequestUser;

const access = {
  assertListingOwner: vi.fn(async () => ({ id: 25, userId: 7, isActive: true })),
};

describe('ListingImagesService', () => {
  let service: ListingImagesService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.listingImage.count.mockResolvedValue(0);
    service = new ListingImagesService(
      prisma as unknown as PrismaService,
      access as never,
    );
  });

  describe('create', () => {
    it('compresses the upload to WebP and stores the bytes in the row', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 25 });
      prisma.listingImage.create.mockResolvedValue(row);

      const created = await service.create(25, image(), user);

      expect(created).toEqual({
        ...row,
        url: '/listing-images/1/file',
      });

      const args = prisma.listingImage.create.mock.calls[0][0];
      expect(args.data).toMatchObject({
        listingId: 25,
        mimeType: 'image/webp',
        size: expect.any(Number),
        primaryImage: true,
        createdBy: 7,
      });
      expect(args.data.fileName).toMatch(/[0-9a-f-]{36}\.webp$/);
      expect(args.data.size).toBeGreaterThan(0);

      const bytes = args.data.data.create.bytes as Uint8Array;
      expect(bytes).toBeInstanceOf(Uint8Array);
      const header = Buffer.from(bytes);
      expect(header.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(header.subarray(8, 12).toString('ascii')).toBe('WEBP');
      expect(args.data.size).toBe(bytes.length);
    });

    it('does not make later images primary automatically', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 25 });
      prisma.listingImage.count.mockResolvedValue(2);
      prisma.listingImage.create.mockResolvedValue({
        ...row,
        primaryImage: false,
      });

      await service.create(25, image(), user);

      expect(prisma.listingImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ primaryImage: false }),
        }),
      );
    });

    it('rejects an unsupported image type without touching the database', async () => {
      await expect(
        service.create(25, image('image/svg+xml'), user),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.listingImage.create).not.toHaveBeenCalled();
    });

    it('rejects an empty upload', async () => {
      await expect(
        service.create(25, image('image/png', Buffer.alloc(0)), user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an oversized upload', async () => {
      await expect(
        service.create(
          25,
          image('image/png', Buffer.alloc(MAX_IMAGE_BYTES + 1)),
          user,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.listingImage.create).not.toHaveBeenCalled();
    });

    it('rejects a file whose bytes are not an image', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 25 });

      await expect(
        service.create(25, image('image/png', Buffer.from('not an image')), user),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.listingImage.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown listing', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(service.create(404, image(), user)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.listingImage.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('filters by listing and adds the binary url', async () => {
      prisma.listingImage.findMany.mockResolvedValue([row]);

      await expect(service.findAll(25)).resolves.toEqual([
        { ...row, url: '/listing-images/1/file' },
      ]);
      expect(prisma.listingImage.findMany).toHaveBeenCalledWith({
        where: { listingId: 25 },
        select: expect.any(Object),
        orderBy: [{ primaryImage: 'desc' }, { id: 'asc' }],
      });
    });

    it('returns every image when no listing is given', async () => {
      prisma.listingImage.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.listingImage.findMany).toHaveBeenCalledWith({
        where: undefined,
        select: expect.any(Object),
        orderBy: [{ primaryImage: 'desc' }, { id: 'asc' }],
      });
    });
  });

  describe('setPrimary', () => {
    it('clears the flag on siblings and marks the chosen image', async () => {
      prisma.listingImage.findUnique.mockResolvedValue({ listingId: 25 });
      prisma.listingImage.update.mockResolvedValue(row);

      const updated = await service.setPrimary(1, true, user);

      expect(updated).toMatchObject({ id: 1, primaryImage: true });
      expect(prisma.listingImage.updateMany).toHaveBeenCalledWith({
        where: { listingId: 25 },
        data: { primaryImage: false },
      });
      expect(prisma.listingImage.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { primaryImage: true, updatedBy: 7 },
        select: expect.any(Object),
      });
    });

    it('does not clear siblings when unmarking', async () => {
      prisma.listingImage.findUnique.mockResolvedValue({ listingId: 25 });
      prisma.listingImage.update.mockResolvedValue({
        ...row,
        primaryImage: false,
      });

      await service.setPrimary(1, false, user);

      expect(prisma.listingImage.updateMany).not.toHaveBeenCalled();
      expect(prisma.listingImage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { primaryImage: false, updatedBy: 7 },
        }),
      );
    });

    it('throws 404 when the image does not exist', async () => {
      prisma.listingImage.findUnique.mockResolvedValue(null);

      await expect(service.setPrimary(404, true, user)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.listingImage.update).not.toHaveBeenCalled();
    });
  });

  describe('getFile', () => {
    it('returns the stored bytes and their metadata', async () => {
      const bytes = Buffer.from('webp-bytes');
      prisma.listingImage.findUnique.mockResolvedValue({
        mimeType: 'image/webp',
        data: { bytes },
      });

      const file = await service.getFile(1);

      expect(file.mimeType).toBe('image/webp');
      expect(file.bytes).toEqual(bytes);
      expect(file.size).toBe(bytes.length);
    });

    it('throws 404 when the row does not exist', async () => {
      prisma.listingImage.findUnique.mockResolvedValue(null);

      await expect(service.getFile(404)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws 404 when the row has no stored bytes', async () => {
      prisma.listingImage.findUnique.mockResolvedValue({
        mimeType: 'image/webp',
        data: null,
      });

      await expect(service.getFile(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes the row, cascading to its bytes', async () => {
      prisma.listingImage.findUnique.mockResolvedValue({ id: 1, listingId: 25 });

      await service.remove(1, user);

      expect(prisma.listingImage.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('throws 404 when the row does not exist', async () => {
      prisma.listingImage.findUnique.mockResolvedValue(null);

      await expect(service.remove(404, user)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.listingImage.delete).not.toHaveBeenCalled();
    });
  });
});
