#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildPatchSynthesisPacket, validatePatchOperation } from './action-patch-synthesis.mjs';
import { verifyDifferential } from './action-differential-verifier.mjs';

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

const op = {
  path: 'scripts/ci/action-repair-engineering-scratch.mjs',
  search: 'REPAIR_ENGINEERING_SENTINEL_V1',
  replace: 'REPAIR_ENGINEERING_SENTINEL_V2',
  rationale: 'contract test',
};
const scratch = op.path;
fs.writeFileSync(scratch, 'export const marker = "REPAIR_ENGINEERING_SENTINEL_V1";\n');
try {
  const packet = buildPatchSynthesisPacket({
    taskId: 'test-repair-engineering',
    fingerprint: 'repair-engineering-fingerprint',
    targetSha: sha,
    candidateInputs: [{
      id: 'C1',
      source: 'TEST',
      strategy: 'SENTINEL_REPLACEMENT',
      exactSha: sha,
      confidence: 0.9,
      operations: [op],
      predictedChecks: ['node --check scripts/ci/action-repair-engineering-scratch.mjs'],
    }],
  });
  assert.equal(packet.protocol, 'BOUNDED_PATCH_SYNTHESIS_V1');
  assert.equal(packet.candidateCount, 1);
  assert.equal(packet.candidates[0].readyToSimulate, true);
  assert.throws(() => validatePatchOperation({...op, path: 'tests/blocked.test.mjs'}), /PROTECTED_PATH/);

  fs.writeFileSync(scratch, 'export const marker = "REPAIR_ENGINEERING_SENTINEL_V1";\n');
  const before = fs.readFileSync(scratch, 'utf8');
  fs.writeFileSync(scratch, before.replace(op.search, op.replace));
  const differential = verifyDifferential({
    repoRoot: process.cwd(),
    targetSha: sha,
    candidateId: 'C1',
    operationPaths: [scratch],
    candidateChecks: ['node --check '+scratch],
    expectedChecks: ['node --check '+scratch],
  });
  assert.equal(differential.status, 'PASS');

  console.log('ACTION REPAIR ENGINEERING CONTRACT PASS');
} finally {
  fs.rmSync(scratch, { force: true });
}
