#!/usr/bin/env node
import assert from 'node:assert/strict';
import { COUNCIL_ACCOUNTS, assertCouncilDispatchAuthorization, assertExactSha } from '../src/lib/council-account-registry.ts';

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
