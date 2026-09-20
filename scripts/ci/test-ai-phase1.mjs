#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildCiOrchestrationPlan, buildCanonicalRepairContext, buildPhase1Report, guardExecutionIdentity, failureIntelligence, verifyCanonicalRepairContext } from './auto-repair/ai-phase1.mjs';

const intelligence = failureIntelligence('Error: TS2322 at src/example.ts:10:5');
assert.equal(intelligence.evidencePresent, true);
assert.ok(intelligence.fingerprint);
assert.ok(intelligence.normalizedFailure);

const clean = guardExecutionIdentity({
  expectedSha: 'a'.repeat(40),
  currentSha: 'a'.repeat(40),
  remoteSha: 'a'.repeat(40),
  branch: 'execution',
});
assert.equal(clean.ok, true);

const moved = guardExecutionIdentity({
  expectedSha: 'a'.repeat(40),
  currentSha: 'b'.repeat(40),
  remoteSha: 'a'.repeat(40),
  branch: 'execution',
});
assert.equal(moved.ok, false);
assert.ok(moved.failures.includes('LOCAL_SHA_MISMATCH'));

const orchestration = buildCiOrchestrationPlan({
  impact: {
    escalation: 'L2',
    changedFiles: ['src/example.ts'],
    affectedContracts: ['CI-TOOLCHAIN-001'],
    reasons: ['source changed'],
  },
  targetSelection: {
    exact: true,
    commands: [['npx', ['playwright', 'test', 'tests/example.spec.ts', '--grep', 'example']]],
  },
});
assert.equal(orchestration.mode, 'TARGETED_PLUS_STATIC_BUILD');
assert.equal(orchestration.dispatchAuthority, 'DAILY_FLIXO_GREEN_GATE');
assert.equal(orchestration.canonicalCiRequired, true);
assert.ok(orchestration.plannedCommands.length >= 2);

const report = buildPhase1Report({
  mode: 'UNIT',
  log: 'failure',
  expectedSha: 'a'.repeat(40),
  currentSha: 'a'.repeat(40),
  remoteSha: 'a'.repeat(40),
  branch: 'execution',
  targetSelection: { exact: true, commands: [] },
  targetIdentity: { ok: true },
  changedFiles: ['scripts/ci/auto-repair/foo.mjs'],
});
assert.equal(report.concurrencyGuard.ok, true);
assert.equal(report.impact.escalation, 'L3');
assert.equal(report.ciOrchestration.canonicalCiRequired, true);
assert.equal(report.schemaVersion, 2);
assert.equal(report.canonicalRepairContext.sourceSha, 'a'.repeat(40));
assert.equal(verifyCanonicalRepairContext(report.canonicalRepairContext).ok, true);
const context = buildCanonicalRepairContext({
  mode: 'POSTFLIGHT',
  expectedSha: 'a'.repeat(40),
  branch: 'execution',
  failureIntelligence: report.failureIntelligence,
  targetSelection: report.exactTargeting.selection,
  targetIdentity: report.exactTargeting.identity,
  impact: report.impact,
  orchestration: report.ciOrchestration,
});
assert.equal(verifyCanonicalRepairContext(context).ok, true);

console.log('AI_PHASE1_SELF_TEST=PASS');
