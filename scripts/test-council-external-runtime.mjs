#!/usr/bin/env node
import assert from 'node:assert/strict';
import { COUNCIL_ACCOUNTS, COUNCIL_CELL_NAME, RAW_CELL_BOT_COUNT, RAW_CELL_BOTS, assertCouncilDispatchAuthorization, assertExactSha, getRawCellBot } from '../src/lib/council-account-registry.ts';

assert.deepEqual(Object.keys(COUNCIL_ACCOUNTS).sort(), ['CHIEF', 'WORKER_A', 'WORKER_B']);
assert.equal(COUNCIL_ACCOUNTS.CHIEF.mutationAuthority, false);
assert.equal(COUNCIL_ACCOUNTS.WORKER_A.mutationAuthority, true);
assert.equal(COUNCIL_ACCOUNTS.WORKER_B.mutationAuthority, true);
assert.deepEqual([...COUNCIL_ACCOUNTS.CHIEF.canDispatchTo].sort(), ['WORKER_A', 'WORKER_B']);
assert.equal(COUNCIL_ACCOUNTS.WORKER_A.fallbackAccountId, 'WORKER_B');
assert.equal(COUNCIL_ACCOUNTS.WORKER_B.fallbackAccountId, 'WORKER_A');
console.log('COUNCIL_ACCOUNT_REGISTRY=PASS');

assert.doesNotThrow(() => assertCouncilDispatchAuthorization('SYSTEM', 'CHIEF', 'CHIEF'));
assert.throws(() => assertCouncilDispatchAuthorization('SYSTEM', 'WORKER_A', 'WORKER_B'), /COUNCIL_SYSTEM_DISPATCH_ONLY_CHIEF/);
assert.doesNotThrow(() => assertCouncilDispatchAuthorization('CHIEF', 'WORKER_A', 'WORKER_B'));
assert.doesNotThrow(() => assertCouncilDispatchAuthorization('CHIEF', 'WORKER_B', 'WORKER_A'));
assert.throws(() => assertCouncilDispatchAuthorization('WORKER_A', 'WORKER_B', 'WORKER_A'), /COUNCIL_WORKER_DISPATCH_FORBIDDEN/);
assert.throws(() => assertCouncilDispatchAuthorization('CHIEF', 'WORKER_A', 'CHIEF'), /COUNCIL_FALLBACK_ACCOUNT_INVALID/);
console.log('COUNCIL_DISPATCH_AUTHORIZATION=PASS');

assert.doesNotThrow(() => assertExactSha('a'.repeat(40)));
assert.throws(() => assertExactSha('bad'), /COUNCIL_EXACT_SHA_INVALID/);
console.log('COUNCIL_EXACT_SHA=PASS');

assert.equal(COUNCIL_CELL_NAME, 'الخلية');
assert.equal(RAW_CELL_BOT_COUNT, 50);
assert.equal(RAW_CELL_BOTS.length, 50);
assert.equal(RAW_CELL_BOTS[0].botId, 'CELL-001');
assert.equal(RAW_CELL_BOTS[49].botId, 'CELL-050');
assert.ok(RAW_CELL_BOTS.every((bot) =>
  bot.cellName === 'الخلية'
  && bot.mode === 'RAW'
  && bot.state === 'UNPROVISIONED'
  && bot.specialization === null
  && bot.runtimeAccountId === null
  && bot.mutationAuthority === false
  && bot.certificationAuthority === false
));
assert.equal(getRawCellBot('CELL-017').botId, 'CELL-017');
assert.throws(() => getRawCellBot('CELL-051'), /COUNCIL_CELL_BOT_UNKNOWN/);
console.log('COUNCIL_CELL_50_RAW_BOTS=PASS');

import { ACTION_AGENT_TRIAD } from '../src/lib/council-account-registry.ts';
assert.equal(ACTION_AGENT_TRIAD.CHIEF.mutationMode,'NONE');
assert.equal(ACTION_AGENT_TRIAD.WORKER_A.mutationMode,'DELEGATED_REPAIR_ONLY');
assert.equal(ACTION_AGENT_TRIAD.WORKER_B.mutationMode,'DELEGATED_REPAIR_ONLY');
assert.equal(ACTION_AGENT_TRIAD.WORKER_A.certificationAuthority,false);
assert.equal(ACTION_AGENT_TRIAD.WORKER_B.certificationAuthority,false);
console.log('ACTION_AGENT_TRIAD_PROFILES=PASS');
