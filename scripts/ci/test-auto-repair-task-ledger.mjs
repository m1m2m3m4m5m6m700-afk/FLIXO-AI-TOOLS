#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startTaskLedger, appendTaskEvent, finalizeTaskLedger, writeTaskLedger, loadTaskLedger } from './auto-repair-task-ledger.mjs';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-task-ledger-'));
const file=path.join(dir,'ledger.json');
const started=startTaskLedger({path:file,taskId:'task-001',repairChainId:'chain-001',failureRunId:'123',fingerprint:'abc123',failedSha:'a'.repeat(40),targetSha:'a'.repeat(40)});
appendTaskEvent(started,{type:'RCA_CAPTURED',detail:{rootCause:'validator-contract'}});
const done=finalizeTaskLedger(started,{outcome:'VERIFIED_REPAIR',candidateSha:'b'.repeat(40),rootCause:'validator-contract',changedPaths:['scripts/ci/validator.mjs'],exactShaVerified:true,canonicalGreen:false});
writeTaskLedger(file,done);
const loaded=loadTaskLedger(file);
assert.equal(loaded.taskId,'task-001');
assert.equal(loaded.status,'VERIFIED_PENDING_CANONICAL_GREEN');
assert.equal(loaded.closure.closed,false);
assert.equal(loaded.verification.exactShaVerified,true);
assert.equal(loaded.events.at(-1).type,'SESSION_FINALIZED');
assert.match(loaded.integritySha256,/^[a-f0-9]{64}$/u);
console.log('AUTO_REPAIR_TASK_LEDGER_TEST=PASS');
