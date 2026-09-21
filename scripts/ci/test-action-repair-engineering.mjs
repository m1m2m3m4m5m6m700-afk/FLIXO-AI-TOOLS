#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { buildPatchSynthesisPacket, validatePatchOperation } from './action-patch-synthesis.mjs';
import { simulateRepair } from './action-repair-sandbox.mjs';

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const trackedPath = 'scripts/ci/action-patch-synthesis.mjs';
const anchor = 'const exactSha = (value) => /^[a-f0-9]{40}$/u.test(String(value));';

const operation = {
  path: trackedPath,
  search: anchor,
  replace: anchor + '\n// sandbox-only differential probe',
  rationale: 'verify isolated repair simulation without mutating the source worktree',
};

const candidate = {
  id: 'C1',
  source: 'TEST',
  strategy: 'SANDBOX_DIFFERENTIAL_PROBE',
  exactSha: sha,
  confidence: 0.9,
  operations: [operation],
  predictedChecks: ['node --check scripts/ci/action-patch-synthesis.mjs'],
};

const packet = buildPatchSynthesisPacket({
  taskId: 'test-repair-engineering',
  fingerprint: 'repair-engineering-fingerprint',
  targetSha: sha,
  candidateInputs: [candidate],
});

assert.equal(packet.protocol, 'BOUNDED_PATCH_SYNTHESIS_V1');
assert.equal(packet.candidateCount, 1);
assert.equal(packet.candidates[0].readyToSimulate, true);
assert.throws(() => validatePatchOperation({...operation, path: 'tests/blocked.test.mjs'}), /PROTECTED_PATH/);

const result = simulateRepair({
  repoRoot: process.cwd(),
  taskId: 'test-repair-engineering',
  fingerprint: 'repair-engineering-fingerprint',
  targetSha: sha,
  candidate: packet.candidates[0],
  checks: candidate.predictedChecks,
});

assert.equal(result.protocol, 'REPAIR_SANDBOX_SIMULATION_V1');
assert.equal(result.status, 'PASS');
assert.equal(result.mutationPerformed, false);
assert.equal(result.differential.protocol, 'DIFFERENTIAL_REPAIR_VERIFICATION_V1');
assert.equal(result.differential.status, 'PASS');

console.log('ACTION REPAIR ENGINEERING CONTRACT PASS');
