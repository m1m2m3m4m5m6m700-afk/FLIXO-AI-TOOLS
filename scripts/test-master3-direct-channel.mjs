#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fn=fs.readFileSync('supabase/functions/flixo-council-runtime/index.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20260922140000_master3_direct_assistant_channel.sql','utf8');
const wakeMigration=fs.readFileSync('supabase/migrations/20260922141500_master3_assistant_wake_autodelivery.sql','utf8');
const registry=fs.readFileSync('docs/agents/COUNCIL-ACCOUNT-REGISTRY.md','utf8');

assert.match(fn,/action === "assistant-channel"/);
assert.match(fn,/searchParams.get\("tokenHash"\)/);
assert.match(fn,/COUNCIL_ASSISTANT_CREDENTIAL_REQUIRED/);
assert.match(fn,/purpose = "WAKE"\|\| "STATUS"/);
assert.match(fn,/COUNCIL_ASSISTANT_NONCE_REJECTED/);
assert.match(fn,/rpc\/council_claim_assistant_wake/);
assert.match(fn,/COUNCIL_ASSISTANT_EXACT_SHA_MISMATCH/);
assert.match(fn,/consumed_at=is\.null/);
assert.match(fn,/DIRECT_MASTER3_WAKE/);
assert.match(fn,/"MASTER-3": \{ primary: "WORKER_B", fallback: "WORKER_A" \}/);
assert.match(fn,/channel: "MASTER3_DIRECT_ASSISTANT"/);

assert.match(migration,/create table if not exists public\.flix_council_assistant_channel_tokens/i);
assert.match(migration,/purpose text not null check .*WAKE.*STATUS/is);
assert.match(migration,/enable row level security/i);
assert.match(migration,/token_hash text not null unique check .*64/is);
assert.match(migration,/entry_sha text not null check .*40/is);
assert.match(migration,/expires_at timestamptz not null/);
assert.match(migration,/consumed_at timestamptz/);
assert.match(registry,/MASTER-3.*WORKER_B/s);

console.log('MASTER3_DIRECT_CHANNEL_CONTRACT=PASS');
console.log('MASTER3_DIRECT_WAKE_NONCE=PASS');
console.log('MASTER3_DIRECT_STATUS_CONTRACT=PASS');
console.log('MASTER3_DIRECT_EXACT_SHA=PASS');

assert.match(wakeMigration,/pg_net/i);
assert.match(wakeMigration,/flixo_council_assistant_wake_notify/i);
assert.match(wakeMigration,/create trigger .*assistant_wake_notify/is);
assert.match(wakeMigration,/cron\.schedule/i);
assert.match(wakeMigration,/flixo-master3-assistant-wake-retry/i);
console.log('MASTER3_WAKE_AUTODELIVERY=PASS');

const claimRpc=fs.readFileSync('supabase/migrations/20260922142000_master3_assistant_channel_claim_rpc.sql','utf8');
assert.match(claimRpc,/council_claim_assistant_wake/);
assert.match(claimRpc,/security definer/i);
assert.match(claimRpc,/for update/i);
assert.match(claimRpc,/consumed_at = now\(\)/i);
assert.match(claimRpc,/grant execute .*service_role/is);
console.log('MASTER3_DIRECT_WAKE_ATOMIC_CLAIM_RPC=PASS');
