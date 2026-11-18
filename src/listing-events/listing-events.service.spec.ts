import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../auth/current-user.decorator.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ListingEventsService, dayKey, utcDay } from './listing-events.service.js';

const owner: RequestUser = {
  id: 1,
  name: 'Ana',
  email: 'ana@example.com',
  role: 'USER',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const visitor = {
  id: 7,
  name: 'Pero',
  email: 'pero@example.com',
  role: 'USER',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

type ListingRow = { id: number; userId: number; isActive: boolean } | null;

type CreateManyArgs = {
  data: Record<string, unknown>[];
  skipDuplicates?: boolean;
};

function createService({
  listing = { id: 42, userId: 1, isActive: true } as ListingRow,
  series = [] as { day: Date; _count: { _all: number } }[],
  views = 0,
  contacts = 0,
} = {}) {
  const prisma = {
    listing: {
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) =>
        listing && listing.id === where.id ? listing : null,
      ),
    },
    listingEvent: {
      createMany: vi.fn(async (_args: CreateManyArgs) => ({ count: 1 })),
      count: vi.fn(async () => views),
      groupBy: vi.fn(async () => series),
    },
    listingChatThread: { count: vi.fn(async () => contacts) },
  };

  return {
    service: new ListingEventsService(prisma as unknown as PrismaService),
    prisma,
  };
}

const headers = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/131' };

function record(service: ListingEventsService, overrides = {}) {
  const setVisitorId = vi.fn();
  const promise = service.recordView({
    listingId: 42,
    dto: {},
    user: null,
    headers,
    setVisitorId,
    ...overrides,
  });

  return { promise, setVisitorId };
}

describe('ListingEventsService.recordView', () => {
  it('counts a guest view and sets the visitor cookie once', async () => {
    const { service, prisma } = createService()
    const { promise, setVisitorId } = record(service)

    await expect(promise).resolves.toBe(true)
    expect(prisma.listingEvent.createMany).toHaveBeenCalledOnce()
    expect(setVisitorId).toHaveBeenCalledOnce()
    expect(setVisitorId.mock.calls[0][0]).toMatch(/^[a-f0-9]{32}$/)

    const [{ data, skipDuplicates }] = prisma.listingEvent.createMany.mock.calls[0]
    expect(skipDuplicates).toBe(true)
    expect(data[0]).toMatchObject({ listingId: 42, type: 'view', day: utcDay() })
  })

  it('reuses the visitor id from the cookie', async () => {
    const { service, prisma } = createService()
    const visitorId = 'a'.repeat(32)
    const { promise, setVisitorId } = record(service, {
      headers: { ...headers, cookie: `kiosk_visitor=${visitorId}; other=1` },
    })

    await promise
    expect(setVisitorId).not.toHaveBeenCalled()
    expect(prisma.listingEvent.createMany.mock.calls[0][0].data[0].visitorId).toBe(visitorId)
  })

  it('ignores crawlers, prefetches and link previews', async () => {
    const { service, prisma } = createService()

    await record(service, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    }).promise
    await record(service, {
      headers: { ...headers, 'sec-purpose': 'prefetch;prerender' },
    }).promise
    await record(service, {
      headers: { 'user-agent': 'Slackbot-LinkExpanding 1.0' },
    }).promise

    expect(prisma.listingEvent.createMany).not.toHaveBeenCalled()
  })

  it('does not count the owner', async () => {
    const { service, prisma } = createService()
    const { promise, setVisitorId } = record(service, { user: owner })

    await expect(promise).resolves.toBe(false)
    expect(prisma.listingEvent.createMany).not.toHaveBeenCalled()
    expect(setVisitorId).not.toHaveBeenCalled()
  })

  it('counts another signed-in user', async () => {
    const { service, prisma } = createService()
    await expect(record(service, { user: visitor }).promise).resolves.toBe(true)
    expect(prisma.listingEvent.createMany).toHaveBeenCalledOnce()
  })

  it('ignores unknown and unpublished listings', async () => {
    for (const listing of [null, { id: 42, userId: 1, isActive: false }]) {
      const { service, prisma } = createService({ listing: listing as ListingRow })
      await expect(record(service).promise).resolves.toBe(false)
      expect(prisma.listingEvent.createMany).not.toHaveBeenCalled()
    }
  })

  it('records the source and language from the beacon', async () => {
    const { service, prisma } = createService()
    await record(service, { dto: { source: 'search', language: 'hr' } }).promise

    expect(prisma.listingEvent.createMany.mock.calls[0][0].data[0]).toMatchObject({
      source: 'search',
      language: 'hr',
    })
  })
})

describe('ListingEventsService.stats', () => {
  const today = utcDay()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

  it('fills the window, totals views and counts contacts', async () => {
    const { service } = createService({
      series: [
        { day: today, _count: { _all: 3 } },
        { day: yesterday, _count: { _all: 2 } },
      ],
      views: 9,
      contacts: 3,
    })

    const stats = await service.stats(42, '14', owner)

    expect(stats.days).toHaveLength(14)
    expect(stats.days.at(-1)).toEqual({ date: dayKey(today), views: 3 })
    expect(stats.days.at(-2)).toEqual({ date: dayKey(yesterday), views: 2 })
    expect(stats.days.slice(0, 12).every((day) => day.views === 0)).toBe(true)
    expect(stats.totals).toEqual({ views: 9, viewsInWindow: 5, contacts: 3 })
    expect(stats.contactRate).toBe(0.333)
  })

  it('clamps the window and defaults to 14 days', async () => {
    const { service } = createService()

    expect((await service.stats(42, '0', owner)).days).toHaveLength(14)
    expect((await service.stats(42, 'abc', owner)).days).toHaveLength(14)
    expect((await service.stats(42, '500', owner)).days).toHaveLength(90)
    expect((await service.stats(42, '7', owner)).days).toHaveLength(7)
  })

  it('rejects guests and other users, and 404s an unknown listing', async () => {
    const { service } = createService()

    await expect(service.stats(42, '14', null)).rejects.toThrow(/Sign in/)
    await expect(service.stats(42, '14', visitor)).rejects.toThrow(/owner/)
    await expect(service.stats(999, '14', owner)).rejects.toThrow(/not found/)
  })

  it('lets an admin read any listing', async () => {
    const admin = { ...owner, id: 99, role: 'ADMIN' }
    const { service } = createService()

    await expect(service.stats(42, '14', admin)).resolves.toMatchObject({
      listingId: 42,
    })
  })

  it('reports a zero rate without views', async () => {
    const { service } = createService({ views: 0, contacts: 0 })
    expect((await service.stats(42, '14', owner)).contactRate).toBe(0)
  })
})
