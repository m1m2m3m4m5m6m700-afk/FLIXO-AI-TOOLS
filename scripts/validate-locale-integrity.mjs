import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['--import=./scripts/register-node-resolver.mjs', '--experimental-strip-types', 'scripts/validate-effective-localization.mjs'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
