#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildPhase1Report } from './auto-repair/ai-phase1.mjs';
import { globMatch, minimizeTestSet, rankRepairStrategies, securityGuardian, validatePhase1Linkage, validateReleaseIntegrity } from './auto-repair/ai-phase2.mjs';
const map={rules:[{domain:'a',patterns:['src/a/**'],commands:['npm run typecheck','npm run validate:a']},{domain:'b',patterns:['src/b/**'],commands:['npm run typecheck','npm run validate:b']},{domain:'c',patterns:['src/c/**'],commands:['npm run lint','npm run test:c']}]};
const cover=minimizeTestSet(['src/a/x.ts','src/b/y.ts'],map);assert.equal(cover.complete,true);assert.deepEqual(cover.selectedCommands,['npm run typecheck']);
const full=minimizeTestSet(['unknown/file.bin'],map);assert.equal(full.forceFull,true);
const strategy=rankRepairStrategies({strategyId:'reproduce-exact',attempt:2},{cases:[]});assert.equal(strategy.deterministicNext,'minimize-failure');assert.equal(strategy.repairAttemptRequired,true);
const noRepeat=rankRepairStrategies({strategyId:'reproduce-exact',attempt:1,rejectedByDurableLedger:[{strategyId:'reproduce-exact'}]},{cases:[]});assert.notEqual(noRepeat.deterministicNext,'reproduce-exact');assert.equal(noRepeat.durableRejected,true);
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
const headMismatch = validateReleaseIntegrity({ expectedSourceSha:'a'.repeat(40), executionSha:'b'.repeat(40), currentExecutionSha:'c'.repeat(40), prHeadSha:'b'.repeat(40), evidenceSha:'b'.repeat(40) });
assert.ok(headMismatch.failures.includes('EXECUTION_HEAD_MISMATCH'));
const prMismatch = validateReleaseIntegrity({ expectedSourceSha:'a'.repeat(40), executionSha:'b'.repeat(40), currentExecutionSha:'b'.repeat(40), prHeadSha:'c'.repeat(40), evidenceSha:'b'.repeat(40) });
assert.ok(prMismatch.failures.includes('PR_HEAD_MISMATCH'));
const promotionMainMismatch = validateReleaseIntegrity({ expectedSourceSha:'a'.repeat(40), executionSha:'b'.repeat(40), currentExecutionSha:'b'.repeat(40), prHeadSha:'b'.repeat(40), mainSha:'c'.repeat(40), promotionSha:'b'.repeat(40), mergeSha:'b'.repeat(40), mergeState:'success', evidenceSha:'b'.repeat(40), evidenceClass:'PRIMARY_EXECUTION', deploymentSha:'b'.repeat(40), requireSourceParent:false });
assert.ok(promotionMainMismatch.failures.includes('PROMOTION_MAIN_MISMATCH'));
const promotionExecutionMismatch = validateReleaseIntegrity({ expectedSourceSha:'a'.repeat(40), executionSha:'b'.repeat(40), currentExecutionSha:'b'.repeat(40), prHeadSha:'b'.repeat(40), mainSha:'b'.repeat(40), promotionSha:'c'.repeat(40), mergeSha:'c'.repeat(40), mergeState:'success', evidenceSha:'b'.repeat(40), evidenceClass:'PRIMARY_EXECUTION', deploymentSha:'c'.repeat(40), requireSourceParent:false });
assert.ok(promotionExecutionMismatch.failures.includes('PROMOTION_EXECUTION_MISMATCH'));

const mergeFailure = validateReleaseIntegrity({ expectedSourceSha:'a'.repeat(40), executionSha:'b'.repeat(40), currentExecutionSha:'b'.repeat(40), prHeadSha:'b'.repeat(40), mainSha:'b'.repeat(40), promotionSha:'b'.repeat(40), mergeSha:'b'.repeat(40), mergeState:'failure', evidenceSha:'b'.repeat(40), evidenceClass:'PRIMARY_EXECUTION', deploymentSha:'b'.repeat(40), requireSourceParent:false });
assert.ok(mergeFailure.failures.includes('MERGE_NOT_SUCCESS'));
const deploymentMismatch = validateReleaseIntegrity({ expectedSourceSha:'a'.repeat(40), executionSha:'b'.repeat(40), currentExecutionSha:'b'.repeat(40), prHeadSha:'b'.repeat(40), mainSha:'b'.repeat(40), promotionSha:'b'.repeat(40), mergeSha:'b'.repeat(40), mergeState:'success', evidenceSha:'b'.repeat(40), evidenceClass:'PRIMARY_EXECUTION', deploymentSha:'c'.repeat(40), requireSourceParent:false });
assert.ok(deploymentMismatch.failures.includes('DEPLOYMENT_IDENTITY_MISMATCH'));
const deploymentMissing = validateReleaseIntegrity({ expectedSourceSha:'a'.repeat(40), executionSha:'b'.repeat(40), currentExecutionSha:'b'.repeat(40), prHeadSha:'b'.repeat(40), mainSha:'b'.repeat(40), promotionSha:'b'.repeat(40), mergeSha:'b'.repeat(40), mergeState:'success', evidenceSha:'b'.repeat(40), evidenceClass:'PRIMARY_EXECUTION', canonicalSha:'c'.repeat(40), requireSourceParent:false });
assert.ok(deploymentMissing.failures.includes('DEPLOYMENT_IDENTITY_MISSING'));
console.log('AI_PHASE2_SELF_TEST=PASS');
assert.equal(globMatch('src/fixture\\literal.ts', 'src/fixture\\literal.ts'), true);
