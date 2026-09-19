#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-repair-prompts-'));
const memory = path.join(dir, 'memory.json');
const input = path.join(dir, 'input.json');
const report = path.join(dir, 'report.json');
const output = path.join(dir, 'prompts.json');
const markdown = path.join(dir, 'prompts.md');
const sha = 'a'.repeat(40);

fs.writeFileSync(memory, JSON.stringify({
  version: 10,
  cases: [{
    fingerprint: 'known',
    rootCause: 'lint',
    attempts: 2,
    successes: 2,
    failures: 0,
    features: ['lint'],
    rules: ['eslint-unused'],
    outcomes: [{ outcome: 'success', verification: 'exact-sha-proof' }],
  }],
  playbooks: [],
  lessons: [],
  antiLessons: [],
}, null, 2));

const log = 'Error: no-unused-vars in src/example.ts';
fs.writeFileSync(input, JSON.stringify({
  executionSha: sha,
  mainSha: 'b'.repeat(40),
  observedBranch: 'execution',
  workflowRuns: [{
    databaseId: 123,
    workflowName: 'FLIXO Test System',
    status: 'completed',
    conclusion: 'failure',
    headSha: sha,
    createdAt: '2026-09-20T00:00:00Z',
  }, {
    databaseId: 124,
    workflowName: 'FLIXO Test System',
    status: 'completed',
    conclusion: 'failure',
    headSha: sha,
    createdAt: '2026-09-20T00:01:00Z',
  }],
  checkRuns: [],
  logs: { '123': log, '124': log },
}, null, 2));

fs.writeFileSync(report, JSON.stringify({
  status: 'RED_INTERNAL',
  errors: [
    { type: 'REQUIRED_CHECK_RED', runId: 123 },
    { type: 'REQUIRED_CHECK_RED', runId: 124 },
  ],
  externalBlockers: [{
    kind: 'BLOCKED_EXTERNAL',
    checkName: 'Vercel',
    rootCause: 'PROVIDER_RATE_LIMIT_OR_DEPLOYMENT_SERVICE_FAILURE',
  }],
}, null, 2));

const result = spawnSync(process.execPath, [
  'scripts/ci/generate-repair-execution-prompts.mjs',
  input,
  report,
  output,
  markdown,
], {
  cwd: root,
  env: { ...process.env, FLIXO_REPAIR_MEMORY: memory },
  encoding: 'utf8',
});

assert.equal(result.status, 0, result.stderr || result.stdout);
const bundle = JSON.parse(fs.readFileSync(output, 'utf8'));
assert.equal(bundle.executionSha, sha);
assert.equal(bundle.uniqueFailureCount, 1);
assert.equal(bundle.externalBlockerCount, 1);
assert.equal(bundle.promptCount, 2);
assert.match(bundle.prompts[0].prompt, /READ: PROJECTS\.md → المهام\.md → AGENTS\.md/u);
assert.match(bundle.prompts[0].prompt, /Error Memory/u);
assert.match(bundle.prompts[0].prompt, /exact SHA/u);
assert.match(bundle.masterPrompt, /anti-lessons/u);
assert.match(fs.readFileSync(markdown, 'utf8'), /FLIXO Daily Repair Prompt Bundle/u);

fs.rmSync(dir, { recursive: true, force: true });
console.log('REPAIR_EXECUTION_PROMPT_GENERATOR_SELF_TEST=PASS');
