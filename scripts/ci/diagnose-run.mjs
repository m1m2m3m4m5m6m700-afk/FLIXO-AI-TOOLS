#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const run = (script, args = []) => spawnSync(process.execPath, [script, ...args], { cwd: process.cwd(), stdio: 'inherit', env: process.env }).status ?? 1;

run('scripts/ci/capture-execution-context.mjs');
const testStatus = run('scripts/test.mjs', ['--mode=diagnose']);
run('scripts/ci/collect-failure-evidence.mjs');
process.exit(testStatus);
