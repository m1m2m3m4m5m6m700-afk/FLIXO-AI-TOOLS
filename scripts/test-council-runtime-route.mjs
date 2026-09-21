#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const master = fs.readFileSync('.github/workflows/agent-master-activation.yml', 'utf8');
const watcher = fs.readFileSync('.github/workflows/council-external-lease-watch.yml', 'utf8');
const wakePush = fs.readFileSync('.github/workflows/council-wake-push-relay.yml', 'utf8');
const runtime = fs.readFileSync('supabase/functions/flixo-council-runtime/index.ts', 'utf8');

assert.match(master, /https:\/\/zrpsmgdrtwzrhkjwwujo\.supabase\.co\/functions\/v1\/flixo-council-runtime/);
assert.match(master, /\$\{COUNCIL_RUNTIME_URL%\/\}\?action=dispatch/);
assert.match(watcher, /\$\{COUNCIL_RUNTIME_URL%\/\}\?action=recover/);
assert.doesNotMatch(master, /\/api\/council\/external-runtime\?action=dispatch/);
assert.doesNotMatch(watcher, /\/api\/council\/external-runtime\?action=recover/);
assert.match(wakePush, /name: FLIXO Council Wake Push Relay/);
assert.match(wakePush, /id-token:\s*write/);
assert.match(runtime, /FLIXO Council Wake Push Relay/);
assert.match(runtime, /event === "push" && ref === "refs\/heads\/execution"/);
assert.match(runtime, /authGitHubWorkflow\(req, \["FLIXO Master Agent Activation Relay", "FLIXO Council Wake Push Relay"\]\)/);
assert.match(runtime, /job_workflow_ref/);
assert.match(runtime, /action === "activate" && req\.method === "POST"/);
assert.match(runtime, /action === "heartbeat" && req\.method === "POST"/);
assert.match(runtime, /action === "complete" && req\.method === "POST"/);
assert.doesNotMatch(runtime, /searchParams\.get\("session"\)/);

console.log('COUNCIL_GITHUB_RUNTIME_ROUTE=PASS');
console.log('COUNCIL_GITHUB_RUNTIME_LEGACY_ROUTE_REJECTED=PASS');
