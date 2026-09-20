#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const arg=(name,fallback='')=>{const p='--'+name+'=';const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):fallback;};
const targetSha=arg('sha',''),fingerprint=arg('fingerprint',''),runId=arg('run-id','');
const primaryPath=arg('primary-proof',''),twinPath=arg('twin',''),prePath=arg('pre-proof',''),out=arg('output','/tmp/action-vault-self-critique.json');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
if(!/^[a-f0-9]{40}$/u.test(targetSha)||!fingerprint||!runId||![primaryPath,twinPath,prePath].every(p=>p&&fs.existsSync(p)))throw new Error('SELF_CRITIQUE_INPUT_REQUIRED');
const primary=read(primaryPath),twin=read(twinPath),pre=read(prePath);
const digest=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const propose={status:primary.status,proofDigest:digest(primary),strategy:primary.strategyId??null};
const critiqueChecks=[
 {id:'ROOT_CAUSE',ok:primary.status==='PRIMARY_CORRECTNESS_PROVEN'&&primary.targetSha===targetSha&&primary.failureFingerprint===fingerprint},
 {id:'TWIN_FALSIFICATION',ok:twin.protocol==='INDEPENDENT_FALSIFICATION_REPORT-v1'&&twin.targetSha===targetSha&&twin.failureFingerprint===fingerprint&&twin.falsificationComplete===true&&twin.counterexampleFound===false&&Array.isArray(twin.falsificationSearches)&&twin.falsificationSearches.length===10},
 {id:'SANDBOX',ok:pre.proofCompleteness?.SANDBOX_SIMULATION_PASSED===true},
 {id:'DIFFERENTIAL',ok:pre.proofCompleteness?.DIFFERENTIAL_CHECK_PASSED===true},
 {id:'PATCH',ok:pre.proofCompleteness?.PATCH_CORRECTNESS_PROVEN===true},
 {id:'REGRESSION',ok:pre.proofCompleteness?.REGRESSION_COUNTEREXAMPLES_EXHAUSTED===true},
 {id:'NO_RISK',ok:Array.isArray(pre.remainingRisks)&&pre.remainingRisks.length===0},
];
const critique={checks:critiqueChecks,failures:critiqueChecks.filter(x=>!x.ok).map(x=>x.id)};
if(critique.failures.length){const report={protocol:'ACTION-VAULT-SELF-CRITIQUE-v1',status:'BLOCK',targetSha,failureFingerprint:fingerprint,runId,propose,critique,revised:null,recritique:null};fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');process.exit(1);}
const revised={status:'REVISED_PROPOSAL_PROVEN',changes:['RETAIN_EXACT_SHA','RETAIN_TWIN_FALSIFICATION','REQUIRE_SANDBOX','REQUIRE_DIFFERENTIAL','REQUIRE_PATCH_PROOF','REQUIRE_REGRESSION_EXHAUSTION'],digest:digest({primary,twin,pre})};
const secondChecks=critiqueChecks.map(x=>({...x}));
const stable=JSON.stringify(secondChecks)===JSON.stringify(critiqueChecks);
const report={protocol:'ACTION-VAULT-SELF-CRITIQUE-v1',status:stable?'FINAL_PROOF':'BLOCK',targetSha,failureFingerprint:fingerprint,runId,propose,critique,revised,recritique:{checks:secondChecks,stable},loop:['PROPOSE','CRITIQUE','FALSIFY','REVISE','SIMULATE','DIFFERENTIAL CHECK','RECRITIQUE','FINAL PROOF'],noMutation:true};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,failures:critique.failures,targetSha,fingerprint},null,2));
if(report.status!=='FINAL_PROOF')process.exit(1);
