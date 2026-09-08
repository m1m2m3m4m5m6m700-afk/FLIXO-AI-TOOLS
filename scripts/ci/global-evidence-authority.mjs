#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const certification = path.join(root, 'scripts/ci/certify.mjs');
const result = spawnSync(process.execPath, [certification], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
