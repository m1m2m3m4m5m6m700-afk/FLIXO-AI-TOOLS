#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { appendFailureLedger, recordRed, recordAttempt, recordFailedAttempt, recordHandoff, recordPredictionOutcome, recordGreen } from './action-failure-ledger.mjs';

const original=process.cwd();
const temp=path.join(original,'diagnostics/auto-repair/action-vault/.test-ledger.ndjson');
try { if(fs.existsSync(temp)) fs.unlinkSync(temp); } catch {}
// The runtime ledger path is fixed; validate its contract through deterministic returned records.
const base={
 taskId:'TASK-LEDGER-TEST',
 failureFingerprint:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
 targetSha:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
 failedRunId:'run-ledger-test',
 botId:'ACTION-HISTORIAN-3'
};
for(const event of [
 recordRed(base),
 recordAttempt({...base,attemptedStrategy:'candidate-1'}),
 recordFailedAttempt({...base,attemptedStrategy:'candidate-1'}),
 recordHandoff({...base,notes:'owner handoff'}),
 recordPredictionOutcome({...base,accepted:false}),
 recordGreen({...base,evidence:['proof']})
]) {
 assert.ok(event.eventId.startsWith('AFL-'));
 assert.equal(event.targetSha,base.targetSha);
}
try { if(fs.existsSync(path.join(original,'diagnostics/auto-repair/action-vault/failure-ledger.ndjson'))) fs.unlinkSync(path.join(original,'diagnostics/auto-repair/action-vault/failure-ledger.ndjson')); } catch {}
console.log(JSON.stringify({status:'PASS',protocol:'ACTION_FAILURE_LEDGER_V1',assertions:12},null,2));
