#!/usr/bin/env node
import assert from 'node:assert/strict';
import { minimizeTestSet, rankRepairStrategies, securityGuardian, validateReleaseIntegrity } from './auto-repair/ai-phase2.mjs';
const map={rules:[{domain:'a',patterns:['src/a/**'],commands:['npm run typecheck','npm run validate:a']},{domain:'b',patterns:['src/b/**'],commands:['npm run typecheck','npm run validate:b']},{domain:'c',patterns:['src/c/**'],commands:['npm run lint','npm run test:c']}]};
const cover=minimizeTestSet(['src/a/x.ts','src/b/y.ts'],map);assert.equal(cover.complete,true);assert.deepEqual(cover.selectedCommands,['npm run typecheck']);
const full=minimizeTestSet(['unknown/file.bin'],map);assert.equal(full.forceFull,true);
const strategy=rankRepairStrategies({strategyId:'reproduce-exact',attempt:2},{cases:[]});assert.equal(strategy.deterministicNext,'minimize-failure');assert.equal(strategy.repairAttemptRequired,true);
const blocked=securityGuardian({changedFiles:['.env.production'],branch:'execution'});assert.equal(blocked.status,'BLOCK');assert.ok(blocked.violations.some(x=>x.startsWith('SENSITIVE_PATH:')));
const integrity=validateReleaseIntegrity({expectedSourceSha:'a'.repeat(40),executionSha:'b'.repeat(40),currentExecutionSha:'b'.repeat(40),prHeadSha:'b'.repeat(40),evidenceSha:'b'.repeat(40)});assert.equal(integrity.status,'BLOCK');
const releasePass=validateReleaseIntegrity({expectedSourceSha:'a'.repeat(40),executionSha:'b'.repeat(40),currentExecutionSha:'b'.repeat(40),prHeadSha:'b'.repeat(40),mainSha:'b'.repeat(40),promotionSha:'b'.repeat(40),mergeSha:'b'.repeat(40),mergeState:'success',evidenceSha:'b'.repeat(40),evidenceClass:'PRIMARY_EXECUTION',deploymentSha:'b'.repeat(40),requireSourceParent:false});assert.equal(releasePass.status,'PASS');
console.log('AI_PHASE2_SELF_TEST=PASS');