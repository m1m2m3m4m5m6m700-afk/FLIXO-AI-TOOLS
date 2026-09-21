#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync('supabase/functions/flixo-council-runtime/index.ts', 'utf8');
const relay = fs.readFileSync('.github/workflows/agent-communication-relay.yml', 'utf8');
const router = fs.readFileSync('scripts/ci/master-peer-communication.mjs', 'utf8');

for (const [master, primary, fallback] of [
  ['MASTER-1', 'CHIEF', 'CHIEF'],
  ['MASTER-2', 'WORKER_A', 'WORKER_B'],
  ['MASTER-3', 'WORKER_B', 'WORKER_A'],
]) {
  assert.match(runtime, new RegExp('\"' + master + '\": \\{ primary: \"' + primary + '\", fallback: \"' + fallback + '\" \\}'));
  assert.match(relay, new RegExp(master.replace('-', '\\-')));
}
assert.match(runtime, /const peerMessage = payload\.masterPeerMessage === true/);
assert.match(runtime, /COUNCIL_MASTER_PEER_IDENTITY_INVALID/);
assert.match(runtime, /COUNCIL_MASTER_PEER_ROUTE_MISMATCH/);
assert.match(runtime, /COUNCIL_MASTER_PEER_SELF_ROUTE/);
assert.match(runtime, /COUNCIL_MASTER_BROADCAST_TARGETS_REQUIRED/);
assert.match(runtime, /COUNCIL_MASTER_BROADCAST_TARGET_INVALID/);
assert.match(runtime, /COUNCIL_MASTER_BROADCAST_SYSTEM_ONLY/);
assert.match(runtime, /ADMIN_MASTER_BROADCAST/);

assert.match(relay, /RECIPIENT_MASTER=/);
assert.match(relay, /TOP_RECIPIENT=/);
assert.match(relay, /administrativeBroadcast/);
assert.match(relay, /MASTER-1","MASTER-2","MASTER-3/);
assert.match(relay, /FAIL CLOSED: unknown recipientMaster/);
assert.match(relay, /FAIL CLOSED: unknown senderMaster/);
assert.match(relay, /requestedByAccountId:"SYSTEM"/);
assert.match(relay, /masterPeerMessage:/);

assert.match(router, /MASTER-1/);
assert.match(router, /MASTER-2/);
assert.match(router, /MASTER-3/);
assert.match(router, /MASTER_PEER_EXACT_SHA_MISMATCH/);
assert.match(router, /MASTER_PEER_SELF_ROUTE_FORBIDDEN/);
assert.match(router, /MASTER_PEER_MESSAGE/);

console.log('MASTER_RUNTIME_ROUTE_MAP=PASS');
console.log('MASTER_PEER_RUNTIME_FAIL_CLOSED=PASS');
console.log('MASTER_PEER_RELAY_MAPPING=PASS');
console.log('MASTER_PEER_ROUTER_EXACT_SHA=PASS');
