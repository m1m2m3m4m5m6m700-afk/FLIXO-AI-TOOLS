import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('scripts/ci/validate-runtime-proof-coverage.mjs','utf8');
assert.match(source,/SENSITIVE_CONTRACT_CHANGES_REQUIRE_PER_COMMIT_PROOF/);
assert.match(source,/(?:^|[-_/])(liveness|wake|watchdog|lease|heartbeat|council|supersession)/);
assert.match(source,/HISTORICAL_RUNTIME_PROOF_CLOSURE-v1/);
assert.match(source,/EXACT_SHA_ALLOWLIST_ONLY/);

const closure = JSON.parse(fs.readFileSync('scripts/ci/runtime-proof-historical-closure.json','utf8'));
assert.equal(closure.schemaVersion,1);
assert.equal(closure.policy,'HISTORICAL_RUNTIME_PROOF_CLOSURE-v1');
assert.equal(closure.scope,'EXACT_SHA_ALLOWLIST_ONLY');
assert.deepEqual(
  closure.entries.map((entry) => entry.commitSha).sort(),
  [
    '9bad17db7eccc9e4b0efb252fa261b1b831b6ec2',
    'baa6a6a8b3090a2168b2203afee462bf0a107d8b',
  ],
);
for (const entry of closure.entries) {
  assert.deepEqual(entry.sensitivePaths,['api/council/external-runtime.ts']);
  assert.equal(entry.evidence.workflow,'FLIXO Advanced Repair Contract');
  assert.equal(entry.evidence.conclusion,'success');
  assert.equal(entry.evidence.independent,true);
  assert.ok(Number.isInteger(entry.evidence.runId));
  assert.ok(Number.isInteger(entry.evidence.jobId));
  assert.ok(entry.evidence.requiredSteps.length >= 1);
}
assert.equal(
  closure.entries.some((entry) => entry.commitSha === 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
  false,
);

const sensitiveRegex = /(?:^|[-_/])(liveness|wake|watchdog|lease|heartbeat|council|supersession)(?:[-_/]|$)|CELL-BOT-REGISTRY\.json|ACTION-REPAIR-SQUAD-REGISTRY\.json/i;
assert.equal(sensitiveRegex.test('docs/agents/ledger/release-001-20260916-0300.json'), false);
assert.equal(sensitiveRegex.test('docs/agents/ledger/lease-001-20260916.json'), true);
assert.equal(sensitiveRegex.test('scripts/ci/heartbeat-manager.mjs'), true);
assert.equal(sensitiveRegex.test('scripts/ci/watchdog-controller.mjs'), true);
console.log('RUNTIME_PROOF_FALSE_POSITIVE_RELEASE=PASS');
console.log('RUNTIME_PROOF_SENSITIVE_TOKEN_BOUNDARY=PASS');
console.log('RUNTIME_PROOF_POLICY_TEST=PASS');
console.log('RUNTIME_PROOF_HISTORICAL_CLOSURE=PASS');
console.log('RUNTIME_PROOF_EXACT_SHA_ALLOWLIST=PASS');
