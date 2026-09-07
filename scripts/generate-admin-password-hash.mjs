import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = createInterface({ input, output });
try {
  const password = await rl.question('Admin password: ', { hideEchoBack: true });
  if (password.length < 12 || password.length > 256) {
    throw new Error('Password must be between 12 and 256 characters.');
  }
  const salt = randomBytes(16);
  const N = 16384;
  const r = 8;
  const p = 1;
  const key = scryptSync(password, salt, 64, { N, r, p, maxmem: 128 * N * r + 1024 * 1024 });
  console.log(`ADMIN_PASSWORD_HASH=$scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`);
} finally {
  rl.close();
}
