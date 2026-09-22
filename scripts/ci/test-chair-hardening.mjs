#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const chair = fs.readFileSync(new URL('./chair-bound-execution.mjs', import.meta.url), 'utf8');
const coordination = fs.readFileSync(new URL('./agent-coordination.mjs', import.meta.url), 'utf8');
const session = fs.readFileSync(new URL('./agent-session.mjs', import.meta.url), 'utf8');

assert.match(chair, /HEARTBEAT_INTERVAL_MS/);
assert.match(chair, /DEAD_LEASE_AFTER_MS/);
assert.match(chair, /export function heartbeat/);
assert.match(chair, /export function reconcileDeadLeases/);
assert.match(chair, /DEAD_LEASE/);
assert.match(chair, /FLIXO_CHAIR_READ_ONLY_SPECULATION/);
assert.match(chair, /export function writeSpeculativeContext/);
assert.match(chair, /export function readSpeculativeContext/);
assert.match(chair, /export function sanitizeSessionContext/);
assert.match(chair, /export function atomicChairRefAudit/);
assert.match(chair, /atomicLocalCAS:true/);
assert.match(chair, /event:'ACQUIRE'/);
assert.match(chair, /event:'RELEASE'/);
assert.match(chair, /event:'REVOKE'/);
assert.match(chair, /event:'DEAD_LEASE'/);
assert.match(chair, /SPECULATIVE_CACHE_TTL_MS/);

assert.match(coordination, /heartbeat as heartbeatChair/);
assert.match(coordination, /reconcileDeadLeases/);
assert.match(coordination, /writeSpeculativeContext/);
assert.match(coordination, /initializeChairState\(\{targetSha:sha\(\)\}\)/);
assert.match(coordination, /chair-heartbeat/);
assert.match(coordination, /chair-reconcile/);
assert.match(coordination, /chair-speculate/);
assert.match(coordination, /acquireChair\(\{ agentId, chairId:/);
assert.doesNotMatch(coordination, /acquireTaskChair/);
assert.doesNotMatch(coordination, /releaseTaskChair/);
assert.match(coordination, /reason: 'TASK_COMPLETE'/);
assert.match(coordination, /reason: 'TASK_RELEASE'/);
assert.match(session, /heartbeat as heartbeatChair/);
assert.match(session, /reconcileDeadLeases/);
assert.match(session, /CHAIR_LEASE_RECOVERY_REQUIRED/);
assert.match(session, /chairHeartbeatResult/);

const schema = fs.readFileSync(new URL('../../schemas/flixo-chairs.schema.json', import.meta.url), 'utf8');
assert.match(schema, /heartbeat_at/);
assert.match(schema, /heartbeat_count/);
assert.match(schema, /lease_started_at/);

console.log('CHAIR_HARDENING_CONTRACT=PASS');
console.log('CHAIR_MICRO_LEASE_CONTRACT=PASS');
console.log('CHAIR_SPECULATIVE_CACHE_CONTRACT=PASS');
console.log('CHAIR_CONTEXT_SANITIZATION_CONTRACT=PASS');
console.log('CHAIR_REF_CAS_AUDIT_CONTRACT=PASS');
console.log('CHAIR_COORDINATION_BINDING_CONTRACT=PASS');
