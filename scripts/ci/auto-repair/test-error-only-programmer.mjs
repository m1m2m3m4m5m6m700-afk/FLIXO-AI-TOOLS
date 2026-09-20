import assert from 'node:assert/strict';
import { buildErrorOnlyRepairModel, classifyRepairTarget } from './error-only-programmer.mjs';

const sha = 'a'.repeat(40);

const valid = buildErrorOnlyRepairModel({
  log: 'ERROR eslint: no-unused-vars at src/example.ts:10:2',
  diagnosis: {
    rootCause: 'lint',
    decision: 'ALLOW_BOUNDED_MUTATION',
    sourceMutationAllowed: true,
    directFailureSignal: true,
    causalConfidence: 0.92,
    location: { file: 'src/example.ts' },
  },
  selected: { id: 'eslint-unused', file: 'src/example.ts' },
  targetSha: sha,
});
assert.equal(valid.authority, 'ERROR_ONLY_PROGRAMMER_MODEL');
assert.equal(valid.mode, 'SOURCE_ERROR_REPAIR_ONLY');
assert.equal(valid.repair.mutationAllowed, true);
assert.equal(valid.repair.driver, 'eslint-ast');

for (const selected of [
  { id: 'eslint-unused', file: 'tests/example.spec.ts' },
  { id: 'eslint-unused', file: 'scripts/ci/repair-protocol.mjs' },
  { id: 'unsupported', file: 'src/example.ts' },
]) {
  assert.equal(classifyRepairTarget({
    diagnosis: { rootCause: 'lint', decision: 'ALLOW_BOUNDED_MUTATION', sourceMutationAllowed: true, directFailureSignal: true, causalConfidence: 0.95, ambiguity: false, location: { file: selected.file } },
    selected,
  }).allowed, false);
}

const lowConfidence = buildErrorOnlyRepairModel({
  log: 'ERROR eslint: no-unused-vars at src/example.ts:10:2',
  diagnosis: {
    rootCause: 'lint', decision: 'ALLOW_BOUNDED_MUTATION', sourceMutationAllowed: true,
    directFailureSignal: true, causalConfidence: 0.60, location: { file: 'src/example.ts' },
  },
  selected: { id: 'eslint-unused', file: 'src/example.ts' },
  targetSha: sha,
});
assert.equal(lowConfidence.repair.mutationAllowed, false);
assert(lowConfidence.blockedReasons.includes('ERROR_CAUSAL_CONFIDENCE_TOO_LOW'));

const external = buildErrorOnlyRepairModel({
  log: 'CAPIError: requested model is not supported',
  diagnosis: { rootCause: 'external-tooling', decision: 'BLOCK_EXTERNAL', sourceMutationAllowed: false, directFailureSignal: true, causalConfidence: 0.99 },
  selected: { id: 'external-tooling' },
  targetSha: sha,
});
assert.equal(external.failClosed, true);
assert(external.blockedReasons.includes('ERROR_EXTERNAL_BLOCKER_IS_NOT_SOURCE_DEFECT'));

const multi = classifyRepairTarget({
  diagnosis: { location: { file: 'src/a.ts' } },
  selected: { id: 'prepared-source-change', files: ['src/a.ts', 'src/b.ts'] },
});
assert.equal(multi.allowed, true);
assert.deepEqual(multi.targetFiles, ['src/a.ts', 'src/b.ts']);

console.log('ERROR_ONLY_PROGRAMMER_MODEL_CONTRACT=PASS');
