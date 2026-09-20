#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { assertAgentAdmission, REPAIR_PROTOCOL, REPAIR_PROTOCOL_HASH, validateActionVaultVerifierProof, validateErrorOnlyMutation } from './repair-protocol.mjs';

const session = fs.readFileSync('scripts/ci/agent-session.mjs', 'utf8');
const repair = fs.readFileSync('scripts/ci/repair-protocol.mjs', 'utf8');
const repairEngine = fs.readFileSync('scripts/ci/auto-repair-engine.mjs', 'utf8');
const task = fs.readFileSync('scripts/ci/task-agent.mjs', 'utf8');
const taskContract = fs.readFileSync('docs/agents/TASK-AGENT.md', 'utf8');
const safeExecution = fs.readFileSync('docs/agents/SAFE-TASK-AGENT-EXECUTION.md', 'utf8');
const prompts = JSON.parse(fs.readFileSync('docs/agents/PROMPT-REGISTRY.json', 'utf8'));
const cooperation = JSON.parse(fs.readFileSync('docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json', 'utf8'));
const protocolRegistry = JSON.parse(fs.readFileSync('docs/PROTOCOL-REGISTRY.json', 'utf8'));

const requiredReads = [
  'PROJECTS.md',
  'المهام.md',
  'AGENTS.md',
  'docs/EXECUTION-BRANCH-PROTOCOL.md',
  'docs/AGENT-COLLABORATION-PROTOCOL.md',
  'docs/AGENT-HANDOFF-REPORT-SCHEMA.md',
  'docs/AGENT-COORDINATION-CONTROL-PLANE.md',
  'docs/PROTOCOL-HIERARCHY.md',
  'docs/PROTOCOL-REGISTRY.json',
  'docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json',
  'docs/agents/PROMPT-REGISTRY.json',
  'diagnostics/auto-repair/memory.json',
  'scripts/ci/agent-communication.mjs',
  'docs/MINIMAL-CI-FINAL-ARCHITECTURE.md',
  'scripts/ci/test-plan.json',
  'scripts/ci/assertion-registry.json',
];

for (const file of requiredReads) {
  assert.ok(session.includes(file), 'session admission must require ' + file);
}

assert.ok(session.includes('loadPromptRegistry'));
assert.ok(session.includes('validatePromptRegistry'));
assert.ok(session.includes('loadErrorMemory'));
assert.ok(session.includes('readCanonicalAdmissionSources'));
assert.ok(session.includes('admissionSources'));

for (const role of ["'repairAgent'", "'executionAgent'", "'assistantRepairAgent'"]) assert.ok(repair.includes(role));
assert.ok(repair.includes('primaryAgentsUnavailable'));
assert.ok(repair.includes('minConfidence: 0.90'));
assert.ok(repair.includes('minSupport: 2'));
assert.ok(repair.includes('actionRepairBot'));
assert.ok(repair.includes('actionRepairVerifier'));
assert.ok(repair.includes('actionHistorian'));
for (const role of ['actionRepairBot','actionRepairVerifier','actionHistorian']) assert.ok(session.includes(role));
assert.ok(!repair.includes("mutationAgents: ['repairAgent','implementation','executionAgent','taskAgent']"));
assert.ok(!repair.includes("mutationAgents: ['repairAgent','implementation','executionAgent']"));
assert.ok(repair.includes("mode: 'ERROR_ONLY'"));
assert.ok(repair.includes('REPAIR_PROTOCOL_TEST_MUTATION_BLOCKED'));
assert.ok(repairEngine.includes('FLIXO_ACTION_VAULT_VERIFIER_PROOF_PATH'));
assert.ok(repairEngine.includes('validateActionVaultVerifierProof'));
assert.ok(repairEngine.includes("repairActor === 'actionRepairBot'"));
assert.throws(
  () => validateErrorOnlyMutation({ failureLocation: 'src/example.ts', selectedFile: 'src/other.ts', changedPaths: ['src/other.ts'] }),
  /REPAIR_PROTOCOL_ERROR_TARGET_MISMATCH/,
);
assert.throws(
  () => validateErrorOnlyMutation({ failureLocation: 'src/example.ts', selectedFile: 'src/example.ts', changedPaths: ['src/example.ts', 'src/extra.ts'] }),
  /REPAIR_PROTOCOL_ERROR_SCOPE_EXCEEDED/,
);
assert.throws(
  () => validateErrorOnlyMutation({ failureLocation: 'tests/example.spec.ts', selectedFile: 'tests/example.spec.ts', changedPaths: ['tests/example.spec.ts'] }),
  /REPAIR_PROTOCOL_TEST_MUTATION_BLOCKED/,
);
assert.doesNotThrow(
  () => validateErrorOnlyMutation({ failureLocation: 'src/example.ts', selectedFile: 'src/example.ts', changedPaths: ['src/example.ts'] }),
);

assert.ok(task.includes("actor: 'taskAgent'"));
assert.ok(task.includes('preparedOnly: true'));
assert.ok(task.includes("executionMode: 'PREPARATION_ONLY'"));
assert.ok(task.includes("mutationPolicy: 'NO_DIRECT_MUTATION'"));
assert.ok(task.includes("const executionAuthority = 'TASK_PREPARATION_ONLY';"));
assert.ok(task.includes("TASK-AGENT-PREPARATION-v3"));
assert.ok(task.includes("applyAuthority: 'EXECUTION_AGENT_OR_REPAIR_AGENT'"));

assert.ok(taskContract.toLowerCase().includes('preparation-only'));
assert.ok(taskContract.includes('MUST NOT'));
assert.ok(taskContract.includes('mutate repository source'));

assert.ok(safeExecution.includes('Task Agent is explicitly not a mutation role'));

const legacy = prompts.prompts.find((item) => item.promptId === 'RPR-EXISTING-SAFE-TASK-001');
assert.equal(legacy?.status, 'DEPRECATED');
assert.deepEqual(legacy?.supersededBy, ['RPR-EXISTING-TASK-PREP-001']);

assert.equal(cooperation.schemaVersion, 5);
assert.ok(cooperation.protocols.action_vault_reasoning.includes('ACTION-REPAIR'));
assert.equal(cooperation.actionVaultContinuity?.missionContractVersion, 2);
assert.deepEqual(cooperation.actionVaultContinuity?.residents, ['ACTION-REPAIR','ACTION-REPAIR-2','ACTION-HISTORIAN-3']);
assert.equal(cooperation.actionVaultContinuity?.roles?.['ACTION-REPAIR']?.mutationAuthority, true);
assert.equal(cooperation.actionVaultContinuity?.roles?.['ACTION-REPAIR-2']?.mutationAuthority, false);
assert.equal(cooperation.actionVaultContinuity?.roles?.['ACTION-HISTORIAN-3']?.mutationAuthority, false);
assert.ok(cooperation.protocols.communication_first);
assert.ok(cooperation.protocols.message_idempotency);
assert.ok(cooperation.protocols.message_freshness);
assert.equal(protocolRegistry.protocols.find((item) => item.id === 'P20')?.status, 'MANDATORY');

const targetSHA = 'a'.repeat(40);
const verifierProof = {
  status: 'CHALLENGE_PASSED',
  challengeId: 'challenge-test',
  role: 'EXACT_PROGRAMMER_TWIN_VERIFIER',
  challengeMode: 'PROGRAMMER_TWIN',
  verifierAgent: 'actionRepairVerifier',
  targetSha: targetSHA,
  failureFingerprint: 'fp-test',
  alternativeHypotheses: [{ id: 'alt-a', basis: 'independent-cause' }],
  falsificationChecks: [{ id: 'check-a', command: 'echo prove-or-disprove' }],
  counterEvidence: { rejectedHypothesis: 'alt-a', evidenceRef: 'test-evidence' },
  programmerTwinParity: { intelligenceParity: 'EXACT', authorityParity: 'SEPARATED_BY_DESIGN' },
  mutationRecommendation: 'ALLOW',
  remainingRisks: ['rerun-targeted-regression'],
};
assert.doesNotThrow(() => validateActionVaultVerifierProof({ proof: verifierProof, targetSHA, failureFingerprint: 'fp-test' }));
assert.throws(() => validateActionVaultVerifierProof({ proof: { ...verifierProof, targetSha: 'b'.repeat(40) }, targetSHA, failureFingerprint: 'fp-test' }), /SHA_MISMATCH/);
assert.throws(() => validateActionVaultVerifierProof({ proof: { ...verifierProof, alternativeHypotheses: [] }, targetSHA, failureFingerprint: 'fp-test' }), /ALTERNATIVES_MISSING/);
assert.throws(() => validateActionVaultVerifierProof({ proof: { ...verifierProof, challengeMode: 'PREDICTOR' }, targetSHA, failureFingerprint: 'fp-test' }), /PROGRAMMER_TWIN_MODE_INVALID/);
assert.throws(() => validateActionVaultVerifierProof({ proof: { ...verifierProof, programmerTwinParity: { intelligenceParity: 'MISMATCH', authorityParity: 'SEPARATED_BY_DESIGN' } }, targetSHA, failureFingerprint: 'fp-test' }), /PROGRAMMER_TWIN_PARITY_INVALID/);

const actionVaultSession = {
  protocolId: REPAIR_PROTOCOL.protocolId,
  protocolVersion: REPAIR_PROTOCOL.protocolVersion,
  protocolHash: REPAIR_PROTOCOL_HASH,
  state: 'FAILURE_CAPTURED',
  targetSHA,
  actionVaultMission: {
    role: 'ACTION-REPAIR', triadId: 'triad-test', messageId: 'msg-test', taskId: 'task-test',
    failureFingerprint: 'fp-test', entrySha: targetSHA, targetSha: targetSHA, ownerAgent: 'actionRepairBot',
    verifierAgent: 'actionRepairVerifier', historianAgent: 'actionHistorian', programmerTwinParity: { intelligenceParity: 'EXACT', authorityParity: 'SEPARATED_BY_DESIGN', targetSha }, proofObligations: ['proof'], stopConditions: ['GREEN'], noBlindRetry: true,
  },
  actionVaultVerifierProof: verifierProof,
};
assert.doesNotThrow(() => assertAgentAdmission({ actor: 'actionRepairBot', branch: 'execution', mutation: true, session: actionVaultSession }));
assert.throws(() => assertAgentAdmission({ actor: 'actionRepairBot', branch: 'execution', mutation: true, session: { ...actionVaultSession, actionVaultMission: { ...actionVaultSession.actionVaultMission, verifierAgent: 'wrong' } } }), /ACTION_VAULT_TRIAD_INCOMPLETE/);
assert.throws(() => assertAgentAdmission({ actor: 'actionRepairBot', branch: 'execution', mutation: true, session: { ...actionVaultSession, actionVaultMission: { ...actionVaultSession.actionVaultMission, noBlindRetry: false } } }), /BLIND_RETRY_BLOCKED/);
assert.throws(() => assertAgentAdmission({ actor: 'actionRepairVerifier', branch: 'execution', mutation: true, session: actionVaultSession }), /NON_MUTATING_ROLE_BLOCKED/);

console.log('AGENT_ADMISSION_CONTRACT=PASS');
console.log('TASK_AGENT_MUTATION_AUTHORITY=BLOCKED');
console.log('CANONICAL_READ_SET=ENFORCED');
console.log('PROMPT_AND_MEMORY_ADMISSION=ENFORCED');
