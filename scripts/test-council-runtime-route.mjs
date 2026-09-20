#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const master = fs.readFileSync('.github/workflows/agent-master-activation.yml', 'utf8');
const watcher = fs.readFileSync('.github/workflows/council-external-lease-watch.yml', 'utf8');

assert.match(master, /https:\/\/zrpsmgdrtwzrhkjwwujo\.supabase\.co\/functions\/v1\/flixo-council-runtime/);
assert.match(master, /\$\{COUNCIL_RUNTIME_URL%\/\}\?action=dispatch/);
assert.match(watcher, /\$\{COUNCIL_RUNTIME_URL%\/\}\?action=recover/);
assert.doesNotMatch(master, /\/api\/council\/external-runtime\?action=dispatch/);
assert.doesNotMatch(watcher, /\/api\/council\/external-runtime\?action=recover/);

console.log('COUNCIL_GITHUB_RUNTIME_ROUTE=PASS');
console.log('COUNCIL_GITHUB_RUNTIME_LEGACY_ROUTE_REJECTED=PASS');
