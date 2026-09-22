#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const sha = process.env.EXPECTED_SHA ?? '';
const identityPath = 'diagnostics/certification/run-identity.json';
const identity = JSON.parse(readFileSync(identityPath, 'utf8'));
const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

if (identity.sha !== sha) throw new Error(`Run SHA mismatch: ${identity.sha} != ${sha}`);
if (identity.rerunContract !== 'LATEST_COMMIT_ONLY_RERUN_LOCK_V1') throw new Error('Missing immutable rerun contract');
if (identity.workflowSha256 !== hash('.github/workflows/ci.yml')) throw new Error('Workflow definition changed during run');
if (identity.testPlanSha256 !== hash('scripts/ci/test-plan.json')) throw new Error('Test plan changed during run');
if (identity.assertionRegistrySha256 !== hash('scripts/ci/assertion-registry.json')) throw new Error('Assertion registry changed during run');
if (identity.packageLockSha256 !== hash('package-lock.json')) throw new Error('Package lock changed during run');

console.log(`RERUN_LOCK_VERIFIED=1 SHA=${sha} RUN_ID=${identity.runId ?? 'unknown'} ATTEMPT=${identity.runAttempt ?? 'unknown'}`);
