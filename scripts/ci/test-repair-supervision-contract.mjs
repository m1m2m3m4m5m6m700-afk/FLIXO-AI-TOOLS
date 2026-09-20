import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const watchdog = read('.github/workflows/execution-bot-watchdog.yml');
const mergeGate = read('.github/workflows/auto-repair-merge-gate.yml');
const dailyGate = read('.github/workflows/daily-flixo-green-gate.yml');

assert.match(watchdog, /workflow_run:/);
assert.match(watchdog, /FLIXO Test System/);
assert.match(watchdog, /CURRENT_EXECUTION_SHA/);
assert.match(watchdog, /SOURCE_RUN_SHA/);
assert.match(watchdog, /gh\s+workflow\s+run\s+daily-flixo-green-gate\.yml/);
assert.doesNotMatch(watchdog, /gh\s+workflow\s+run\s+auto-repair\.yml/);
assert.match(dailyGate, /gh\s+workflow\s+run\s+auto-repair\.yml/);
assert.doesNotMatch(dailyGate, /gh\s+workflow\s+run\s+execution-bot-watchdog\.yml/);
assert.match(mergeGate, /pull_request:/);
assert.match(mergeGate, /branches:\s*\[main\]/);
assert.match(mergeGate, /CURRENT_EXECUTION_SHA/);
assert.match(mergeGate, /Certification/);
assert.match(mergeGate, /Repository Security Baseline/);
assert.doesNotMatch(mergeGate, /continue-on-error:\s*true/i);
assert.doesNotMatch(mergeGate, /gh\s+pr\s+merge/i);
console.log('REPAIR_SUPERVISION_CONTRACT=PASS');
