import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const result = spawnSync(
  process.execPath,
  ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/validate-effective-localization.mjs', ...args],
  { stdio: 'inherit', env: process.env },
);

if (result.error) {
  console.error(`Localization validator failed to start: ${result.error.message}`);
  process.exit(1);
}

if (result.signal) {
  console.error(`Localization validator terminated by signal: ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
