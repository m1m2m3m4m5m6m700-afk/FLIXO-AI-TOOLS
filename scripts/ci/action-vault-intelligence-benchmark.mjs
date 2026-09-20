#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  validateActionVaultVerifierProof,
  validateActionVaultPreMutationProofs,
  validateErrorOnlyMutation,
  assertAgentAdmission,
} from './repair-protocol.mjs';

const sha = 'a'.repeat(40);
const fp = 'benchmark-fingerprint';
const baseProof = {
  status: 'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE',
  challengeId: 'benchmark',
  verifierAgent: 'actionRepairVerifier',
  targetSha: sha,
  failureFingerprint: fp,
  alternativeHypotheses: [{ id: 'alt' }],
  falsificationChecks: Array.from({ length: 10 }, (_, i) => ({ id: 'f-' + i })),
  falsificationSearches: Array.from({ length: 10 }, (_, i) => ({ id: 's-' + i })),
  counterEvidence: { noCounterexampleIsNotPatchCorrect: true },
  role: 'ADVERSARIAL_PROGRAMMER_FALSIFIER',
  challengeMode: 'FALSIFY_PRIMARY',
  programmerTwinParity: { intelligenceParity: 'EXACT', authorityParity: 'SEPARATED_BY_DESIGN', targetSha: sha, failureFingerprint: fp },
  cognitiveAwareness: { protocol: 'ACTION-SYSTEM-COGNITIVE-AWARENESS-v1', systemWide: true, targetSha: sha, failureFingerprint: fp },
  primaryCorrectnessProof: { objective: 'PROVE_PRIMARY_REPAIR_CORRECT', status: 'PRIMARY_CORRECTNESS_PROVEN' },
  falsificationComplete: true,
  counterexampleFound: false,
  mutationRecommendation: 'ALLOW_AFTER_FALSIFICATION_NO_COUNTEREXAMPLE',
  remainingRisks: ['canonical-green'],
  proofCompleteness: {
    COGNITIVE_AWARENESS_PROVEN: true,
    ROOT_CAUSE_PROVEN: true,
    FILE_SELECTION_PROVEN: true,
    PROGRAMMER_TWIN_PARITY_PROVEN: true,
    ADVERSARIAL_FALSIFICATION_COMPLETE: true,
    NO_VALID_COUNTEREXAMPLE: true,
    NO_SCOPE_VIOLATION: true,
    NO_TEST_MUTATION: true,
    NO_CONTROL_PLANE_MUTATION: true,
    NO_MAIN_MUTATION: true,
    NO_GATE_WEAKENING: true,
  },
};
const baseSandbox = {
  protocol: 'REPAIR_SANDBOX_SIMULATION_V1',
  status: 'PASS',
  targetSha: sha,
  failureFingerprint: fp,
  exactShaBound: true,
  mutationPerformed: false,
  patchDigest: 'digest-1',
};
const baseDifferential = {
  protocol: 'DIFFERENTIAL_REPAIR_VERIFICATION_V1',
  status: 'PASS',
  targetSha: sha,
  executionEvidence: { required: true, receiptCount: 1 },
};
const basePatch = {
  status: 'PROVEN',
  targetSha: sha,
  patchDigest: 'digest-1',
  mutationPerformed: false,
  differentialStatus: 'PASS',
};
const blocked = [];
const expectBlock = (name, fn) => {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert.equal(threw, true, name + ' must fail closed');
  blocked.push(name);
};

expectBlock('wrong-sha-verifier', () => validateActionVaultVerifierProof({ proof: { ...baseProof, targetSha: 'b'.repeat(40) }, targetSHA: sha, failureFingerprint: fp }));
expectBlock('wrong-fingerprint-verifier', () => validateActionVaultVerifierProof({ proof: { ...baseProof, failureFingerprint: 'other' }, targetSHA: sha, failureFingerprint: fp }));
expectBlock('unapproved-recommendation', () => validateActionVaultVerifierProof({ proof: { ...baseProof, mutationRecommendation: 'MAYBE' }, targetSHA: sha, failureFingerprint: fp }));
expectBlock('missing-proof-completeness', () => validateActionVaultVerifierProof({ proof: { ...baseProof, proofCompleteness: { ...baseProof.proofCompleteness, NO_SCOPE_VIOLATION: false } }, targetSHA: sha, failureFingerprint: fp }));
expectBlock('missing-counterexample-rule', () => validateActionVaultVerifierProof({ proof: { ...baseProof, counterEvidence: {} }, targetSHA: sha, failureFingerprint: fp }));
expectBlock('sandbox-not-pass', () => validateActionVaultPreMutationProofs({ sandboxProof: { ...baseSandbox, status: 'FAIL' }, differentialProof: baseDifferential, patchCorrectnessProof: basePatch, targetSHA: sha, failureFingerprint: fp }));
expectBlock('sandbox-mutated', () => validateActionVaultPreMutationProofs({ sandboxProof: { ...baseSandbox, mutationPerformed: true }, differentialProof: baseDifferential, patchCorrectnessProof: basePatch, targetSHA: sha, failureFingerprint: fp }));
expectBlock('differential-missing-execution', () => validateActionVaultPreMutationProofs({ sandboxProof: baseSandbox, differentialProof: { ...baseDifferential, executionEvidence: { required: true, receiptCount: 0 } }, patchCorrectnessProof: basePatch, targetSHA: sha, failureFingerprint: fp }));
expectBlock('patch-digest-mismatch', () => validateActionVaultPreMutationProofs({ sandboxProof: baseSandbox, differentialProof: baseDifferential, patchCorrectnessProof: { ...basePatch, patchDigest: 'other' }, targetSHA: sha, failureFingerprint: fp }));
expectBlock('patch-not-proven', () => validateActionVaultPreMutationProofs({ sandboxProof: baseSandbox, differentialProof: baseDifferential, patchCorrectnessProof: { ...basePatch, status: 'UNPROVEN' }, targetSHA: sha, failureFingerprint: fp }));
expectBlock('test-mutation', () => validateErrorOnlyMutation({ failureLocation: 'src/example.ts', selectedFile: 'tests/example.spec.ts', changedPaths: ['tests/example.spec.ts'] }));
expectBlock('control-plane-mutation', () => validateErrorOnlyMutation({ failureLocation: 'src/example.ts', selectedFile: 'scripts/ci/auto-repair-engine.mjs', changedPaths: ['scripts/ci/auto-repair-engine.mjs'] }));
expectBlock('scope-expansion', () => validateErrorOnlyMutation({ failureLocation: 'src/example.ts', selectedFiles: ['src/example.ts'], changedPaths: ['src/example.ts', 'src/other.ts'] }));
expectBlock('non-mutation-agent', () => assertAgentAdmission({ actor: 'diagnosticAgent', branch: 'execution', mutation: true }));
expectBlock('falsification-search-shortfall', () => validateActionVaultVerifierProof({ proof: { ...baseProof, falsificationSearches: baseProof.falsificationSearches.slice(0, 9) }, targetSHA: sha, failureFingerprint: fp }));

const score = Math.round((blocked.length / 15) * 100);
const result = {
  schemaVersion: 1,
  protocol: 'ACTION-VAULT-INTELLIGENCE-BENCHMARK-v1',
  mode: 'GATE_INTEGRITY_ADVERSARIAL',
  score,
  cases: 15,
  blockedCases: blocked.length,
  passed: score === 100,
  note: 'This benchmark measures fail-closed gate integrity; it is not a substitute for canonical CI or production repair evidence.',
  generatedAt: new Date().toISOString(),
};
console.log(JSON.stringify(result, null, 2));
if (score !== 100) process.exit(1);
