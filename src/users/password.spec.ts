import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('produces a salted scrypt hash', async () => {
    const hash = await hashPassword('super-secret');

    expect(hash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(hash).not.toContain('super-secret');
  });

  it('uses a different salt for every hash', async () => {
    await expect(hashPassword('super-secret')).resolves.not.toBe(
      await hashPassword('super-secret'),
    );
  });

  it('verifies a matching password', async () => {
    const hash = await hashPassword('super-secret');

    await expect(verifyPassword('super-secret', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password or a malformed hash', async () => {
    const hash = await hashPassword('super-secret');

    await expect(verifyPassword('wrong-secret', hash)).resolves.toBe(false);
    await expect(verifyPassword('super-secret', 'not-a-hash')).resolves.toBe(
      false,
    );
  });
});
