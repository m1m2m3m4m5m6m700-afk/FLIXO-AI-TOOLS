#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const auto=read('.github/workflows/auto-repair.yml');
const watchdog=read('.github/workflows/execution-bot-watchdog.yml');
const green=read('.github/workflows/daily-flixo-green-gate.yml');
const learning=read('scripts/ci/auto-repair-learning.mjs');
const intake=read('.github/workflows/repair-agent-intake.yml');
const intakeScript=read('scripts/ci/repair-agent-intake.mjs');
const council=read('supabase/functions/flixo-council-runtime/index.ts');
const sw=read('public/sw.js');
const gate=read('scripts/ci/execution-mutation-gate.mjs');
const registry=read('scripts/ci/control-plane-registry.mjs');
const dbHardening=read('supabase/migrations/20260922220000_security_definer_execute_hardening.sql');

assert.match(auto,/git worktree add --detach "\$TARGET_ROOT" "\$EXECUTION_SHA"/u);
assert.doesNotMatch(auto,/git\s+(?:switch|checkout)\s+-c\s+execution/u);
assert.match(auto,/FLIXO_DETACHED_EXECUTION_TARGET=true/u);
assert.match(auto,/contents:\s*read/u);
assert.match(auto,/actions:\s*read/u);
assert.match(auto,/checks:\s*read/u);
assert.doesNotMatch(auto,/(?:pull-requests|issues|statuses|security-events):\s*write/u);

assert.match(gate,/FLIXO_DETACHED_EXECUTION_TARGET/u);
assert.match(gate,/MUTATION_GATE_DETACHED_REMOTE_HEAD_MISMATCH/u);

assert.match(watchdog,/group:\s*flixo-execution-watchdog-\$\{\{ github\.event\.workflow_run\.head_sha \|\| github\.ref_name \}\}/u);
assert.match(green,/group:\s*flixo-continuous-error-watch-\$\{\{ github\.event\.workflow_run\.head_sha \|\| github\.sha \}\}/u);
assert.match(green,/cancel-in-progress:\s*true/u);

assert.match(learning,/repair-applied.*proposed|raw === 'repair-applied'/us);
assert.match(learning,/const escalationAttempts = Number\(entry\.attempts \?\? 0\) \+ Number\(entry\.externalBlocks \?\? 0\)/u);

assert.match(intake,/Block stale incident delivery/u);
assert.match(intake,/\.incident\.staleTarget/u);
assert.match(intakeScript,/staleTarget: failedSha !== currentSha/u);

assert.match(council,/jobWorkflowSha !== trustedWorkflowSha\(workflow\)/u);
assert.match(council,/COUNCIL_GITHUB_OIDC_JOB_WORKFLOW_SHA_REJECTED/u);

assert.match(sw,/const isApiRequest = url\.pathname\.startsWith\('\/api\/'\)/u);
assert.match(sw,/hasAmbientCredentials/u);
assert.match(sw,/no-store\|private/u);

assert.match(registry,/scripts\/security\/security-red-team-runner\.mjs/u);
assert.match(registry,/docs\/agents\/SECURITY-RED-TEAM-BOTS\.json/u);
assert.match(dbHardening,/revoke execute on function public\.enforce_council_dispatch_priority\(\) from public, anon, authenticated;/u);
assert.match(dbHardening,/revoke execute on function public\.flixo_council_assistant_wake_notify\(\) from public, anon, authenticated;/u);
assert.match(dbHardening,/revoke all on table public\.flixo_council_assistant_channel_tokens from anon, authenticated;/u);
assert.match(dbHardening,/create policy flixo_council_assistant_channel_tokens_anon_deny/u);
assert.match(dbHardening,/revoke all on table public\.flix_controller_push_queue from anon, authenticated;/u);


console.log('SECURITY_REDTEAM_DEEP_REMEDIATION_CONTRACT=PASS');
