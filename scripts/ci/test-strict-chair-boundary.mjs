#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(p)=>fs.readFileSync(p,'utf8');
const chair=read('scripts/ci/chair-bound-execution.mjs');
const gate=read('scripts/ci/execution-mutation-gate.mjs');
const central=read('scripts/ci/central-chair-lease.mjs');
const daily=read('.github/workflows/daily-flixo-green-gate.yml');
const auto=read('.github/workflows/auto-repair.yml');
const sync=read('.github/workflows/execution-sync.yml');
const history=read('.github/workflows/historical-action-error-index.yml');
const migration=read('supabase/migrations/20260922210000_central_chair1_lease_strictness.sql');

assert.match(central,/flix_chair1_(delegate|verify|heartbeat|release)/g);
assert.match(gate,/central-chair-lease\.mjs/);
assert.match(gate,/MUTATION_GATE_CENTRAL_CHAIR_CONTEXT_MISSING/);
assert.match(chair,/verifyCentralChairForMutation/);
assert.match(chair,/CENTRAL_CHAIR_REQUIRED_FOR_MUTATION/);
assert.match(chair,/authorizePublication[\s\S]*verifyCentralChairForMutation/);
assert.match(daily,/SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\.SUPABASE_SERVICE_ROLE_KEY \}\}/);
assert.match(daily,/central-chair-lease\.mjs delegate/);
assert.match(daily,/inputs\[central_chair_lease_id\]/);
assert.match(daily,/inputs\[central_chair_fencing_hash\]/);
assert.match(auto,/central_chair_lease_id:/);
assert.match(auto,/central_chair_fencing_hash:/);
assert.match(auto,/FLIXO_STRICT_CHAIR: 'true'/);
assert.match(auto,/central-chair-lease\.mjs verify/);
assert.doesNotMatch(sync,/git push origin execution/);
assert.doesNotMatch(history,/git push origin execution/);
assert.match(sync,/CHAIR_GUARD_BLOCKED: Execution Sync is proposal-only/);
assert.match(history,/CHAIR_GUARD_BLOCKED: Historical index may not publish directly to execution/);
assert.match(migration,/create or replace function public\.flix_chair1_delegate/);
assert.match(migration,/create or replace function public\.flix_chair1_verify/);
assert.match(migration,/create or replace function public\.flix_chair1_heartbeat/);
assert.match(migration,/create or replace function public\.flix_chair1_release/);
console.log('STRICT_CHAIR_BOUNDARY=PASS');
