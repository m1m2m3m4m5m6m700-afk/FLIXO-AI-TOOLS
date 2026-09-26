import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const migration = read('supabase/migrations/20260924003000_flixo_external_watchdog_v1.sql');
const externalLeaseWatcher = read('.github/workflows/council-external-lease-watch.yml');
const heartbeat = read('.github/workflows/agent-repair-heartbeat.yml');
const liveness = read('scripts/ci/agent-liveness-protocol.mjs');

assert.match(migration, /create table if not exists public\.flixo_automation_watchdog/u);
assert.match(migration, /create table if not exists public\.flixo_automation_watchdog_events/u);
assert.match(migration, /security definer/u);
assert.match(migration, /set search_path = public, pg_catalog/u);
assert.match(migration, /pg_try_advisory_xact_lock/u);
assert.match(migration, /council_recover_expired_dispatches\(25\)/u);
assert.match(migration, /flixo-automation-watchdog-v1/u);
assert.match(migration, /\* \* \* \* \*/u);
assert.match(migration, /revoke all on function public\.flixo_automation_watchdog_tick\(\)/u);
assert.match(externalLeaseWatcher, /name: FLIXO External Council Lease Watcher/u);
assert.match(externalLeaseWatcher, /cron: '\*\/5 \* \* \* \*'/u);
assert.match(heartbeat, /HEARTBEAT_24X7_MODE=true/u);
assert.match(heartbeat, /HEARTBEAT_INTERVAL_SECONDS=60/u);
assert.match(liveness, /RECOVER_AND_CONTINUE/u);
assert.match(liveness, /NO_SLEEP_WHILE_WORK_ASSIGNED/u);

console.log('AUTOMATION_24X7_WATCHDOG_CONTRACT=PASS');
