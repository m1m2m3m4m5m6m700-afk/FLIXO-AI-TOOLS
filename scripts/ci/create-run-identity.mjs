#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const sha256 = (file) => createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex');
const testDefinitionFiles = [
  '.github/workflows/ci.yml',
  'scripts/ci/test-plan.json',
  'scripts/ci/assertion-registry.json',
  'package.json',
  'package-lock.json',
  '.nvmrc',
  'playwright.config.ts',
];
const testDefinitionSha256 = createHash('sha256')
  .update(testDefinitionFiles.map((file) => `${file}:${sha256(file)}`).join('\\n'), 'utf8')
  .digest('hex');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const node = process.version;
const npm = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
const contractVersion = 'MASTER AUTONOMOUS RECOVERY & EXECUTION CONTRACT v5';
const expectedSha = (process.env.EXPECTED_SHA ?? '').trim();

if (expectedSha && !/^[0-9a-f]{40}$/iu.test(expectedSha)) {
  throw new Error('EXPECTED_SHA must be a 40-character Git SHA');
}
if (expectedSha && sha !== expectedSha) {
  throw new Error(`Exact SHA mismatch: HEAD=${sha} EXPECTED_SHA=${expectedSha}`);
}

const identity = {
  schemaVersion: 4,
  rerunContract: 'LATEST_COMMIT_ONLY_RERUN_LOCK_V2',
  runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  evidenceClass: 'PRIMARY_EXECUTION',
  contractVersion,
  sha,
  expectedSha: expectedSha || null,
  exactShaBound: Boolean(expectedSha && sha === expectedSha),
  repository: process.env.GITHUB_REPOSITORY ?? null,
  ref: process.env.GITHUB_REF ?? null,
  headRef: process.env.GITHUB_HEAD_REF ?? null,
  sourceEventSha: process.env.GITHUB_SHA ?? null,
  testDefinitionFiles,
  testDefinitionSha256,
  workflowSha256: sha256('.github/workflows/ci.yml'),
  testPlanSha256: sha256('scripts/ci/test-plan.json'),
  assertionRegistrySha256: sha256('scripts/ci/assertion-registry.json'),
  packageLockSha256: sha256('package-lock.json'),
  runtime: { node, npm },
  runId: process.env.GITHUB_RUN_ID ?? null,
  workflowName: process.env.GITHUB_WORKFLOW ?? null,
  eventName: process.env.GITHUB_EVENT_NAME ?? null,
  createdAt: new Date().toISOString(),
};

mkdirSync(resolve(root, 'diagnostics/certification'), { recursive: true });
writeFileSync(resolve(root, 'diagnostics/certification/run-identity.json'), `${JSON.stringify(identity, null, 2)}\n`);
console.log(JSON.stringify(identity, null, 2));
