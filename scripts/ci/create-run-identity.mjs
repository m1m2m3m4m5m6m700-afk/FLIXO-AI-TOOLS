#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const sha256 = (file) => createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const node = process.version;
const npm = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
const contractVersion = 'MASTER AUTONOMOUS RECOVERY & EXECUTION CONTRACT v5';

if (process.env.EXPECTED_SHA && sha !== process.env.EXPECTED_SHA) {
  throw new Error(`Exact SHA mismatch: HEAD=${sha} EXPECTED_SHA=${process.env.EXPECTED_SHA}`);
}

const identity = {
  schemaVersion: 2,
  evidenceClass: 'PRIMARY_EXECUTION',
  contractVersion,
  sha,
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
