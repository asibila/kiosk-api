import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const ALGORITHM = 'scrypt';
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, derivedKey) => {
      if (error) {
        reject(error);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

/**
 * Hashes a plain-text password with scrypt and a random salt.
 * The result is self-describing: `scrypt:<salt>:<key>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = await deriveKey(password, salt);

  return `${ALGORITHM}:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Checks a plain-text password against a hash produced by `hashPassword`.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const [algorithm, salt, key] = hash.split(':');

  if (algorithm !== ALGORITHM || !salt || !key) {
    return false;
  }

  const expectedKey = Buffer.from(key, 'hex');
  const actualKey = await deriveKey(password, salt);

  return (
    expectedKey.length === actualKey.length &&
    timingSafeEqual(expectedKey, actualKey)
  );
}
