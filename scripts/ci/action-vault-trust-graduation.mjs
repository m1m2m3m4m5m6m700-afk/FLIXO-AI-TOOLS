#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { runGate as runAgentGate } from './action-vault-agent-gate.mjs';

const ROOT = process.cwd();
const arg=(name,fallback='')=>{
  const p='--'+name+'=';
  const hit=process.argv.find(v=>v.startsWith(p));
  return hit ? hit.slice(p.length) : fallback;
};
const readJson=(file,fallback)=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;
const exists=(file)=>fs.existsSync(file);
const exactSha=(value)=>/^[a-f0-9]{40}$/u.test(String(value??''));

const PROFILE_PATH=path.resolve(ROOT,'diagnostics/auto-repair/action-vault/ACTION-VAULT-TRUST-GRADUATION.json');
const ACTIVITY_INDEX=path.resolve(ROOT,'docs/agents/historical-action-errors/agent-activity/index.json');
const AUTOMATIC_REPAIR=path.resolve(ROOT,'.github/workflows/auto-repair.yml');
const COLLAB_SCRIPT=path.resolve(ROOT,'scripts/ci/action-three-bot-collaboration.mjs');
const DUAL_CONTROL=path.resolve(ROOT,'scripts/ci/action-repair-dual-control.mjs');
const ENGINEERING=path.resolve(ROOT,'scripts/ci/action-repair-engineering.mjs');

const profile=readJson(PROFILE_PATH,null);
if(!profile) throw new Error('ACTION_VAULT_TRUST_PROFILE_MISSING');
if(profile.schemaVersion!==1) throw new Error('ACTION_VAULT_TRUST_PROFILE_SCHEMA_INVALID');

const errors=[];
const staticGate=runAgentGate(ROOT);
if(!staticGate?.ok && staticGate?.errors?.length) errors.push(...staticGate.errors.map(x=>'STATIC_GATE:'+x));

for(const [file,label] of [
  [AUTOMATIC_REPAIR,'auto-repair-workflow'],
  [COLLAB_SCRIPT,'three-bot-collaboration'],
  [DUAL_CONTROL,'dual-control'],
  [ENGINEERING,'repair-engineering']
]) if(!exists(file)) errors.push('REQUIRED_RUNTIME_MISSING='+label);

const workflow=exists(AUTOMATIC_REPAIR)?fs.readFileSync(AUTOMATIC_REPAIR,'utf8'):'';
const collab=exists(COLLAB_SCRIPT)?fs.readFileSync(COLLAB_SCRIPT,'utf8'):'';
const dual=exists(DUAL_CONTROL)?fs.readFileSync(DUAL_CONTROL,'utf8'):'';
const engineering=exists(ENGINEERING)?fs.readFileSync(ENGINEERING,'utf8'):'';

const invariantChecks=[
  ['execution-only-mutation',/git branch --show-current.*execution|mutationBranch.*execution/is.test(workflow)],
  ['single-owner-mutation',/sole mutation authority|ACTIVE_BROTHER|ACTION-REPAIR/u.test(workflow)],
  ['three-bot-before-mutation',/allThreeMustContributeBeforeMutation|ALL_THREE_CONTRIBUTIONS_REQUIRED/u.test(collab)],
  ['cross-learning-before-mutation',/exchangeBeforeMutation|learnedFromPeers/u.test(collab)],
  ['dual-control',/APPROVED_FOR_ASSISTANT_EXECUTION|READY_FOR_MUTATION/u.test(dual)],
  ['sandbox-and-differential',/SANDBOX_SIMULATION|DIFFERENTIAL_VERIFICATION/u.test(engineering)],
  ['canonical-green',/DAILY_FLIXO_GREEN_GATE/u.test(workflow+collab+engineering)],
  ['no-test-mutation',/noTestMutation|testsImmutable|testMutation/i.test(workflow+engineering)],
  ['main-immutable',/mainImmutable|main mutation|write main/i.test(workflow+engineering)]
];
for(const [id,ok] of invariantChecks) if(!ok) errors.push('INVARIANT_MISSING='+id);

const activity=readJson(ACTIVITY_INDEX,{records:[]});
const records=Array.isArray(activity.records)?activity.records:[];
const verified=records.filter(r=>r.status==='VERIFIED');
const distinctFingerprints=new Set(verified.map(r=>r.fingerprint).filter(Boolean));
const greenLinked=verified.filter(r=>r.green && r.green.source==='DAILY_FLIXO_GREEN_GATE' && r.green.targetSha===r.targetSha);
const exactShaBound=verified.every(r=>exactSha(r.targetSha) && r.green?.targetSha===r.targetSha);
const challengeProofs=verified.filter(r=>Array.isArray(r.timeline)&&r.timeline.some(e=>String(e.agent)==='ACTION-REPAIR-2' && /CHALLENG|VERIFY|REVIEW/i.test(String(e.phase||''))));
const handoffProofs=verified.filter(r=>Array.isArray(r.timeline)&&r.timeline.some(e=>/HANDOFF|RECOVER/i.test(String(e.phase||''))));
const learningPromotions=verified.filter(r=>Array.isArray(r.lessons)&&r.lessons.length>0);
const preventionRules=verified.flatMap(r=>Array.isArray(r.lessons)?r.lessons:[]).filter(x=>x?.preventionRule||x?.recurrenceRule);

const req=profile.graduationRequirements;
const thresholds={
  minimumVerifiedMissions:verified.length>=req.minimumVerifiedMissions,
  minimumDistinctFailureFingerprints:distinctFingerprints.size>=req.minimumDistinctFailureFingerprints,
  minimumVerifiedGreenRecords:greenLinked.length>=req.minimumVerifiedGreenRecords,
  minimumIndependentChallengeProofs:challengeProofs.length>=req.minimumIndependentChallengeProofs,
  minimumLearningPromotions:learningPromotions.length>=req.minimumLearningPromotions,
  minimumRecurrencePreventionRules:preventionRules.length>=req.minimumRecurrencePreventionRules,
  minimumRecoveryOrHandoffProofs:handoffProofs.length>=req.minimumRecoveryOrHandoffProofs,
  allVerifiedMissionsExactShaBound:exactShaBound,
  noFalseGreenEvidence:greenLinked.length===verified.length
};
const allGraduationCriteria=Object.values(thresholds).every(Boolean);
const invariantReady=invariantChecks.every(([,ok])=>ok);
const currentState=errors.length?'REVALIDATION_REQUIRED':(allGraduationCriteria?'TRUST_GRADUATED':(invariantReady?'BOUNDED_AUTONOMOUS':'CONTRACT_READY'));

const report={
  schemaVersion:1,
  authority:profile.authority,
  state:currentState,
  staticGate:{ok:errors.length===0,errorCount:errors.length},
  invariantChecks:Object.fromEntries(invariantChecks),
  graduation:{
    thresholds,
    verifiedMissionCount:verified.length,
    distinctFailureFingerprints:distinctFingerprints.size,
    greenLinkedCount:greenLinked.length,
    challengeProofCount:challengeProofs.length,
    handoffProofCount:handoffProofs.length,
    preventionRuleCount:preventionRules.length
  },
  exactShaBound,
  evidenceSource:path.relative(ROOT,ACTIVITY_INDEX),
  nextGraduationStep:allGraduationCriteria?null:'Continue Action Vault missions until every threshold is satisfied with fresh exact-SHA-bound evidence.',
  failClosed:currentState==='REVALIDATION_REQUIRED',
  generatedAt:new Date().toISOString()
};
const out=arg('output','');
if(out){
  const target=path.resolve(ROOT,out);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
if(arg('mode','report')==='strict' && currentState!=='TRUST_GRADUATED') process.exit(2);
if(errors.length>0) process.exit(1);
