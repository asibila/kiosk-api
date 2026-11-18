import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { RequestUser } from '../auth/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateListingViewDto } from './dto/create-listing-view.dto.js';
import { readVisitorId } from './visitor-cookie.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;

/**
 * Requests that execute the page but are not a human looking at it: crawlers,
 * link previews, uptime checks, Lighthouse, and prefetch/prerender hints.
 * Googlebot matches `bot`, so its JS-executed visits never inflate the counts.
 */
const BOT_PATTERN =
  /bot\b|bot[_-]|crawl|spider|slurp|headless|preview|prefetch|prerender|lighthouse|monitor|uptime|facebookexternalhit|slackbot|discordbot|telegrambot|whatsapp|bingpreview|yandex|baidu|duckduck/i;

/** Headers the view beacon reads. Values are normalized to strings. */
export type ViewHeaders = Record<string, string | string[] | undefined>;

function header(headers: ViewHeaders, name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

/** UTC midnight of the given day: the value stored in `ListingEvent.day`. */
export function utcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** `YYYY-MM-DD` for a date or a `DATE` column value. */
export function dayKey(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function clampDays(raw: string | undefined): number {
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1) return DEFAULT_DAYS;
  return Math.min(days, MAX_DAYS);
}

export type ListingStats = {
  listingId: number;
  days: { date: string; views: number }[];
  totals: { views: number; viewsInWindow: number; contacts: number };
  contactRate: number;
};

/**
 * Counts listing page views and reads them back for the owner.
 *
 * One row per listing, type, visitor and UTC day: the unique index turns a
 * refresh (or React's double effect in development) into a no-op. The visitor id
 * is a random cookie value — no IPs, no user agents, no session tokens.
 */
@Injectable()
export class ListingEventsService {
  constructor(private readonly prisma: PrismaService) {}

  isBot(userAgent: string): boolean {
    return BOT_PATTERN.test(userAgent);
  }

  isPrefetch(headers: ViewHeaders): boolean {
    const purpose = [
      header(headers, 'sec-purpose'),
      header(headers, 'purpose'),
      header(headers, 'x-purpose'),
      header(headers, 'sec-fetch-mode'),
    ]
      .join(' ')
      .toLowerCase();

    return /prefetch|prerender|preview/.test(purpose);
  }

  /**
   * Record one view. Returns `true` when a row was considered (whether or not it
   * was a duplicate), `false` when the request was ignored.
   */
  async recordView({
    listingId,
    dto,
    user,
    headers,
    setVisitorId,
  }: {
    listingId: number;
    dto: CreateListingViewDto;
    user: RequestUser | null;
    headers: ViewHeaders;
    setVisitorId: (visitorId: string) => void;
  }): Promise<boolean> {
    if (this.isBot(header(headers, 'user-agent'))) return false;
    if (this.isPrefetch(headers)) return false;

    // Only published listings are counted; drafts are private.
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, userId: true, isActive: true },
    });
    if (!listing || listing.isActive === false) return false;

    // The owner browsing their own ad is not a view.
    if (user && user.id === listing.userId) return false;

    // The cookie is only written once per visitor; the id itself never leaves
    // the server (the beacon sends no visitor id).
    const existing = header(headers, 'cookie');
    let visitorId = readVisitorId(existing);
    if (!visitorId) {
      visitorId = randomBytes(16).toString('hex');
      setVisitorId(visitorId);
    }

    await this.prisma.listingEvent.createMany({
      data: [
        {
          listingId,
          type: 'view',
          visitorId,
          day: utcDay(),
          source: dto.source ?? null,
          language: dto.language ?? null,
        },
      ],
      skipDuplicates: true,
    });

    return true;
  }

  /** Per-day views, all-time views and contacts for one listing. Owner or admin. */
  async stats(
    listingId: number,
    daysRaw: string | undefined,
    user: RequestUser | null,
  ): Promise<ListingStats> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, userId: true },
    });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (!user) throw new ForbiddenException('Sign in required');
    if (user.role !== 'ADMIN' && listing.userId !== user.id) {
      throw new ForbiddenException('Not the listing owner');
    }

    const days = clampDays(daysRaw);
    const start = new Date(utcDay().getTime() - (days - 1) * DAY_MS);

    const [series, views, contacts] = await Promise.all([
      this.prisma.listingEvent.groupBy({
        by: ['day'],
        where: { listingId, type: 'view', day: { gte: start } },
        _count: { _all: true },
      }),
      this.prisma.listingEvent.count({ where: { listingId, type: 'view' } }),
      this.prisma.listingChatThread.count({ where: { listingId } }),
    ]);

    const counted = new Map(
      series.map((row) => [dayKey(row.day), row._count._all] as const),
    );

    const daysOut = Array.from({ length: days }, (_, index) => {
      const date = dayKey(new Date(start.getTime() + index * DAY_MS));
      return { date, views: counted.get(date) ?? 0 };
    });
    const viewsInWindow = daysOut.reduce((sum, day) => sum + day.views, 0);

    return {
      listingId,
      days: daysOut,
      totals: { views, viewsInWindow, contacts },
      // Contacts per view, rounded to three decimals (0 when nobody looked).
      contactRate: views > 0 ? Math.round((contacts / views) * 1000) / 1000 : 0,
    };
  }
}
