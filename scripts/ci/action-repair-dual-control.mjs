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
 const record={schemaVersion:1,botId:'ACTION-REPAIR-2',role:'ACTION_REPAIR_ASSISTANT',targetSha, fingerprint, runId:arg('run-id'), partner:'ACTION-REPAIR',observedAt:now(), redNotGreen:true, rootCause:p.rootCause||'unknown', strategy:s.strategyId||null, proposal:{auditOnly:true, recommendedStrategy:s.strategyId||null, evidenceRefs:[evidence, memory]}, learn:{retainUntilGreen:true}};
 fs.writeFileSync(proposal,JSON.stringify(record,null,2)+'\n');
 const next={...m,lastAudit:record,records:[...(m.records||[]),record].slice(-5000)};
 fs.writeFileSync(memory,JSON.stringify(next,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',botId:'ACTION-REPAIR-2',mode,redRecorded:true,targetSha},null,2)); process.exit(0);
}
if(mode==='approve'){
 if(approver!=='ACTION-REPAIR'||assistant!=='ACTION-REPAIR-2'||!shaOk(targetSha)||!fingerprint) throw new Error('ACTION_PAIR_APPROVAL_IDENTITY_INVALID');
 const p=read(approvalPath.replace(/approval\.json$/u,'proposal.json'));
 const approval={schemaVersion:1,approvalId:'ARP2-'+crypto.createHash('sha256').update(JSON.stringify({targetSha,fingerprint,p})).digest('hex').slice(0,24),approver,approvedFor:assistant,targetSha,fingerprint,approvedAt:now(),decision:'APPROVED_FOR_ASSISTANT_EXECUTION',condition:'ERROR_ONLY_EXACT_SHA'};
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
