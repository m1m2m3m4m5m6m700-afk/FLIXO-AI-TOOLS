import assert from 'node:assert/strict';
import {
  assertCanonicalContractClosure,
  assertExternalProviderClosure,
  assertHistoricalClassClosure,
  assertRecurrencePrevention,
  validateProvenanceClosure,
  buildProvenanceClosure,
  preventionRuleFor,
  assertCanonicalSymmetry,
} from './root-closure-contract.mjs';

assert.doesNotThrow(() => assertCanonicalContractClosure());
assert.doesNotThrow(() => assertExternalProviderClosure());
assert.doesNotThrow(() => assertHistoricalClassClosure({
  scripts: {
    'test:browser': 'x',
    'validate:playwright-surface': 'x',
    'validate:router-registry': 'x',
    'test:route-resolver': 'x',
    typecheck: 'x',
    lint: 'x',
    'test:build': 'x',
    'validate:lock-manifest': 'x',
    'validate:i18n': 'x',
    'validate:localization-complete': 'x',
    'validate:seo': 'x',
    'validate:indexing': 'x',
    'verify:ci-cd-trust': 'x',
    'test:repair-supervision': 'x',
  },
}));

assert.doesNotThrow(() => assertRecurrencePrevention({
  cases: [{
    fingerprint: 'f1',
    rootCause: 'typescript',
    attempts: 2,
    outcomes: [{ outcome: 'failure' }, { outcome: 'failure' }],
    rules: ['typescript-async-contract'],
  }],
  antiLessons: [],
}));
assert.throws(() => assertRecurrencePrevention({
  cases: [{ fingerprint: 'f2', rootCause: 'typescript', attempts: 2, outcomes: [{ outcome: 'failure' }, { outcome: 'failure' }] }],
  antiLessons: [],
}), /RECURRENCE_WITHOUT_PREVENTION/);

const valid = {
  assertionId: 'ASSERT-UNIT-001',
  executionUnit: 'FLIXO Test System / Static + Build',
  runId: '35530000001',
  jobId: '106100000001',
  stepId: 'static-build',
  exactSha: 'a'.repeat(40),
  artifactId: 'artifact-1',
  artifactDigest: 'b'.repeat(64),
  rcaId: 'RCA-TEST-001',
  certificationId: 'CERT-TEST-001',
  mergeCommitSha: 'c'.repeat(40),
  mergedFromSha: 'a'.repeat(40),
  chainHash: 'd'.repeat(64),
};
assert.doesNotThrow(() => validateProvenanceClosure(valid));
assert.throws(() => validateProvenanceClosure({ ...valid, artifactDigest: 'bad' }), /PROVENANCE_ARTIFACT_DIGEST_INVALID/);
assert.equal(preventionRuleFor('typescript').startsWith('RECURRENCE-TYPESCRIPT:'), true);
assert.equal(assertCanonicalSymmetry({
  mainSha: 'a'.repeat(40),
  executionSha: 'a'.repeat(40),
  mainContractDigest: 'b'.repeat(64),
  executionContractDigest: 'b'.repeat(64),
  branch: 'main',
}).ok, true);
assert.throws(() => assertCanonicalSymmetry({
  mainSha: 'a'.repeat(40),
  executionSha: 'a'.repeat(40),
  mainContractDigest: 'b'.repeat(64),
  executionContractDigest: 'c'.repeat(64),
  branch: 'main',
}), /SYMMETRY_CONTRACT_DIGEST_DIVERGENCE/);
assert.equal(assertCanonicalSymmetry({ branch: 'execution' }).mode, 'PRE_MERGE_PENDING');

const generated = buildProvenanceClosure({
  assertionId: 'ASSERT-GENERATED-001',
  executionUnit: 'Test System / Certification',
  runId: '1',
  jobId: '2',
  stepId: 'certify',
  exactSha: 'e'.repeat(40),
  artifactId: '3',
  artifactDigest: 'f'.repeat(64),
  rcaId: 'RCA-NONE-EXACT-SHA',
  certificationId: 'CERT-1',
  mergeCommitSha: 'e'.repeat(40),
  mergedFromSha: 'e'.repeat(40),
});
assert.doesNotThrow(() => validateProvenanceClosure(generated));

console.log('PROJECT ROOT CLOSURE CONTRACT: PASS');
