import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FRONTEND_ORIGINS,
  frontendOrigins,
  primaryFrontendOrigin,
} from './frontend-origins.js';

describe('frontendOrigins', () => {
  it('falls back to the deployed defaults', () => {
    expect(frontendOrigins({})).toEqual(DEFAULT_FRONTEND_ORIGINS);
  });

  it('parses the configured list and trims values', () => {
    expect(
      frontendOrigins({ FRONTEND_ORIGINS: 'https://a.test/ , https://b.test' }),
    ).toEqual(['https://a.test', 'https://b.test']);
  });
});

describe('primaryFrontendOrigin', () => {
  it('prefers PUBLIC_ORIGIN and drops a trailing slash', () => {
    expect(
      primaryFrontendOrigin({
        PUBLIC_ORIGIN: 'https://kiosk.example.com/',
        FRONTEND_ORIGINS: 'https://other.test',
      }),
    ).toBe('https://kiosk.example.com');
  });

  it('never returns localhost when a deployed default exists', () => {
    expect(primaryFrontendOrigin({})).toBe('https://kiosk-ssr.onrender.com');
  });

  it('uses the first HTTPS entry of a custom list', () => {
    expect(
      primaryFrontendOrigin({
        FRONTEND_ORIGINS: 'http://localhost:5173,https://shop.test',
      }),
    ).toBe('https://shop.test');
  });

  it('keeps a localhost-only configuration usable for development', () => {
    expect(
      primaryFrontendOrigin({ FRONTEND_ORIGINS: 'http://localhost:5173' }),
    ).toBe('http://localhost:5173');
  });
});
