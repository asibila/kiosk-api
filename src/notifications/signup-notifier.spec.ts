import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { SignupNotifier } from './signup-notifier.service.js';

function createNotifier(values: Record<string, string | undefined> = {}) {
  const config = {
    get: (key: string) => values[key],
  } as unknown as ConfigService;

  return new SignupNotifier(config);
}

const user = {
  id: 12,
  name: 'Pero Perić',
  email: 'pero@example.com',
  createdAt: new Date('2026-11-18T14:32:00.000Z'),
};

describe('SignupNotifier', () => {
  it('does nothing without a webhook URL', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await createNotifier().notify(user);

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('posts a Slack/Discord compatible message', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await createNotifier({
      SIGNUP_WEBHOOK_URL: 'https://hooks.example.com/abc',
      PUBLIC_ORIGIN: 'https://kiosk-ssr.onrender.com',
    }).notify(user);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://hooks.example.com/abc');
    expect(options.method).toBe('POST');

    const body = JSON.parse(String(options.body));
    expect(body.text).toContain('New signup: Pero Perić <pero@example.com>');
    expect(body.text).toContain('#12');
    expect(body.text).toContain('2026-11-18 14:32');
    expect(body.content).toBe(body.text);

    vi.unstubAllGlobals();
  });

  it('never throws when the webhook fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createNotifier({ SIGNUP_WEBHOOK_URL: 'https://hooks.example.com/abc' }).notify(user),
    ).resolves.toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('tolerates a non-2xx answer', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createNotifier({ SIGNUP_WEBHOOK_URL: 'https://hooks.example.com/abc' }).notify(user),
    ).resolves.toBeUndefined();

    vi.unstubAllGlobals();
  });
});
