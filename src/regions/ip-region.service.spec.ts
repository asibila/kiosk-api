import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clientIpFromHeaders,
  IpRegionService,
  isPrivateIp,
  normalizeIp,
  parseCountryCode,
} from './ip-region.service.js';

describe('parseCountryCode', () => {
  it('accepts a bare code and the usual JSON keys', () => {
    expect(parseCountryCode('hr\n')).toBe('HR');
    expect(parseCountryCode('{"ip":"1.2.3.4","country":"DE"}')).toBe('DE');
    expect(parseCountryCode('{"country_code":"ba"}')).toBe('BA');
    expect(parseCountryCode('{"countryCode":"me"}')).toBe('ME');
  });

  it('rejects anything without a two-letter code', () => {
    expect(parseCountryCode('')).toBeNull();
    expect(parseCountryCode('not a country')).toBeNull();
    expect(parseCountryCode('{"error":true}')).toBeNull();
  });
});

describe('normalizeIp', () => {
  it('strips the IPv4-mapped prefix and ports', () => {
    expect(normalizeIp('::ffff:81.2.69.142')).toBe('81.2.69.142');
    expect(normalizeIp('81.2.69.142:51234')).toBe('81.2.69.142');
  });

  it('keeps a plain address and drops empty values', () => {
    expect(normalizeIp(' 81.2.69.142 ')).toBe('81.2.69.142');
    expect(normalizeIp('')).toBeNull();
    expect(normalizeIp(null)).toBeNull();
  });
});

describe('isPrivateIp', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '192.168.1.4',
    '172.16.0.1',
    '172.31.255.1',
    '169.254.10.20',
    '100.64.0.1',
    '::1',
    'fd00::1',
    'fe80::1',
  ])('treats %s as private', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it('accepts public addresses', () => {
    expect(isPrivateIp('81.2.69.142')).toBe(false);
    expect(isPrivateIp('2a00:1450:4001:800::200e')).toBe(false);
  });
});

describe('clientIpFromHeaders', () => {
  it('uses the first forwarded address', () => {
    expect(
      clientIpFromHeaders(
        { 'x-forwarded-for': '81.2.69.142, 10.0.0.1' },
        '::1',
      ),
    ).toBe('81.2.69.142');
  });

  it('prefers proxy-specific headers and falls back to the socket', () => {
    expect(
      clientIpFromHeaders({ 'cf-connecting-ip': '81.2.69.142' }, '::1'),
    ).toBe('81.2.69.142');
    expect(clientIpFromHeaders({}, '::1')).toBe('::1');
    expect(clientIpFromHeaders({})).toBeNull();
  });
});

describe('IpRegionService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEO_LOOKUP_URL;
  });

  it('skips private addresses without calling the lookup service', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = new IpRegionService();

    await expect(service.lookup('127.0.0.1')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the country code from the lookup service', async () => {
    const fetchMock = vi.fn(async () => new Response('hr\n', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    process.env.GEO_LOOKUP_URL = 'https://geo.example/{ip}/country/';
    const service = new IpRegionService();

    await expect(service.lookup('81.2.69.142')).resolves.toBe('HR');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://geo.example/81.2.69.142/country/',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('caches a result and a failed lookup', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('DE', { status: 200 }))
      .mockResolvedValueOnce(new Response('not a country', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new IpRegionService();

    await expect(service.lookup('81.2.69.142')).resolves.toBe('DE');
    await expect(service.lookup('81.2.69.142')).resolves.toBe('DE');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(service.lookup('89.160.20.112')).resolves.toBeNull();
    await expect(service.lookup('89.160.20.112')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when the service fails or rejects', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('offline');
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = new IpRegionService();

    await expect(service.lookup('81.2.69.142')).resolves.toBeNull();
  });
});
