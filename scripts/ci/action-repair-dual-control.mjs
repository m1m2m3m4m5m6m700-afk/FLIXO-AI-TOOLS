#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const arg=(name,fallback='')=>{const p='--'+name+'=';const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):fallback};
const mode=arg('mode','');
const approvalPath=arg('approval','');
const heartbeatPath=arg('heartbeat','');
const targetSha=arg('target-sha','');
const fingerprint=arg('fingerprint','');
const approver=arg('approver','');
const assistant=arg('assistant','');
const out=arg('out','');
const now=()=>new Date().toISOString();
const read=(p)=>JSON.parse(fs.readFileSync(p,'utf8'));
const shaOk=x=>/^[a-f0-9]{40}$/u.test(String(x||''));
if(mode==='audit'){
 const memory=arg('memory');
 const proposal=arg('proposal');
 const evidence=arg('evidence');
 if(!shaOk(targetSha)||!fingerprint||!memory||!proposal||!evidence) throw new Error('ACTION_PAIR_AUDIT_INPUT_REQUIRED');
 const m=read(memory), p=read(evidence), s=read(arg('strategy'));
 const alternatives=(Array.isArray(p.hypotheses)?p.hypotheses:[])
   .filter((item)=>item?.id && item.id!==p.rootCause)
   .slice(0,3)
   .map((item)=>({id:item.id,score:Number(item.score??0),directMatches:Number(item.directMatches??0),specificity:Number(item.specificity??0),suppressedBy:item.suppressedBy??null}));
 const falsificationChecks=Array.isArray(p.falsificationChecks)?p.falsificationChecks:[];
 const evidenceProfile=p.evidenceProfile??null;
 const sourceMutationAllowed=p.sourceMutationAllowed===true;
 const secondHypothesis=p.secondHypothesis??alternatives[0]??null;
 if(!sourceMutationAllowed || !secondHypothesis || falsificationChecks.length<1 || Number(evidenceProfile?.diversity??0)<2){
   throw new Error('ACTION_PAIR_ADVERSARIAL_CHALLENGE_FAILED');
 }
 const record={
   schemaVersion:2,botId:'ACTION-REPAIR-2',role:'ACTION_REPAIR_ASSISTANT',verifierAgent:'actionRepairVerifier',
   status:'CHALLENGE_PASSED',challengeId:'ARP2-'+crypto.createHash('sha256').update(JSON.stringify({targetSha,fingerprint,p.rootCause,secondHypothesis})).digest('hex').slice(0,20),
   targetSha,failureFingerprint:fingerprint,fingerprint,runId:arg('run-id'),partner:'ACTION-REPAIR',observedAt:now(),redNotGreen:true,
   rootCause:p.rootCause||'unknown',strategy:s.strategyId||null,
   alternativeHypotheses:alternatives,
   falsificationChecks,
   counterEvidence:{
     mutationGate:p.mutationGate??null,
     evidenceProfile,
     sourceMutationAllowed,
     hypothesisSeparation:p.separation??null,
     causalConfidence:p.causalConfidence??null
   },
   remainingRisks:Array.isArray(p.blastRadius)?p.blastRadius:[],
   mutationRecommendation:'ALLOW',
   proposal:{auditOnly:true,recommendedStrategy:s.strategyId||null,evidenceRefs:[evidence,memory],decision:p.decision??null},
   learn:{retainUntilGreen:true}
 };
 fs.writeFileSync(proposal,JSON.stringify(record,null,2)+'\n');
 const next={...m,lastAudit:record,records:[...(m.records||[]),record].slice(-5000)};
 fs.writeFileSync(memory,JSON.stringify(next,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',botId:'ACTION-REPAIR-2',mode,redRecorded:true,targetSha},null,2)); process.exit(0);
}
if(mode==='approve'){
 if(approver!=='ACTION-REPAIR'||assistant!=='ACTION-REPAIR-2'||!shaOk(targetSha)||!fingerprint) throw new Error('ACTION_PAIR_APPROVAL_IDENTITY_INVALID');
 const p=read(approvalPath.replace(/approval\.json$/u,'proposal.json'));
 if(p.status!=='CHALLENGE_PASSED'||p.verifierAgent!=='actionRepairVerifier'||p.targetSha!==targetSha||p.failureFingerprint!==fingerprint||!Array.isArray(p.alternativeHypotheses)||p.alternativeHypotheses.length<1||!Array.isArray(p.falsificationChecks)||p.falsificationChecks.length<1) throw new Error('ACTION_PAIR_APPROVAL_REQUIRES_VERIFIED_CHALLENGE');
 const approval={schemaVersion:2,approvalId:'ARP2-'+crypto.createHash('sha256').update(JSON.stringify({targetSha,fingerprint,p})).digest('hex').slice(0,24),approver,approvedFor:assistant,targetSha,fingerprint,approvedAt:now(),decision:'APPROVED_FOR_ASSISTANT_EXECUTION',condition:'ERROR_ONLY_EXACT_SHA+VERIFIER_CHALLENGE'};
 fs.writeFileSync(approvalPath,JSON.stringify(approval,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',decision:approval.decision,approvalId:approval.approvalId},null,2)); process.exit(0);
}
if(mode==='heartbeat'){
 if(!shaOk(targetSha)||!out) throw new Error('ACTION_PAIR_HEARTBEAT_INPUT_REQUIRED');
 const hb={schemaVersion:1,primary:arg('primary'),assistant:arg('assistant'),targetSha,state:arg('state'),createdAt:now(),expiresAt:new Date(Date.now()+120000).toISOString()};
 fs.writeFileSync(out,JSON.stringify(hb,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',heartbeat:true,targetSha},null,2)); process.exit(0);
}
if(mode==='assert'){
 const a=read(approvalPath), h=read(heartbeatPath);
 if(a.decision!=='APPROVED_FOR_ASSISTANT_EXECUTION'||a.approver!=='ACTION-REPAIR'||a.approvedFor!=='ACTION-REPAIR-2'||a.targetSha!==targetSha) throw new Error('ACTION_PAIR_APPROVAL_REJECTED');
 if(h.primary!=='ACTION-REPAIR'||h.assistant!=='ACTION-REPAIR-2'||h.targetSha!==targetSha||h.state!=='READY_FOR_MUTATION') throw new Error('ACTION_PAIR_HEARTBEAT_REJECTED');
 if(Date.parse(h.expiresAt)<=Date.now()) throw new Error('ACTION_PAIR_HEARTBEAT_EXPIRED');
 console.log(JSON.stringify({status:'PASS',dualControl:true,targetSha},null,2)); process.exit(0);
}
throw new Error('ACTION_PAIR_MODE_INVALID');
