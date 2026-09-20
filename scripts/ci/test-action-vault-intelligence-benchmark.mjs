import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const r=spawnSync(process.execPath,['scripts/ci/action-vault-intelligence-benchmark.mjs'],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr);
const report=JSON.parse(fs.readFileSync('/tmp/action-vault-intelligence-benchmark.json','utf8'));
assert.equal(report.benchmarkVersion,'ACTION-VAULT-INTELLIGENCE-BENCHMARK-v1');
assert.equal(report.cases.length,15);
assert.equal(report.weightTotal,100);
assert.equal(report.score,100);
assert.equal(report.allCasesPass,true);
assert.equal(report.allCategoriesPass,true);
assert.equal(report.noSkippedTests,true);
console.log('ACTION_VAULT_INTELLIGENCE_BENCHMARK=PASS');