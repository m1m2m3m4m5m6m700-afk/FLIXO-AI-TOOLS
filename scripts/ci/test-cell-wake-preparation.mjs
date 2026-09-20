#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const sha='0123456789abcdef0123456789abcdef01234567';
const out='/tmp/flixo-cell-wake-test.json';
execFileSync('node',['scripts/ci/cell-wake-preparation.mjs'],{env:{...process.env,FLIXO_WAKE_SHA:sha,FLIXO_WAKE_BRANCH:'execution',FLIXO_WAKE_EVENT:'push',FLIXO_CELL_WAKE_OUTPUT:out},stdio:'pipe'});
const x=JSON.parse(fs.readFileSync(out,'utf8'));
assert.equal(x.readiness,'AWAKE_AND_READY');
assert.equal(x.wholeCell.botCount,50);
assert.equal(Array.isArray(x.actionRepairSquad),false);
assert.equal(x.directMutation,false);
assert.equal(x.directRepairDispatch,false);
assert.equal(x.nextStage,'CANONICAL_DAILY_GREEN_GATE');
console.log('CELL_WAKE_PREPARATION=PASS');
