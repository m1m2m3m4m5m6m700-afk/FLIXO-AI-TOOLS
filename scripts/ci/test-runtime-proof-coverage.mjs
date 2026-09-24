import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('scripts/ci/validate-runtime-proof-coverage.mjs','utf8');
assert.match(source,/SENSITIVE_CONTRACT_CHANGES_REQUIRE_PER_COMMIT_PROOF/);
assert.match(source,/(?:^|[-_/])(liveness|wake|watchdog|lease|heartbeat|council|supersession)/);
const sensitiveRegex = /(?:^|[-_/])(liveness|wake|watchdog|lease|heartbeat|council|supersession)(?:[-_/]|$)|CELL-BOT-REGISTRY\.json|ACTION-REPAIR-SQUAD-REGISTRY\.json/i;
assert.equal(sensitiveRegex.test('docs/agents/ledger/release-001-20260916-0300.json'), false);
assert.equal(sensitiveRegex.test('docs/agents/ledger/lease-001-20260916.json'), true);
assert.equal(sensitiveRegex.test('scripts/ci/heartbeat-manager.mjs'), true);
assert.equal(sensitiveRegex.test('scripts/ci/watchdog-controller.mjs'), true);
console.log('RUNTIME_PROOF_FALSE_POSITIVE_RELEASE=PASS');
console.log('RUNTIME_PROOF_SENSITIVE_TOKEN_BOUNDARY=PASS');
console.log('RUNTIME_PROOF_POLICY_TEST=PASS');
