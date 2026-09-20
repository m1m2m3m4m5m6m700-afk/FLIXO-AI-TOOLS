#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runGate, validateBotProfile, validateExecutionBoundaries, EXPECTED_BOTS } from './action-vault-agent-gate.mjs';

const result = runGate();
assert.equal(result.status, 'PASS', JSON.stringify(result, null, 2));
assert.equal(result.botCount, 3);
assert.ok(result.errors.length === 0, JSON.stringify(result.errors));
assert.deepEqual(result.bots.map((x) => x.botId), EXPECTED_BOTS);
const intelligence = JSON.parse(fs.readFileSync('diagnostics/auto-repair/action-vault/ACTION-THREE-BOT-INTELLIGENCE.json','utf8'));
assert.equal(intelligence.schemaVersion,6);
assert.equal(intelligence.cooperation.triadGovernance.protocol,'ACTION-VAULT-TRIAD-ADVERSARIAL-LEARNING-v1');
assert.equal(intelligence.cooperation.triadGovernance.recurrenceEscalationThreshold,20);
assert.equal(intelligence.cooperation.triadGovernance.catalogCapacity,1000000);
assert.equal(intelligence.cooperation.triadGovernance.supervisor,'ACTION-HISTORIAN-3');
assert.equal(intelligence.cooperation.triadGovernance.allThreeMayCreateCandidateArtifacts,true);
assert.equal(intelligence.cooperation.softwareEngineerCore.protocol, 'LOCAL_SOFTWARE_ENGINEER_CORE_V1');
assert.equal(intelligence.cooperation.softwareEngineerCore.owner, 'ACTION-REPAIR');
assert.equal(intelligence.cooperation.softwareEngineerCore.readOnly, true);
assert.equal(intelligence.cooperation.repairEngineering.enabled, true);
assert.equal(intelligence.cooperation.repairEngineering.owner, 'ACTION-REPAIR');
assert.equal(intelligence.cooperation.repairEngineering.exactShaRequired, true);
assert.equal(intelligence.cooperation.repairEngineering.canonicalGreenRequired, true);
assert.equal(intelligence.agentRuntime.protocol, 'ACTION-AGENT-RUNTIME-v2');
assert.equal(intelligence.agentRuntime.requirements.patchSynthesis, true);
assert.equal(intelligence.agentRuntime.requirements.sandboxSimulation, true);
assert.equal(intelligence.agentRuntime.requirements.differentialVerification, true);

const valid = {
  botId: 'ACTION-REPAIR',
  role: 'PROGRAMMER_DEFENSE_SEAT',
  permanentIndependentAuthority: false,
  transferableKnowledgeOnly: true,
  intelligenceProfileRef: 'diagnostics/auto-repair/action-vault/ACTION-THREE-BOT-INTELLIGENCE.json',
  cooperationMode: 'MANDATORY_SHARED_MISSION_ON_RED',
  agentGrade: {
    lifecycle: 'READY',
    shortName: 'ACTR',
    upgradeNumber: 1,
    upgradePriority: 90,
    nextUpgrade: { id: 'U2', weakness: 'test' },
  },
  requiredCollaborators: ['ACTION-REPAIR-2', 'ACTION-HISTORIAN-3'],
};
assert.deepEqual(validateBotProfile(valid), []);

const tampered = structuredClone(valid);
tampered.permanentIndependentAuthority = true;
assert.ok(validateBotProfile(tampered).some((error) => error.startsWith('INDEPENDENT_AUTHORITY_NOT_DISABLED=')));

const boundaries = validateExecutionBoundaries([
  { ...valid, role: 'PROGRAMMER_DEFENSE_SEAT', botId: 'ACTION-REPAIR', executionBoundary: { singleActiveRepairOwner: true, canMutateWhenOwner: true, canMutateTests: false, canMutateMain: false, canonicalGreen: 'DAILY_FLIXO_GREEN_GATE' }, executionContract: { mutationBranch: 'execution', mutationScope: 'ERROR_ONLY', exactShaRequired: true, reproduceBeforeMutation: true, targetedRegressionRequired: true, canonicalGreenRequired: true } },
  { botId: 'ACTION-REPAIR-2', mutationAuthority:'ADMITTED_SEAT', executionAuthority:'MUTATE_WHEN_ADMITTED', rules: { requireOwnerReviewBeforeMutation: true, producePredictionPacket: true, searchHistoricalIndexBeforeProposal: true }, executionBoundary: { canMutateWhenOwner: true, canMutateTests: false, canMutateMain: false, canonicalGreen: 'DAILY_FLIXO_GREEN_GATE' } },
  { botId: 'ACTION-HISTORIAN-3', mutationAuthority: 'SUPERVISOR_20_ONLY', canMutateSource: 'SUPERVISOR_20_ONLY', canDispatchRepair: false, executionAuthority: 'MUTATE_WHEN_SUPERVISOR_20', repositoryWriteScope: 'EXECUTION_SOURCE_AFTER_SUPERVISOR_20', executionBoundary: { sourceMutation: 'SUPERVISOR_20_ONLY', testMutation: false } },
]);
assert.deepEqual(boundaries, []);
console.log('ACTION_VAULT_TRIAD_MUTATION_SEATS=PASS');

console.log(JSON.stringify({
  status: 'PASS',
  authority: 'ACTION_VAULT_AGENT_GRADE_GATE_TEST',
  assertions: 22,
}, null, 2));
