#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fn=fs.readFileSync('supabase/functions/flixo-council-runtime/index.ts','utf8');
const claim=fs.readFileSync('supabase/migrations/20260922142000_master3_assistant_channel_claim_rpc.sql','utf8');
const dispatch=fs.readFileSync('supabase/migrations/20260922142500_master3_assistant_wake_dispatch_rpc.sql','utf8');
const delivery=fs.readFileSync('supabase/migrations/20260922141500_master3_assistant_wake_autodelivery.sql','utf8');

assert.match(fn,/action === "assistant-channel"/);
assert.match(fn,/tokenHash/);
assert.match(fn,/rpc\/council_claim_assistant_wake/);
assert.match(fn,/rpc\/council_dispatch_assistant_wake/);
assert.match(fn,/COUNCIL_ASSISTANT_WAKE_DISPATCH_REJECTED/);
assert.match(fn,/DIRECT_MASTER3_WAKE/);
assert.match(fn,/"MASTER-3": \{ primary: "WORKER_B", fallback: "WORKER_A" \}/);

assert.match(claim,/security definer/i);
assert.match(claim,/for update/i);
assert.match(claim,/consumed_at = now\(\)/i);
assert.match(claim,/grant execute .*service_role/is);

assert.match(dispatch,/MASTER-3/);
assert.match(dispatch,/WORKER_B/);
assert.match(dispatch,/insert into public\.flix_council_dispatches/is);
assert.match(dispatch,/on conflict \(message_id\)/is);
assert.match(dispatch,/insert into public\.flix_council_events/is);
assert.match(dispatch,/grant execute .*service_role/is);

assert.match(delivery,/flixo_council_assistant_wake_notify/i);
assert.match(delivery,/net\.http_get/i);
assert.doesNotMatch(delivery,/cron\.schedule|cron\.job/i);

console.log('MASTER3_DIRECT_CHANNEL_CONTRACT=PASS');
console.log('MASTER3_DIRECT_WAKE_NONCE=PASS');
console.log('MASTER3_DIRECT_WAKE_CLAIM_RPC=PASS');
console.log('MASTER3_DIRECT_WAKE_DISPATCH_RPC=PASS');
console.log('MASTER3_WAKE_AUTODELIVERY=PASS');

assert.match(fn,/endpointEnv/);
assert.match(fn,/FLIXO_COUNCIL_WAKE/);
console.log('MASTER3_DIRECT_WAKE_PUSH_PATH=PASS');
