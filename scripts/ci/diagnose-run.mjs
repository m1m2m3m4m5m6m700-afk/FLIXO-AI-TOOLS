#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['scripts/test.mjs', '--mode=diagnose'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
