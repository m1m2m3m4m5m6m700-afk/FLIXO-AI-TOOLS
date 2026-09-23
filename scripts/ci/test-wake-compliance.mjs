#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-wake-compliance-'));
const input=path.join(dir,'runs.json');
const output=path.join(dir,'report.json');

const base=Date.parse('2026-09-21T00:00:00Z');
const mk=(id,mins)=>({
 id,status:'completed',conclusion:'success',event:'schedule',
 runStartedAt:new Date(base+mins*60000).toISOString(),
 createdAt:new Date(base+mins*60000).toISOString(),
 headSha:'a'.repeat(40)
});

// Historical gaps must not poison the recovered rolling compliance window.
const historicalGap = [mk(1,0), mk(2,60), ...Array.from({length: 12}, (_, i) => mk(i+3, 70 + (i * 5)))];
fs.writeFileSync(input,JSON.stringify(historicalGap));
r=spawnSync(process.execPath,['scripts/ci/wake-compliance.mjs',input,output,'--now=2026-09-21T01:40:00Z'],{encoding:'utf8'});
assert.equal(r.status,0);
report=JSON.parse(fs.readFileSync(output,'utf8'));
assert.equal(report.status,'PASS');
assert.equal(report.historicalSampleCount,1);
assert.equal(report.rollingWindowRuns,12);
assert.equal(report.gaps.length,0);
fs.writeFileSync(input,JSON.stringify([mk(1,0),mk(2,5),mk(3,10)]));
let r=spawnSync(process.execPath,['scripts/ci/wake-compliance.mjs',input,output,'--now=2026-09-21T00:11:00Z'],{encoding:'utf8'});
assert.equal(r.status,0);
let report=JSON.parse(fs.readFileSync(output,'utf8'));
assert.equal(report.status,'PASS');
assert.equal(report.gaps.length,0);
assert.equal(report.maxAllowedGapMs,7*60000);

fs.writeFileSync(input,JSON.stringify([mk(1,0),mk(2,10)]));
r=spawnSync(process.execPath,['scripts/ci/wake-compliance.mjs',input,output,'--now=2026-09-21T00:11:00Z'],{encoding:'utf8'});
assert.equal(r.status,2);
report=JSON.parse(fs.readFileSync(output,'utf8'));
assert.equal(report.status,'WAKE_GAP_RED');
assert.equal(report.gaps.length,1);

fs.writeFileSync(input,JSON.stringify([mk(1,0)]));
r=spawnSync(process.execPath,['scripts/ci/wake-compliance.mjs',input,output,'--now=2026-09-21T00:01:00Z'],{encoding:'utf8'});
assert.equal(r.status,0);
report=JSON.parse(fs.readFileSync(output,'utf8'));
assert.equal(report.status,'BASELINE_REQUIRED');

fs.rmSync(dir,{recursive:true,force:true});
console.log(JSON.stringify({status:'PASS',authority:'FLIXO_WAKE_COMPLIANCE_TEST',assertions:8},null,2));
