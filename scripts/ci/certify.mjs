#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const target = path.join(root, 'scripts/ci/certify-core.mjs');
const result = spawnSync(process.execPath, [target], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
