import { BadRequestException, NotFoundException } from '@nestjs/common';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ListingImagesService } from './listing-images.service.js';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
  access: vi.fn(),
}));

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
  mimeType: 'image/png',
  size: 4,
  primaryImage: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: 7,
  updatedBy: null,
};

const image = (mimetype = 'image/png', text = 'png!') => {
  const buffer = Buffer.from(text);
  return { mimetype, size: buffer.length, buffer };
};

describe('ListingImagesService', () => {
  let service: ListingImagesService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(unlink).mockResolvedValue(undefined);
    vi.mocked(access).mockResolvedValue(undefined);
    prisma.listingImage.count.mockResolvedValue(0);
    service = new ListingImagesService(prisma as unknown as PrismaService);
  });

  it('creates the uploads directory on module init', async () => {
    await service.onModuleInit();

    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining('uploads'),
      { recursive: true },
    );
  });

  describe('create', () => {
    it('writes a generated file and stores the metadata', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 25 });
      prisma.listingImage.create.mockResolvedValue(row);

      const created = await service.create(25, image(), 7);

      expect(created).toMatchObject({
        id: 1,
        listingId: 25,
        url: '/listing-images/1/file',
      });

      const target = vi.mocked(writeFile).mock.calls[0][0] as string;
      expect(target).toMatch(/[0-9a-f-]{36}\.png$/);
      expect(target).toContain('uploads');
      expect(vi.mocked(writeFile).mock.calls[0][1]).toEqual(
        Buffer.from('png!'),
      );

      expect(prisma.listingImage.create).toHaveBeenCalledWith({
        data: {
          listingId: 25,
          fileName: expect.stringMatching(/[0-9a-f-]{36}\.png$/),
          mimeType: 'image/png',
          size: 4,
          primaryImage: true,
          createdBy: 7,
        },
        select: expect.any(Object),
      });
    });

    it('does not make later images primary automatically', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 25 });
      prisma.listingImage.count.mockResolvedValue(2);
      prisma.listingImage.create.mockResolvedValue({ ...row, primaryImage: false });

      await service.create(25, image(), null);

      expect(prisma.listingImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ primaryImage: false }),
        }),
      );
    });

    it('rejects an unsupported image type without writing anything', async () => {
      await expect(
        service.create(25, image('image/svg+xml'), null),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(writeFile).not.toHaveBeenCalled();
      expect(prisma.listingImage.create).not.toHaveBeenCalled();
    });

    it('rejects an empty upload', async () => {
      await expect(
        service.create(25, image('image/png', ''), null),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown listing', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(service.create(404, image(), null)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('removes the written file when the row cannot be stored', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: 25 });
      prisma.listingImage.create.mockRejectedValue(new Error('db down'));

      await expect(service.create(25, image(), null)).rejects.toThrow(
        'db down',
      );
      expect(unlink).toHaveBeenCalled();
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

      const updated = await service.setPrimary(1, true, 7);

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
      prisma.listingImage.update.mockResolvedValue({ ...row, primaryImage: false });

      await service.setPrimary(1, false, null);

      expect(prisma.listingImage.updateMany).not.toHaveBeenCalled();
      expect(prisma.listingImage.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { primaryImage: false } }),
      );
    });

    it('throws 404 when the image does not exist', async () => {
      prisma.listingImage.findUnique.mockResolvedValue(null);

      await expect(service.setPrimary(404, true, null)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.listingImage.update).not.toHaveBeenCalled();
    });
  });

  describe('getFile', () => {
    it('returns the stored path and metadata', async () => {
      prisma.listingImage.findUnique.mockResolvedValue({
        fileName: 'abc.png',
        mimeType: 'image/png',
        size: 4,
      });

      const file = await service.getFile(1);

      expect(file.mimeType).toBe('image/png');
      expect(file.size).toBe(4);
      expect(file.path).toMatch(/abc\.png$/);
      expect(access).toHaveBeenCalledWith(file.path);
    });

    it('throws 404 when the row does not exist', async () => {
      prisma.listingImage.findUnique.mockResolvedValue(null);

      await expect(service.getFile(404)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws 404 when the file is missing on disk', async () => {
      prisma.listingImage.findUnique.mockResolvedValue({
        fileName: 'gone.png',
        mimeType: 'image/png',
        size: 4,
      });
      vi.mocked(access).mockRejectedValue(new Error('ENOENT'));

      await expect(service.getFile(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes the row and the stored file', async () => {
      prisma.listingImage.findUnique.mockResolvedValue({
        fileName: 'abc.png',
      });

      await service.remove(1);

      expect(prisma.listingImage.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(unlink).toHaveBeenCalledWith(expect.stringMatching(/abc\.png$/));
    });

    it('throws 404 when the row does not exist', async () => {
      prisma.listingImage.findUnique.mockResolvedValue(null);

      await expect(service.remove(404)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.listingImage.delete).not.toHaveBeenCalled();
    });
  });
});
