#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const sha='0123456789abcdef0123456789abcdef01234567';
const out='/tmp/flixo-cell-wake-runtime-test.json';
execFileSync('node',['scripts/ci/cell-wake.mjs'],{env:{...process.env,FLIXO_CELL_EXACT_SHA:sha,FLIXO_CELL_BRANCH:'execution',FLIXO_CELL_EVENT:'test',FLIXO_CELL_WAKE_RUNTIME_OUTPUT:out},stdio:'pipe'});
const x=JSON.parse(fs.readFileSync(out,'utf8'));
assert.equal(x.exactSha,sha);
assert.equal(x.readiness,'AWAKE_AND_READY');
assert.equal(x.botCount,200);
assert.equal(x.personalMemoryFiles,200);
assert.equal(x.councilSeats.length,3);
assert.equal(x.actionRepairIncluded,false);
assert.equal(x.directMutation,false);
assert.equal(x.directRepairDispatch,false);
assert.equal(x.canonicalProofAuthority,'CI_ONLY');
console.log('CELL_WAKE_RUNTIME=PASS');
