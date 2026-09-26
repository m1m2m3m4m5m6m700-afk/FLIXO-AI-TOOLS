#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-wake-compliance-'));
const input=path.join(dir,'runs.json');
const output=path.join(dir,'report.json');
let report;

const base=Date.parse('2026-09-21T00:00:00Z');
const mk=(id,mins)=>({
 id,status:'completed',conclusion:'success',event:'schedule',
 runStartedAt:new Date(base+mins*60000).toISOString(),
 createdAt:new Date(base+mins*60000).toISOString(),
 headSha:'a'.repeat(40)
});

// Historical gaps must not poison the recovered rolling compliance window.
const historicalGap = [mk(1,0), mk(2,10), ...Array.from({length: 11}, (_, i) => mk(i+3, 15 + (i * 5)))];
fs.writeFileSync(input,JSON.stringify(historicalGap));
let r=spawnSync(process.execPath,['scripts/ci/wake-compliance.mjs',input,output,'--now=2026-09-21T01:06:00Z'],{encoding:'utf8'});
assert.equal(r.status,0);
report=JSON.parse(fs.readFileSync(output,'utf8'));
assert.equal(report.status,'PASS');
assert.equal(report.historicalSampleCount,1);
assert.equal(report.rollingWindowRuns,12);
assert.equal(report.gaps.length,0);
fs.writeFileSync(input,JSON.stringify([mk(1,0),mk(2,5),mk(3,10)]));
r=spawnSync(process.execPath,['scripts/ci/wake-compliance.mjs',input,output,'--now=2026-09-21T00:11:00Z'],{encoding:'utf8'});
assert.equal(r.status,0);
report=JSON.parse(fs.readFileSync(output,'utf8'));
assert.equal(report.status,'PASS');
assert.equal(report.gaps.length,0);
assert.equal(report.expectedEveryMs,5*60*1000);
assert.equal(report.maxAllowedGapMs,8*60*1000);
assert.equal(report.exactScheduleRequired,'*/5 * * * *');

fs.writeFileSync(input,JSON.stringify([mk(1,0),mk(2,10)]));
r=spawnSync(process.execPath,['scripts/ci/wake-compliance.mjs',input,output,'--now=2026-09-21T00:16:00Z'],{encoding:'utf8'});
assert.equal(r.status,2);
report=JSON.parse(fs.readFileSync(output,'utf8'));
assert.equal(report.status,'WAKE_GAP_RED');
assert.equal(report.gaps.length,1);

fs.writeFileSync(input,JSON.stringify([mk(1,0)]));
r=spawnSync(process.execPath,['scripts/ci/wake-compliance.mjs',input,output,'--now=2026-09-21T00:01:00Z'],{encoding:'utf8'});
assert.equal(r.status,0);
report=JSON.parse(fs.readFileSync(output,'utf8'));
assert.equal(report.status,'BASELINE_REQUIRED');

// Production heartbeat also consumes watchdog schedule evidence. Injecting that source here
// keeps the merge deterministic and verifies schedule/run-source fusion without network access.
const fused = {
  workflow_runs: [
    { ...mk(1,0), event:'workflow_dispatch' },
  ],
  watchdogRuns: [
    { ...mk(2,5), event:'workflow_run' },
    { ...mk(3,10), event:'workflow_run' },
    { ...mk(4,15), event:'workflow_run' },
  ],
};
fs.writeFileSync(input,JSON.stringify(fused));
r=spawnSync(process.execPath,['scripts/ci/wake-compliance.mjs',input,output,'--now=2026-09-21T00:16:00Z'],{encoding:'utf8'});
assert.equal(r.status,0);
report=JSON.parse(fs.readFileSync(output,'utf8'));
assert.equal(report.status,'PASS');
assert.equal(report.sampleCount,4);
assert.equal(report.latest.id,4);
assert.equal(report.latest.conclusion,'success');
assert.equal(report.latest.event,'watchdog-observer');
assert.equal(report.watchdogRunsIncluded,3);

fs.rmSync(dir,{recursive:true,force:true});
console.log(JSON.stringify({status:'PASS',authority:'FLIXO_WAKE_COMPLIANCE_TEST',assertions:8},null,2));
