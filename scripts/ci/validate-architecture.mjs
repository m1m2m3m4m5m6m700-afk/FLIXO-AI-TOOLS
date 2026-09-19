import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/validate-ci-contract.mjs'], {
  stdio: 'inherit',
});
