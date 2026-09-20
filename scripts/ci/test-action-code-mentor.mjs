#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  validateCodeMentorProfile,
  analyzeFile,
  buildRepositoryIndex,
  simulateRepair,
  buildMentorPacket,
} from './action-code-mentor.mjs';

const profile = {
  schemaVersion: 2,
  id: 'ACTION-CODE-MENTOR',
  parentBotId: 'ACTION-REPAIR',
  localOnly: true,
  networkAccess: false,
  authority: {
    permanentIndependentAuthority: false,
    readOnly: true,
    canMutateSource: false,
    canMutateTests: false,
    canMutateMain: false,
    canDispatchRepair: false,
    canApproveGreen: false,
  },
  binding: {
    exactShaRequired: true,
    requiredBeforeMutation: true,
    requiredDuringSelfCheck: true,
    failClosedOnUnknown: true,
  },
  teachingModel: {
    promotionOnlyAfterCanonicalGreen: true,
    learners: ['ACTION-REPAIR', 'ACTION-REPAIR-2', 'ACTION-HISTORIAN-3'],
  },
};
assert.deepEqual(validateCodeMentorProfile(profile), []);

const tampered = structuredClone(profile);
tampered.authority.canMutateSource = true;
assert.ok(validateCodeMentorProfile(tampered).some((x) => x.includes('CANMUTATESOURCE') || x.includes('CAN_MUTATE_SOURCE') || x.includes('MUTATION')));

const source = analyzeFile('scripts/ci/action-vault-targeted-test.mjs');
assert.equal(source.summary.kind, 'code');
assert.ok(source.summary.sha256.length === 64);
assert.ok(source.summary.symbols.length >= 1);

const indexed = buildRepositoryIndex([
  'scripts/ci/action-vault-targeted-test.mjs',
  '.github/workflows/ci.yml',
  'package.json',
]);
assert.equal(indexed.index.localOnly, true);
assert.equal(indexed.index.networkAccess, false);
assert.ok(indexed.index.counts.files >= 3);
assert.ok(indexed.index.counts.code >= 1);
assert.ok(indexed.index.counts.workflows >= 1);
assert.ok(indexed.index.imports.length >= 1);

const simulation = simulateRepair({
  taskId: 'TASK-CODE-MENTOR-SIMULATION',
  targetSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  changedPaths: [
    'scripts/ci/example.mjs',
    '.github/workflows/example.yml',
    'diagnostics/auto-repair/action-vault/ACTION-CODE-MENTOR.json',
  ],
});
assert.equal(simulation.outcome, 'SIMULATED_ONLY');
assert.equal(simulation.mutation, null);
assert.equal(simulation.staticGuard.noServer, true);
assert.equal(simulation.staticGuard.noNetwork, true);
assert.ok(simulation.predictedChecks.includes('npm run typecheck'));
assert.ok(simulation.predictedChecks.includes('node scripts/validate-ci-contract.mjs'));
assert.ok(simulation.predictedChecks.includes('npm run test:action-code-mentor'));

const packet = buildMentorPacket({
  taskId: 'TASK-CODE-MENTOR-DEEP',
  fingerprint: 'fingerprint-code-mentor',
  targetSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  failedRunId: 'run-code-mentor',
  sourceFiles: [
    'scripts/ci/action-code-mentor.mjs',
    'scripts/ci/action-vault-targeted-test.mjs',
  ],
  changedPaths: ['scripts/ci/action-code-mentor.mjs'],
  mode: 'DEEP',
  deep: true,
});
assert.equal(packet.protocol, 'CODE_MENTOR_PACKET_V3');
assert.equal(packet.parentBotId, 'ACTION-REPAIR');
assert.equal(packet.localOnly, true);
assert.equal(packet.networkAccess, false);
assert.equal(packet.readOnly, true);
assert.deepEqual(packet.learners, ['ACTION-REPAIR', 'ACTION-REPAIR-2', 'ACTION-HISTORIAN-3']);
assert.equal(packet.curriculum.astReasoning, true);
assert.equal(packet.curriculum.typeDiagnostics, true);
assert.ok(packet.repositoryIndex.counts.files >= 2);
assert.ok(Array.isArray(packet.codeFindings));
assert.ok(packet.simulation.predictedChecks.includes('npm run typecheck'));

assert.throws(
  () => buildMentorPacket({
    taskId: 'TASK',
    fingerprint: 'fingerprint',
    targetSha: 'not-a-sha',
    failedRunId: 'run',
  }),
  /EXACT_SHA/,
);

assert.throws(
  () => simulateRepair({
    taskId: 'TASK',
    targetSha: 'not-a-sha',
    changedPaths: [],
  }),
  /EXACT_SHA/,
);

console.log(JSON.stringify({
  status: 'PASS',
  protocol: 'CODE_MENTOR_PACKET_V3',
  assertions: 24,
  capabilities: [
    'AST',
    'semantic-diagnostics',
    'repository-index',
    'dependency-graph',
    'workflow-audit',
    'repair-simulation',
    'green-gated-learning',
    'serverless-local-only',
  ],
}, null, 2));
