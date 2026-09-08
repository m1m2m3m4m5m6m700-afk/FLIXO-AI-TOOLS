#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const packageLockSha256 = createHash('sha256').update(readFileSync(resolve(root, 'package-lock.json'))).digest('hex');
const testPlanSha256 = createHash('sha256').update(readFileSync(resolve(root, 'scripts/ci/test-plan.json'))).digest('hex');
const assertionRegistrySha256 = createHash('sha256').update(readFileSync(resolve(root, 'scripts/ci/assertion-registry.json'))).digest('hex');
const workflow = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8');
const workflowSha256 = createHash('sha256').update(workflow).digest('hex');
const node = process.version;
const npm = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
const contractVersion = 'MASTER AUTONOMOUS RECOVERY & EXECUTION CONTRACT v5';

if (process.env.EXPECTED_SHA && sha !== process.env.EXPECTED_SHA) throw new Error(`Exact SHA mismatch: HEAD=${sha} EXPECTED_SHA=${process.env.EXPECTED_SHA}`);

const identity = {
  schemaVersion: 1,
  evidenceClass: 'PRIMARY_EXECUTION',
  contractVersion,
  sha,
  workflowSha256,
  testPlanSha256,
  assertionRegistrySha256,
  packageLockSha256,
  runtime: { node, npm },
  runId: process.env.GITHUB_RUN_ID ?? null,
  workflowName: process.env.GITHUB_WORKFLOW ?? null,
  eventName: process.env.GITHUB_EVENT_NAME ?? null,
  createdAt: new Date().toISOString(),
};

mkdirSync(resolve(root, 'diagnostics/certification'), { recursive: true });
writeFileSync(resolve(root, 'diagnostics/certification/run-identity.json'), `${JSON.stringify(identity, null, 2)}\n`);
console.log(JSON.stringify(identity, null, 2));
