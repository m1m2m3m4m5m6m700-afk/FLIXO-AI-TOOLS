#!/usr/bin/env node
import assert from 'node:assert/strict'; import fs from 'node:fs';
const s=fs.readFileSync('scripts/ci/validate-runtime-proof-coverage.mjs','utf8');
assert.match(s,/SENSITIVE_CONTRACT_CHANGES_REQUIRE_ADJACENT_PROOF/); assert.match(s,/SENSITIVE_CONTRACT_CHANGE_WITHOUT_PROOF/); assert.match(s,/liveness|wake|watchdog/);
console.log('RUNTIME_PROOF_POLICY_TEST=PASS');
