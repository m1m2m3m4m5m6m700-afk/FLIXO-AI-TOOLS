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
assert.equal(intelligence.cooperation.softwareEngineerCore.protocol, 'LOCAL_SOFTWARE_ENGINEER_CORE_V1');
assert.equal(intelligence.cooperation.softwareEngineerCore.owner, 'ACTION-REPAIR');
assert.equal(intelligence.cooperation.softwareEngineerCore.readOnly, true);

const valid = {
  botId: 'ACTION-REPAIR',
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
assert.ok(validateBotProfile(tampered).includes('INDEPENDENT_AUTHORITY_NOT_DISABLED'));

const boundaries = validateExecutionBoundaries([
  { ...valid, role: 'ACTION_REPAIR_EXECUTOR', botId: 'ACTION-REPAIR', executionBoundary: { singleActiveRepairOwner: true, canMutateWhenOwner: true, canMutateTests: false, canMutateMain: false, canonicalGreen: 'DAILY_FLIXO_GREEN_GATE' }, executionContract: { mutationBranch: 'execution', mutationScope: 'ERROR_ONLY', exactShaRequired: true, reproduceBeforeMutation: true, targetedRegressionRequired: true, canonicalGreenRequired: true } },
  { botId: 'ACTION-REPAIR-2', mutationAuthority:false, executionAuthority:'HISTORICAL_PREDICTION_PROPOSAL_ONLY', rules: { requireOwnerReviewBeforeMutation: true, producePredictionPacket: true, searchHistoricalIndexBeforeProposal: true }, executionBoundary: { canMutateWhenOwner: false, canMutateTests: false, canMutateMain: false, canonicalGreen: 'DAILY_FLIXO_GREEN_GATE' } },
  { botId: 'ACTION-HISTORIAN-3', mutationAuthority: false, canMutateSource: false, canDispatchRepair: false, executionAuthority: 'RECORD_INDEX_ESCALATE_ONLY', repositoryWriteScope: 'ACTION_VAULT_MEMORY_ONLY', executionBoundary: { sourceMutation: false, testMutation: false } },
]);
assert.deepEqual(boundaries, []);

console.log(JSON.stringify({
  status: 'PASS',
  authority: 'ACTION_VAULT_AGENT_GRADE_GATE_TEST',
  assertions: 22,
}, null, 2));
