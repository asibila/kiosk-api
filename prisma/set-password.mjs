// Set a new password for an existing account.
//
//   node prisma/set-password.mjs <email> <new-password>
//
// Uses the same scrypt format as `src/users/password.ts` (`scrypt:<salt>:<key>`),
// so the account can sign in with `POST /auth/login` afterwards. Nothing else on
// the account changes: listings, chats, role and the admin flag stay as they are.
//
// Point DATABASE_URL at the database you want to change (for example Render's
// "External Database URL") and run it from the backend directory.
import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MIN_LENGTH = 8;

const [emailArg, password] = process.argv.slice(2);

if (!emailArg || !password) {
  console.error('Usage: node prisma/set-password.mjs <email> <new-password>');
  process.exit(1);
}

if (password.length < MIN_LENGTH) {
  console.error(`Password must be at least ${MIN_LENGTH} characters.`);
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, role: true },
  });

  if (!user) {
    console.error(`No account with email ${email}.`);
    process.exitCode = 1;
  } else {
    const salt = randomBytes(SALT_LENGTH).toString('hex');
    const key = await deriveKey(password, salt, KEY_LENGTH);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: `scrypt:${salt}:${key.toString('hex')}` },
    });

    console.log(
      `Password updated for ${email} (user ${user.id}, ${user.name}, ${user.role}).`,
    );
  }
} finally {
  await prisma.$disconnect();
}
