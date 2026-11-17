import { Injectable, Logger } from '@nestjs/common';

/**
 * IP → country lookup used to pick the search region.
 *
 * The app has no bundled GeoIP database, so the country is resolved through a
 * small HTTP service. The lookup is best-effort: private addresses (local dev)
 * and failed lookups return `null`, and the caller falls back to the global
 * "All regions" row. Results are cached in memory, never persisted, so repeat
 * visits from one address do not hit the external service on every render.
 *
 * `GEO_LOOKUP_URL` overrides the endpoint and may contain `{ip}`; without it the
 * request URL is the value itself followed by the address. The response can be
 * a bare two-letter code or JSON with `country`, `country_code` or
 * `countryCode`.
 */
export const DEFAULT_GEO_LOOKUP_URL = 'https://api.country.is/{ip}';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 2000;
const LOOKUP_TIMEOUT_MS = 2500;

/** Remove an IPv4/IPv6 port or an IPv4-mapped prefix from a socket address. */
export function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;

  let ip = String(value).trim();
  if (!ip) return null;

  if (ip.startsWith('::ffff:')) ip = ip.slice('::ffff:'.length);

  const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(ip);
  if (withPort) ip = withPort[1];

  return ip || null;
}

/**
 * Addresses that cannot be geolocated: loopback, private LAN ranges, link-local
 * and carrier-grade NAT. Local development and in-cluster calls land here.
 */
export function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip === '127.0.0.1' || ip === '0.0.0.0' || ip === '::') {
    return true;
  }
  if (/^127\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return true;
  if (/^fe[89ab][0-9a-f]:/i.test(ip)) return true;
  return false;
}

/**
 * First usable address from the proxy headers, then the socket address.
 * Render and most proxies send `x-forwarded-for`; `x-real-ip` and
 * `cf-connecting-ip` are accepted for other deployments.
 */
export function clientIpFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  fallback: string | null = null,
): string | null {
  const first = (value: string | string[] | undefined): string | null => {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw?.split(',')[0]?.trim() || null;
  };

  return (
    first(headers['cf-connecting-ip']) ??
    first(headers['x-real-ip']) ??
    first(headers['x-forwarded-for']) ??
    fallback
  );
}

/** First two-letter country code found in a plain-text or JSON response. */
export function parseCountryCode(body: string): string | null {
  const text = String(body ?? '').trim();
  if (/^[A-Za-z]{2}$/.test(text)) return text.toUpperCase();

  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    for (const key of ['country', 'country_code', 'countryCode']) {
      const value = json?.[key];
      if (typeof value === 'string' && /^[A-Za-z]{2}$/.test(value.trim())) {
        return value.trim().toUpperCase();
      }
    }
  } catch {
    // Not JSON; no usable country code.
  }

  return null;
}

@Injectable()
export class IpRegionService {
  private readonly logger = new Logger(IpRegionService.name);
  private readonly cache = new Map<
    string,
    { code: string | null; expiresAt: number }
  >();

  /** ISO country code for an address, or `null` when it cannot be resolved. */
  async lookup(ip: string | null | undefined): Promise<string | null> {
    const address = normalizeIp(ip);
    if (!address || isPrivateIp(address)) return null;

    const cached = this.cache.get(address);
    if (cached && cached.expiresAt > Date.now()) return cached.code;

    const code = await this.fetchCountry(address);
    this.remember(address, code);
    return code;
  }

  /** Drops the in-memory cache. Used by tests. */
  clearCache(): void {
    this.cache.clear();
  }

  private async fetchCountry(ip: string): Promise<string | null> {
    const template = process.env.GEO_LOOKUP_URL?.trim() || DEFAULT_GEO_LOOKUP_URL;
    const url = template.includes('{ip}')
      ? template.replace('{ip}', encodeURIComponent(ip))
      : `${template}${encodeURIComponent(ip)}`;

    try {
      const response = await fetch(url, {
        headers: { accept: 'text/plain' },
        signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      });
      if (!response.ok) return null;

      return parseCountryCode(await response.text());
    } catch (error) {
      this.logger.debug(
        `Region lookup failed for ${ip}: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }

  private remember(ip: string, code: string | null): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      this.cache.clear();
    }
    this.cache.set(ip, { code, expiresAt: Date.now() + CACHE_TTL_MS });
  }
}
