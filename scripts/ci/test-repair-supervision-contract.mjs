import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const watchdog = read('.github/workflows/execution-bot-watchdog.yml');
const canonicalCi = read('.github/workflows/ci.yml');
const impactExecution = read('.github/workflows/test-impact-execution.yml');
const impactPlan = read('.github/workflows/test-impact.yml');
const wp0 = read('.github/workflows/wp0-trust-baseline.yml');
const twin = read('.github/workflows/auto-repair.yml');
const mergeGate = read('.github/workflows/auto-repair-merge-gate.yml');
const dailyGate = read('.github/workflows/daily-flixo-green-gate.yml');
const liveness = read('scripts/ci/agent-liveness-protocol.mjs');
const lease = read('scripts/ci/repair-lease.mjs');
const autoRepair = read('.github/workflows/auto-repair.yml');
const actionWake = read('scripts/ci/action-repair-five-workers.mjs');
const councilDirective = read('scripts/ci/council-directive.mjs');
const livenessDoc = read('docs/agents/AGENT-LIVENESS-PROTOCOL.md');

assert.match(watchdog, /workflow_dispatch:/);
assert.match(watchdog, /group:\s*flixo-execution-watchdog-\$\{\{\s*github\.run_id\s*\}\}/);
assert.match(watchdog, /cancel-in-progress:\s*false/);
assert.match(watchdog, /name: Exact-SHA observer wake/);
assert.match(watchdog, /schedule:\s*\n\s*- cron: '\*\/5 \* \* \* \*'/);
assert.match(watchdog, /workflow_run:/);
assert.doesNotMatch(watchdog, /push:\s*\n\s*branches:\s*\[execution\]/);
assert.match(watchdog, /name: Checkout trusted watchdog source/);
assert.match(watchdog, /name: Verify trusted watchdog checkout/);
assert.match(watchdog, /Capture exact execution state/);
assert.match(watchdog, /git ls-remote "https:\/\/github\.com\/\$GITHUB_REPOSITORY\.git" refs\/heads\/execution/);
assert.match(watchdog, /WATCHDOG_SCHEDULED_WAKE_REQUIRED/);
assert.match(watchdog, /WATCHDOG_SCHEDULED_WAKE_NOT_REQUIRED/);
assert.match(watchdog, /RED_WAKE_ALREADY_BACKED_BY_ACTIVE_GREEN_GATE/);
assert.match(dailyGate, /actions\/workflows\/auto-repair\.yml\/dispatches/);
assert.match(dailyGate, /contents:\s+write/);
assert.match(dailyGate, /steps\.evaluate\.outputs\.status == 'GREEN'/);
assert.doesNotMatch(dailyGate, /Wake Agent 2[\s\S]*steps\.generate_prompts\.outcome == 'success'/);
assert.doesNotMatch(dailyGate, /gh\s+workflow\s+run\s+execution-bot-watchdog\.yml/);
assert.match(mergeGate, /pull_request:/);
assert.match(mergeGate, /branches:\s*\[main\]/);
assert.match(mergeGate, /CURRENT_EXECUTION_SHA/);
assert.match(mergeGate, /Certification/);
assert.match(mergeGate, /Repository Security Baseline/);
assert.doesNotMatch(mergeGate, /continue-on-error:\s*true/i);
assert.doesNotMatch(mergeGate, /gh\s+pr\s+merge/i);
for (const workflow of [impactExecution, impactPlan, wp0]) {
  assert.match(workflow, /push:\s*\n\s*branches:\s*\[main, execution\]/);
  assert.match(workflow, /cancel-in-progress:\s*false/);
}
assert.match(canonicalCi, /push:\s*\n\s*branches:\s*\[main, execution\]/);
assert.match(canonicalCi, /group:[^\n]*github\.event\.pull_request\.head\.ref \|\| github\.ref_name/);

assert.match(livenessDoc, /TIMEOUT \/ CRASH \/ PROVIDER_FAILURE/);
assert.match(liveness, /AGENT_LIVENESS_PROTOCOL/);
assert.match(liveness, /NO_SLEEP_WHILE_WORK_ASSIGNED/);
assert.match(liveness, /RECOVER_AND_CONTINUE/);
assert.match(liveness, /maxNoProgressHeartbeats: 3/);
assert.match(liveness, /heartbeatEveryMs: 60 \* 1000/);
assert.match(liveness, /wakeIntervalMs: 60 \* 1000/);
assert.match(liveness, /heartbeatGraceMs: 30 \* 1000/);
assert.match(liveness, /scheduleIntervalMs: 5 \* 60 \* 1000/);
assert.match(liveness, /onePulsePerHeartbeat: true/);
assert.match(councilDirective, /heartbeatEveryMinutes: 1/);
assert.doesNotMatch(councilDirective, /heartbeatEveryMinutes: 5/);
const wakeRelay = read('.github/workflows/council-wake-push-relay.yml');

assert.match(watchdog, /SOURCE_EXECUTION_SHA.*steps\.source\.outputs\.execution_sha/);
assert.match(watchdog, /RESIDENT_HEARTBEAT_DISPATCH_VERIFIED=true/);
assert.match(wakeRelay, /name: FLIXO Council Wake Push Relay/);
assert.match(wakeRelay, /id-token:\s*write/);
assert.match(wakeRelay, /Verify exact execution SHA/);
assert.doesNotMatch(wakeRelay, /auto-repair\.yml.*dispatch/);
assert.match(actionWake, /readySignal:!active/);
assert.match(actionWake, /readyExactSha:!active\?targetSha:null/);
assert.match(actionWake, /nextCohortReady:packets\.filter/);
assert.doesNotMatch(actionWake, /RESIDENT_HEARTBEAT/);
assert.match(watchdog, /SOURCE_EXECUTION_SHA.*steps\.source\.outputs\.execution_sha/);
assert.match(watchdog, /RESIDENT_HEARTBEAT_DISPATCH_VERIFIED=true/);
assert.match(wakeRelay, /name: FLIXO Council Wake Push Relay/);
assert.doesNotMatch(wakeRelay, /auto-repair\.yml.*dispatch/);


assert.match(autoRepair, /Start one-minute Repair Bot lease heartbeat/);
assert.match(autoRepair, /active_worker_id/);
assert.match(autoRepair, /worker-seat|FLIXO_ACTIVE_WORKER_ID/);
assert.match(autoRepair, /repair-lease\.mjs heartbeat/);
assert.match(autoRepair, /repair-lease\.mjs heartbeat/);
assert.match(autoRepair, /REPAIR_BOT_HEARTBEAT_INTERVAL_SECONDS=60/);
assert.match(lease, /commandWorkerAssign/);
assert.match(lease, /commandWorkerState/);
assert.match(lease, /FLIXO_WORKER_HEARTBEAT_MAX_AGE_MS = 90 \* 1000/);
assert.match(lease, /cancelWorkflowRun/);
assert.match(lease, /ACTIVE_WORKER_HEARTBEAT_STALE/);
assert.match(lease, /FLIXO_WORKER_FAILOVER_CANCELLATION_FAILED/);
assert.match(lease, /FAILOVER_AFTER_STALE_HEARTBEAT/);
assert.match(lease, /commandHeartbeat/);
assert.match(lease, /REPAIR_LEASE_HEARTBEAT_STALE_USE_RECOVERY/);
assert.match(lease, /terminalRepairFailure/);
assert.match(lease, /orphanedDispatch/);
assert.match(lease, /leaseOwner.*DAILY_FLIXO_GREEN_GATE/);
assert.match(lease, /leaseAgeMs >= 2 \* 60 \* 1000/);
assert.doesNotMatch(twin, /needs\.adversarial_twin\.result != 'cancelled'/);
assert.match(twin, /timeout-minutes:\s*45/);



console.log('REPAIR_SUPERVISION_CONTRACT=PASS');
console.log('AUTOMATION_24X7_WATCHDOG_CONTRACT=PASS');
