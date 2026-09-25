#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-boundary-diff-'));
const scriptsDir = path.join(temp, 'scripts', 'ci');
fs.mkdirSync(scriptsDir, { recursive: true });

try {
  for (const file of ['validate-auto-repair-boundary.mjs', 'control-plane-registry.mjs']) {
    fs.copyFileSync(path.join(root, 'scripts', 'ci', file), path.join(scriptsDir, file));
  }

  const runGit = (...args) => execFileSync('git', args, { cwd: temp, stdio: 'pipe' });
  runGit('init', '-q');
  runGit('config', 'user.email', 'flixo-boundary-test@example.invalid');
  runGit('config', 'user.name', 'FLIXO Boundary Test');
  fs.writeFileSync(path.join(temp, 'base.txt'), 'base\n');
  runGit('add', 'base.txt');
  runGit('commit', '-qm', 'base');
  runGit('switch', '-C', 'execution');

  fs.writeFileSync(path.join(temp, 'staged-probe.mjs'), 'export default {};\n');
  runGit('add', 'staged-probe.mjs');

  const validator = path.join(scriptsDir, 'validate-auto-repair-boundary.mjs');
  const output = execFileSync(process.execPath, [validator, '--diff-only'], { cwd: temp, encoding: 'utf8' });
  const result = JSON.parse(output);
  assert.equal(result.status, 'PASS');
  assert.equal(result.changedFiles, 1);
  assert.ok(result.changedLines >= 1);

  console.log('AUTO_REPAIR_BOUNDARY_DIFF_REGRESSION=PASS');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
