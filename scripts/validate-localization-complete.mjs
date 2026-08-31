import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const requestedLocale = process.env.FLIXO_LOCALE ?? args.find((value) => /^[a-z]{2}$/u.test(value));
const forwardedArgs = [];

if (requestedLocale) forwardedArgs.push(requestedLocale);

const result = spawnSync(
  process.execPath,
  ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/validate-effective-localization.mjs', ...forwardedArgs],
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
