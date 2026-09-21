import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emptyAttemptLedger, isRepairRejected, loadAttemptLedger, recordRejectedAttempt, saveAttemptLedger } from './repair-attempt-ledger.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-ledger-'));
const file = path.join(dir, 'ledger.json');
const seed = emptyAttemptLedger({ chainId: 'chain-1', caseFingerprint: 'fp-1' });
let ledger = recordRejectedAttempt(seed, {
  chainId: 'chain-1',
  caseFingerprint: 'fp-1',
  runId: '101',
  failedSha: 'a'.repeat(40),
  strategyId: 'diff-forensics',
  ruleId: 'eslint-unused',
  outcome: 'failure',
  reason: 'self-critic-blocked',
  changedPaths: ['src/a.ts'],
});
assert.equal(isRepairRejected(ledger, { chainId: 'chain-1', caseFingerprint: 'fp-1', strategyId: 'diff-forensics', ruleId: 'other-rule' }), true);
assert.equal(isRepairRejected(ledger, { chainId: 'chain-1', caseFingerprint: 'fp-1', strategyId: 'other-strategy', ruleId: 'eslint-unused' }), true);
assert.equal(isRepairRejected(ledger, { chainId: 'chain-2', caseFingerprint: 'fp-1', strategyId: 'diff-forensics', ruleId: 'eslint-unused' }), false);
assert.equal(isRepairRejected(ledger, { chainId: 'chain-1', caseFingerprint: 'fp-2', strategyId: 'diff-forensics', ruleId: 'eslint-unused' }), false);
ledger = recordRejectedAttempt(ledger, {
  chainId: 'chain-1',
  caseFingerprint: 'fp-1',
  runId: '102',
  failedSha: 'b'.repeat(40),
  strategyId: 'diff-forensics',
  ruleId: 'eslint-unused',
  outcome: 'failure',
  reason: 'repeat-attempt',
});
assert.equal(ledger.rejected.length, 1);
assert.equal(ledger.rejected[0].seen, 2);
saveAttemptLedger(file, ledger);
const loaded = loadAttemptLedger(file, { chainId: 'chain-1', caseFingerprint: 'fp-1' });
assert.equal(loaded.rejected[0].strategyId, 'diff-forensics');
console.log('REPAIR_ATTEMPT_LEDGER_CONTRACT_SELF_TEST=PASS');
