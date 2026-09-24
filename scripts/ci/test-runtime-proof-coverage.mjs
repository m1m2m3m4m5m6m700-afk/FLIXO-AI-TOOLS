import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('scripts/ci/validate-runtime-proof-coverage.mjs','utf8');
assert.match(source,/SENSITIVE_CONTRACT_CHANGES_REQUIRE_PER_COMMIT_PROOF/);
assert.match(source,/(?:^|[-_/])(liveness|wake|watchdog|lease|heartbeat|council|supersession)/);
assert.match(source,/HISTORICAL_RUNTIME_PROOF_CLOSURE-v1/);
assert.match(source,/EXACT_SHA_ALLOWLIST_ONLY/);
assert.match(source,/SEMANTIC_DUPLICATE_REMOVAL_CLOSURE/u);
assert.match(source,/db\\/council-external-accounts\\.sql/u);
assert.match(source,/countOccurrences\(parentText, signature\)/u);
assert.match(source,/countOccurrences\(childText, signature\)/u);


const closure = JSON.parse(fs.readFileSync('scripts/ci/runtime-proof-historical-closure.json','utf8'));
assert.equal(closure.schemaVersion,1);
assert.equal(closure.policy,'HISTORICAL_RUNTIME_PROOF_CLOSURE-v1');
assert.equal(closure.scope,'EXACT_SHA_ALLOWLIST_ONLY');
assert.deepEqual(
  closure.entries.map((entry) => entry.commitSha).sort(),
  [
    '846fffc9ef484f7bf1ea3d3c05c3b9adc9ba9e17',
    '9bad17db7eccc9e4b0efb252fa261b1b831b6ec2',
    'baa6a6a8b3090a2168b2203afee462bf0a107d8b',
  ],
);
for (const entry of closure.entries) {
  assert.equal(entry.evidence.conclusion,'success');
  assert.equal(entry.evidence.independent,true);
  assert.ok(Number.isInteger(entry.evidence.runId));
  assert.ok(Number.isInteger(entry.evidence.jobId));
  assert.ok(entry.evidence.requiredSteps.length >= 1);
  if (entry.commitSha === '846fffc9ef484f7bf1ea3d3c05c3b9adc9ba9e17') {
    assert.equal(entry.evidence.workflow,'Repository Security Baseline');
    assert.equal(entry.evidence.verifiedHeadSha,'9222648f7e10c08ed3a296265885d5a5d3f29d41');
    assert.deepEqual(entry.evidence.requiredSteps,['Verify exact SHA','Validate source-controlled Council RPC contract','Run repository security baseline']);
    assert.deepEqual(entry.sensitivePaths,['db/council-external-accounts.sql']);
  } else {
    assert.equal(entry.evidence.workflow,'FLIXO Advanced Repair Contract');
    assert.deepEqual(entry.sensitivePaths,['api/council/external-runtime.ts']);
  }
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
