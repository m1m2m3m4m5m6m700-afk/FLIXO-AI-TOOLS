#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateAdversarialBotCommandRegistry, resolveAdversarialCommand } from './adversarial-bot-commands.mjs';

const result = validateAdversarialBotCommandRegistry();
assert.equal(result.ok, true);
assert.ok(result.botCount >= 4);

const action2 = resolveAdversarialCommand({ botId: 'ACTION-REPAIR-2', commandId: 'CHALLENGE_PRIMARY' });
assert.equal(action2.agentId, 'actionRepairVerifier');
assert.equal(action2.command.mode, 'FALSIFY_PRIMARY');
assert.equal(action2.command.mutation, false);

const revise = resolveAdversarialCommand({ botId: 'ACTION-REPAIR-2', commandId: 'REVISE_AFTER_COUNTEREXAMPLE' });
assert.equal(revise.command.mutation, true);
assert.deepEqual(
  revise.command.preconditions,
  ['exactShaReset','candidateRepairApproved','chairBoundAdmission','repairProtocolAdmission'],
);

const twinB = resolveAdversarialCommand({ botId: 'PROGRAMMER-TWIN-B', commandId: 'FALSIFY_PRIMARY' });
assert.equal(twinB.mutationAuthority, 'NONE');
assert.equal(twinB.command.entry, 'scripts/ci/adversarial-repair-twin.mjs');

const convergence = resolveAdversarialCommand({ botId: 'ADVERSARIAL-CONVERGENCE', commandId: 'REJECT_AND_REVISE' });
assert.equal(convergence.command.mutation, 'DELEGATED_TO_ACTION_REPAIR');

const registry = fs.readFileSync('docs/agents/ADVERSARIAL-BOT-COMMANDS.json', 'utf8');
assert.match(registry, /NO_TEST_MUTATION/);
assert.match(registry, /NO_MAIN_MUTATION/);
assert.match(registry, /NO_THIRD_BRANCH/);

console.log('ADVERSARIAL_BOT_COMMAND_REGISTRY=PASS');
