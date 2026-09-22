#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {admit,verifyAdmission,scopeHash,fencingToken} from './execution-mutation-gate.mjs';

const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
process.env.FLIXO_MUTATION_GATE_REMOTE_SHA=sha;
process.env.FLIXO_MUTATION_GATE_TEST_MODE='true';
process.env.GITHUB_REPOSITORY='test/repo';
process.env.GITHUB_RUN_ID='12345';
process.env.GITHUB_RUN_ATTEMPT='1';
const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'flixo-mutation-gate-')),'admission.json');
const record=admit({ownerAgent:'AUTO_REPAIR_BOT',targetSha:sha,workPackageId:'WP-001',taskId:'TASK-001',paths:['src/a.ts','diagnostics/auto-repair/memory.json'],output:file});
assert.equal(record.scopeHash,scopeHash(['diagnostics/auto-repair/memory.json','src/a.ts']));
assert.equal(record.fencingToken,fencingToken({ownerAgent:'AUTO_REPAIR_BOT',runId:'12345',runAttempt:'1',targetSha:sha,workPackageId:'WP-001',taskId:'TASK-001',scopeDigest:record.scopeHash}));
assert.equal(verifyAdmission({file,phase:'pre-commit'}).fencingToken,record.fencingToken);

process.env.FLIXO_MUTATION_GATE_REMOTE_SHA='b'.repeat(40);
assert.throws(()=>verifyAdmission({file,phase:'pre-commit'}),/MUTATION_GATE_REMOTE_HEAD_CHANGED/);
process.env.FLIXO_MUTATION_GATE_REMOTE_SHA=sha;
process.env.GITHUB_RUN_ID='99999';
assert.throws(()=>verifyAdmission({file,phase:'pre-commit'}),/MUTATION_GATE_RUN_CONTEXT_STALE/);

console.log('EXECUTION_MUTATION_GATE=PASS');
console.log('EXECUTION_FENCING_TOKEN=PASS');
console.log('EXECUTION_EXACT_SHA=PASS');
console.log('EXECUTION_STALE_RUN_REJECTED=PASS');
