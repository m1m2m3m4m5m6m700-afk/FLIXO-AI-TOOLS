import assert from 'node:assert/strict';
import { classifyContractFailure } from '../src/lib/contracts/failure-classifier.ts';

const fail = (contract, assertion, expected = 'expected', actual = 'actual', source = 'test') => ({
  gate: contract.split('-')[0], contract, status: 'FAIL', scope: {}, assertion, expected, actual, evidence: { source },
});

const cases = [
  ['TYPE_ERROR', 'RC-TYPE-001', 'TypeScript compilation error'],
  ['REGISTRY_DRIFT', 'RC-G1-REGISTRY-001', 'registry duplicate detected'],
  ['ROUTER_DRIFT', 'RC-G1-ROUTER-001', 'router registry mismatch'],
  ['LOCALIZED_TITLE_MISMATCH', 'RC-G4-I18N-001', 'localized title differs from expected locale'],
  ['LOCALIZED_DESCRIPTION_MISMATCH', 'RC-G4-I18N-001', 'localized description mismatch'],
  ['ENGLISH_UI_LEAKAGE', 'RC-G4-I18N-001', 'English UI leakage detected'],
  ['CANONICAL_MISMATCH', 'RC-G4-SEO-001', 'canonical URL mismatch'],
  ['HREFLANG_MISMATCH', 'RC-G4-SEO-001', 'hreflang mismatch'],
  ['A11Y_DUPLICATE_LANDMARK', 'RC-G4-A11Y-001', 'duplicate main landmark'],
  ['A11Y_MISSING_NAME', 'RC-G4-A11Y-001', 'missing accessible name'],
  ['RUNTIME_EXCEPTION', 'RC-G4-RUNTIME-001', 'runtime exception thrown'],
  ['CONSOLE_ERROR', 'RC-G4-RUNTIME-001', 'console error emitted'],
  ['NETWORK_ERROR', 'RC-G4-RUNTIME-001', 'network request failed'],
  ['FILE_SIGNATURE_ERROR', 'RC-G2-SIGNATURE-001', 'file signature mismatch'],
  ['ARTIFACT_INTEGRITY_ERROR', 'RC-G3-INTEGRITY-001', 'artifact integrity mismatch'],
  ['INFRASTRUCTURE_ERROR', 'RC-INFRA-001', 'deployment rate limit'],
  ['UNKNOWN', 'RC-UNKNOWN-001', 'unrecognized condition xyz'],
];

for (const [category, rootCauseId, assertion] of cases) {
  const result = classifyContractFailure(fail('G4-TEST-001', assertion));
  assert.equal(result.category, category, `${assertion}: category`);
  assert.equal(result.rootCauseId, rootCauseId, `${assertion}: rootCauseId`);
}

const flaky = classifyContractFailure(fail('G4-RUNTIME-001', 'intermittent timeout / flaky test'));
assert.equal(flaky.category, 'FLAKY_TEST');
assert.equal(flaky.deterministic, false);

const malformed = { ...fail('G4-TEST-001', 'invalid status'), status: 'UNKNOWN' };
assert.throws(() => classifyContractFailure(malformed), /requires FAIL/);

const pass = { gate: 'G4', contract: 'G4-TEST-001', status: 'PASS', scope: {} };
assert.throws(() => classifyContractFailure(pass), /requires FAIL/);

console.log(`Failure classifier PASS: ${cases.length + 1} deterministic/flaky cases`);
