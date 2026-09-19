#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-auto-repair-external-worktree-'));
const controlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-auto-repair-external-control-'));
const logPath = path.join(controlDir, 'failure.log');
const memoryPath = path.join(controlDir, 'memory.json');
const intractablePath = path.join(controlDir, 'intractable.json');
const evidencePath = path.join(controlDir, 'evidence.json');
const diagnosisPath = path.join(controlDir, 'diagnosis.json');

fs.writeFileSync(logPath, [
  'Code scanning AI findings on PR #745',
  'Error creating PR review request: SessionModelError: Execution failed: CAPIError: 400 The requested model is not supported.',
].join('\n'));
fs.writeFileSync(memoryPath, JSON.stringify({ version: 7, cases: [], playbooks: [], lessons: [], antiLessons: [] }) + '\n');
fs.writeFileSync(intractablePath, JSON.stringify({ version: 1, threshold: 3, protocol: 'SUPERVISING-REPAIR-TEACHING-v1', cases: [] }) + '\n');

execFileSync('git', ['init', '-q'], { cwd: tempDir });
execFileSync('git', ['config', 'user.name', 'flixo-test'], { cwd: tempDir });
execFileSync('git', ['config', 'user.email', 'flixo-test@example.invalid'], { cwd: tempDir });
fs.writeFileSync(path.join(tempDir, 'baseline.txt'), 'clean\n');
execFileSync('git', ['add', '.'], { cwd: tempDir });
execFileSync('git', ['commit', '-q', '-m', 'baseline'], { cwd: tempDir });

const result = spawnSync(process.execPath, ['scripts/ci/auto-repair-engine.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    FLIXO_FAILURE_LOG: logPath,
    FLIXO_REPAIR_MEMORY: memoryPath,
    FLIXO_INTRACTABLE_ERRORS: intractablePath,
    FLIXO_REPAIR_EVIDENCE_PATH: evidencePath,
    FLIXO_REPAIR_DIAGNOSIS_PATH: diagnosisPath,
    FLIXO_TARGET_DIR: tempDir,
  },
  encoding: 'utf8',
});

assert.equal(result.status, 0, result.stderr || result.stdout);
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
assert.equal(evidence.outcome, 'blocked-external');
assert.equal(evidence.externalTooling.sourceMutationAllowed, false);
assert.equal(evidence.escalation.reason, 'external-tooling-failure');
assert.equal(execFileSync('git', ['-C', tempDir, 'status', '--porcelain'], { encoding: 'utf8' }), '');

const memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
assert(memory.antiLessons.some((item) => item.fingerprint === evidence.fingerprint && item.rootCause === 'external-tooling'));
const externalCase = memory.cases.find((item) => item.fingerprint === evidence.fingerprint);
assert.equal(externalCase?.attempts, 0);
assert.equal(externalCase?.failures, 0);
assert.equal(externalCase?.externalBlocks, 1);

console.log('AUTO_REPAIR_EXTERNAL_GUARD_SELF_TEST=PASS');
