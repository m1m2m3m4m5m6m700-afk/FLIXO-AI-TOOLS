#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildPhase1Report } from './auto-repair/ai-phase1.mjs';
import { minimizeTestSet, rankRepairStrategies, securityGuardian, validatePhase1Linkage, validateReleaseIntegrity } from './auto-repair/ai-phase2.mjs';
const map={rules:[{domain:'a',patterns:['src/a/**'],commands:['npm run typecheck','npm run validate:a']},{domain:'b',patterns:['src/b/**'],commands:['npm run typecheck','npm run validate:b']},{domain:'c',patterns:['src/c/**'],commands:['npm run lint','npm run test:c']}]};
const cover=minimizeTestSet(['src/a/x.ts','src/b/y.ts'],map);assert.equal(cover.complete,true);assert.deepEqual(cover.selectedCommands,['npm run typecheck']);
const full=minimizeTestSet(['unknown/file.bin'],map);assert.equal(full.forceFull,true);
const strategy=rankRepairStrategies({strategyId:'reproduce-exact',attempt:2},{cases:[]});assert.equal(strategy.deterministicNext,'minimize-failure');assert.equal(strategy.repairAttemptRequired,true);
assert.equal(strategy.sourceSha, null);
const blocked=securityGuardian({changedFiles:['.env.production'],branch:'execution'});assert.equal(blocked.status,'BLOCK');assert.ok(blocked.violations.some(x=>x.startsWith('SENSITIVE_PATH:')));
const integrity=validateReleaseIntegrity({expectedSourceSha:'a'.repeat(40),executionSha:'b'.repeat(40),currentExecutionSha:'b'.repeat(40),prHeadSha:'b'.repeat(40),evidenceSha:'b'.repeat(40)});assert.equal(integrity.status,'BLOCK');
const releasePass=validateReleaseIntegrity({expectedSourceSha:'a'.repeat(40),executionSha:'b'.repeat(40),currentExecutionSha:'b'.repeat(40),prHeadSha:'b'.repeat(40),mainSha:'b'.repeat(40),promotionSha:'b'.repeat(40),mergeSha:'b'.repeat(40),mergeState:'success',evidenceSha:'b'.repeat(40),evidenceClass:'PRIMARY_EXECUTION',deploymentSha:'b'.repeat(40),requireSourceParent:false});assert.equal(releasePass.status,'PASS');

const p1 = buildPhase1Report({
  mode:'POSTFLIGHT',
  log:'failure',
  expectedSha:'a'.repeat(40),
  currentSha:'a'.repeat(40),
  remoteSha:'a'.repeat(40),
  branch:'execution',
  targetSelection:{exact:true,commands:[]},
  targetIdentity:{ok:true},
  changedFiles:[],
});
const linked = validatePhase1Linkage({phase1Report:p1,currentSha:'a'.repeat(40),branch:'execution',workingChangedFiles:[]});
assert.equal(linked.ok,true);
const tampered = JSON.parse(JSON.stringify(p1));
tampered.canonicalRepairContext.sourceSha='b'.repeat(40);
const tamperedCheck = validatePhase1Linkage({phase1Report:tampered,currentSha:'a'.repeat(40),branch:'execution',workingChangedFiles:[]});
assert.equal(tamperedCheck.ok,false);
assert.ok(tamperedCheck.failures.includes('CONTEXT_HASH_MISMATCH'));
const fileDrift = validatePhase1Linkage({phase1Report:p1,currentSha:'a'.repeat(40),branch:'execution',workingChangedFiles:['src/drift.ts']});
assert.equal(fileDrift.ok,false);
assert.ok(fileDrift.failures.includes('PHASE1_CHANGED_FILES_MISMATCH'));
console.log('AI_PHASE2_SELF_TEST=PASS');