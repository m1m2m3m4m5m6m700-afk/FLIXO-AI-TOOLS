#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const sha='0123456789abcdef0123456789abcdef01234567';
const out='/tmp/action-repair-knowledge-audit-test.json';
execFileSync('node',['scripts/ci/action-repair-knowledge-audit.mjs',`--target-sha=${sha}`,'--run-id=TEST-AUDIT-1','--fingerprint=test-audit-fingerprint',`--output=${out}`],{stdio:'pipe'});
const x=JSON.parse(fs.readFileSync(out,'utf8'));
assert.equal(x.botId,'ACTION-REPAIR');
assert.equal(x.protocolActor,'actionRepairBot');
assert.equal(x.targetSha,sha);
assert.equal(x.architecture.repairExecutor.id,'ACTION-REPAIR');
assert.equal(x.architecture.directSelfSearch,true);
assert.equal(x.architecture.selfSearchIndex,'docs/agents/historical-action-errors/index.json');
assert.equal(x.hardConstraints.maxAttemptsPerFingerprint,1000000);
assert.equal(x.hardConstraints.mutationScope,'ERROR_ONLY');
assert.equal(x.hardConstraints.canMutateMain,false);
assert.equal(x.hardConstraints.canMutateTests,false);
assert.ok(x.currentKnowledge.valuableRules.includes('CURRENT_EXACT_SHA_ONLY'));
assert.ok(x.currentKnowledge.valuableRules.includes('SELF_SEARCH_ACTION_INDEX_BEFORE_MUTATION'));
assert.ok(x.corpus.routedTeachingRules>=0);
console.log('ACTION_REPAIR_KNOWLEDGE_AUDIT_TEST=PASS');
