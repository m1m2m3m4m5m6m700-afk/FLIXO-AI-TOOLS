#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { verifyCanonicalRepairContext } from './ai-phase1.mjs';
import { calculateImpact } from '../impact/engine.ts';
import { CI_CONTRACTS } from '../contracts/registry.ts';

export const PHASE2_AGENTS = Object.freeze(['REPAIR_STRATEGY','TEST_SET_COVER_MINIMIZER','SECURITY_GUARDIAN','RELEASE_INTEGRITY']);
const ROOT=process.cwd();
const MAP=path.resolve(ROOT,'scripts/ci/test-impact-map.json');
const OUT=process.env.FLIXO_AI_PHASE2_PATH??'/tmp/flixo-ai-phase2.json';
const STRATEGY=process.env.FLIXO_REPAIR_STRATEGY_PATH??'/tmp/flixo-repair-strategy.json';
const EVIDENCE=process.env.FLIXO_REPAIR_EVIDENCE_PATH??'/tmp/flixo-repair-evidence.json';
const PHASE1=process.env.FLIXO_AI_PHASE1_PATH??'/tmp/flixo-ai-phase1.json';
const git=(args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const sha40=(v)=>/^[a-f0-9]{40}$/u.test(String(v??''));
const uniq=(v)=>[...new Set(v.filter(Boolean))];
const norm=(v)=>String(v??'').replaceAll('\\','/').replace(/^\.\//u,'');
const readJson=(f,d)=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return d;}};
function cost(c){const s=String(c);if(/^npm run validate:/u.test(s))return 1;if(/^npm run (typecheck|lint)$/u.test(s))return 2;if(/^npm run test:/u.test(s))return 3;if(/^npm ci\b/u.test(s))return 4;return 4;}
function globMatch(file,pattern){const e=String(pattern).replace(/[.\^$+?()|[\]{}]/g,'\\$&').replace(/\*\*/g,'§§').replace(/\*/g,'[^/]*').replace(/§§/g,'.*').replace(/\?/g,'.');return new RegExp('^'+e+'$').test(file);}

export function rankRepairStrategies(strategy={},memory={},context={}){
 const ids=['reproduce-exact','minimize-failure','diff-forensics','environment-audit','workflow-forensics','observability-trace','historical-analogy','synthetic-reproduction','alternate-hypothesis','supervising-escalation'];
 const attempt=Number(strategy.attempt??0);const selected=String(strategy.strategyId??'');
 const next=attempt>0?ids[(attempt-1)%ids.length]:(selected||ids[0]);
 const failedHistory=(memory.cases??[]).flatMap(x=>x.outcomes??[]).filter(x=>x.outcome!=='success').slice(-8);
 const repeatPenalty=failedHistory.filter(x=>x.strategyId===selected).length;
 return Object.freeze({schemaVersion:1,inputStrategy:selected||null,attempt,deterministicNext:next,repeatPenalty,teachingEscalation:strategy.teachingEscalation===true,repairAttemptRequired:true,sourceSha:context.sourceSha||null,failureFingerprint:context.failure?.fingerprint||null,impactEscalation:context.impact?.escalation||null});
}

export function minimizeTestSet(changedFiles=[],impactMap={}){
 const files=uniq(changedFiles.map(norm));const rules=Array.isArray(impactMap.rules)?impactMap.rules:[];const matched=[];const unknown=[];
 for(const file of files){const hits=rules.filter(r=>(r.patterns??[]).some(p=>globMatch(file,p)));if(!hits.length)unknown.push(file);else matched.push(...hits.map(r=>({...r,file})));}
 if(unknown.length)return Object.freeze({schemaVersion:1,algorithm:'WEIGHTED_GREEDY_SET_COVER',universe:['FULL_CANONICAL'],covered:['FULL_CANONICAL'],domains:uniq(matched.map(x=>x.domain)),unknownFiles:unknown,forceFull:true,selectedCommands:['npm run test:static','npm run test:build','npm run test:browser'],cost:12,complete:true,reason:'unknown-file-conservative-full'});
 if(!files.length)return Object.freeze({schemaVersion:1,algorithm:'WEIGHTED_GREEDY_SET_COVER',universe:[],covered:[],domains:[],unknownFiles:[],forceFull:false,selectedCommands:[],cost:0,complete:true,reason:'no-changed-files'});
 const domains=uniq(matched.map(x=>x.domain));const candidates=new Map();
 for(const item of matched)for(const command of item.commands??[]){const e=candidates.get(command)??{command,domains:new Set(),cost:cost(command)};e.domains.add(item.domain);candidates.set(command,e);}
 const remaining=new Set(domains);const chosen=[];
 while(remaining.size){let best=null;for(const e of candidates.values()){const gain=[...e.domains].filter(d=>remaining.has(d)).length;if(!gain)continue;const ratio=gain/e.cost;if(!best||ratio>best.ratio||(ratio===best.ratio&&gain>best.gain)||(ratio===best.ratio&&gain===best.gain&&e.command.localeCompare(best.e.command)<0))best={e,gain,ratio};}if(!best)break;chosen.push(best.e.command);for(const d of best.e.domains)remaining.delete(d);candidates.delete(best.e.command);}
 const selected=uniq(chosen);return Object.freeze({schemaVersion:1,algorithm:'WEIGHTED_GREEDY_SET_COVER',universe:domains,covered:domains.filter(d=>!remaining.has(d)),domains,unknownFiles:[],forceFull:false,selectedCommands:selected,cost:selected.reduce((n,c)=>n+cost(c),0),complete:remaining.size===0,uncovered:[...remaining],reason:'minimum-cost-greedy-domain-cover'});
}

export function securityGuardian({changedFiles=[],branch='execution'}={}){
 const files=uniq(changedFiles.map(norm));const violations=[];if(branch!=='execution')violations.push('BRANCH_NOT_EXECUTION');
 for(const f of files){if(/(^|\/)\.env(?:\.|$)/iu.test(f)||/\.(pem|key|p12|pfx)$/iu.test(f)||/(^|\/)secrets?\//iu.test(f))violations.push('SENSITIVE_PATH:'+f);if(f.startsWith('.github/workflows/'))violations.push('WORKFLOW_MUTATION:'+f);if(f==='scripts/ci/control-plane-registry.mjs'||f==='scripts/ci/auto-repair-policy.mjs'||f==='scripts/ci/auto-repair-engine.mjs'||f.startsWith('scripts/ci/auto-repair/'))violations.push('CONTROL_PLANE_MUTATION:'+f);}
 const baseline=spawnSync(process.execPath,['scripts/ci/repository-security-baseline.mjs'],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']});if(baseline.status!==0)violations.push('REPOSITORY_SECURITY_BASELINE_FAILED');
 return Object.freeze({schemaVersion:1,status:violations.length?'BLOCK':'PASS',violations,checkedFiles:files,baselineExit:baseline.status??1});
}

function parentOf(sha){if(!sha40(sha))return null;try{return git(['rev-parse',sha+'^']);}catch{return null;}}
export function validateReleaseIntegrity({expectedSourceSha='',executionSha='',currentExecutionSha='',prHeadSha='',mainSha='',promotionSha='',mergeSha='',mergeState='',evidenceSha='',evidenceClass='',deploymentSha='',requireSourceParent=true}={}){
 const f=[];if(!sha40(expectedSourceSha))f.push('SOURCE_SHA_MISSING');if(!sha40(executionSha))f.push('EXECUTION_SHA_MISSING');if(!sha40(currentExecutionSha))f.push('CURRENT_EXECUTION_SHA_MISSING');if(executionSha&&currentExecutionSha&&executionSha!==currentExecutionSha)f.push('EXECUTION_HEAD_MISMATCH');if(prHeadSha&&executionSha&&prHeadSha!==executionSha)f.push('PR_HEAD_MISMATCH');if(mainSha&&promotionSha&&mainSha!==promotionSha)f.push('PROMOTION_MAIN_MISMATCH');if(executionSha&&promotionSha&&promotionSha!==executionSha)f.push('PROMOTION_EXECUTION_MISMATCH');if(promotionSha&&mergeSha&&promotionSha!==mergeSha)f.push('MERGE_SHA_MISMATCH');if(mergeState&&mergeState!=='success')f.push('MERGE_NOT_SUCCESS');if(evidenceSha&&executionSha&&evidenceSha!==executionSha)f.push('EVIDENCE_SHA_MISMATCH');if(evidenceClass&&evidenceClass!=='PRIMARY_EXECUTION')f.push('EVIDENCE_CLASS_INVALID');if(promotionSha&&!mainSha)f.push('PROMOTION_MAIN_MISSING');if(promotionSha&&!mergeSha)f.push('MERGE_SHA_MISSING');if(promotionSha&&!deploymentSha)f.push('DEPLOYMENT_IDENTITY_MISSING');const parent=parentOf(executionSha);if(requireSourceParent&&expectedSourceSha&&parent&&parent!==expectedSourceSha)f.push('SOURCE_NOT_EXECUTION_PARENT');
 return Object.freeze({schemaVersion:1,status:f.length?'BLOCK':'PASS',failures:f,chain:{sourceSha:expectedSourceSha||null,executionSha:executionSha||null,parentSha:parent,prHeadSha:prHeadSha||null,mainSha:mainSha||null,promotionSha:promotionSha||null,mergeSha:mergeSha||null,evidenceSha:evidenceSha||null,deploymentSha:deploymentSha||null,evidenceClass:evidenceClass||null}});
}

function changedFiles(){return uniq(execFileSync('git',['diff','--name-only'],{cwd:ROOT,encoding:'utf8'}).split(/\r?\n/u).map(norm));}

export function validatePhase1Linkage({ phase1Report = null, currentSha = '', branch = 'execution', workingChangedFiles = [] } = {}) {
 const failures=[];
 if(!phase1Report || phase1Report.protocol!=='FLIXO-AI-PHASE1' || phase1Report.mode!=='POSTFLIGHT') failures.push('PHASE1_REPORT_INVALID');
 const context=phase1Report?.canonicalRepairContext;
 const contextIntegrity=verifyCanonicalRepairContext(context);
 if(!contextIntegrity.ok) failures.push(contextIntegrity.reason);
 if(branch!=='execution') failures.push('BRANCH_NOT_EXECUTION');
 if(!sha40(currentSha)) failures.push('CURRENT_EXECUTION_SHA_INVALID');
 if(context?.branch && context.branch!=='execution') failures.push('PHASE1_CONTEXT_BRANCH_INVALID');
 if(context?.sourceSha && currentSha && context.sourceSha!==currentSha) failures.push('PHASE1_SOURCE_SHA_HEAD_MISMATCH');
 const expectedFiles=uniq((context?.impact?.changedFiles??[]).map(norm));
 const actualFiles=uniq(workingChangedFiles.map(norm));
 if(JSON.stringify(expectedFiles)!==JSON.stringify(actualFiles)) failures.push('PHASE1_CHANGED_FILES_MISMATCH');
 if(!context?.failure?.evidencePresent || !context?.failure?.fingerprint) failures.push('PHASE1_FAILURE_EVIDENCE_MISSING');
 if(context?.impact){
   const recalculated=calculateImpact(expectedFiles,CI_CONTRACTS);
   if(recalculated.escalation!==context.impact.escalation) failures.push('PHASE1_IMPACT_ESCALATION_DRIFT');
   if(JSON.stringify(uniq(recalculated.affectedContracts??[]).sort())!==JSON.stringify(uniq(context.impact.affectedContracts??[]).sort())) failures.push('PHASE1_IMPACT_CONTRACT_DRIFT');
 }
 return Object.freeze({ok:failures.length===0,failures,contextHash:context?.contextHash??null,sourceSha:context?.sourceSha??null,failureFingerprint:context?.failure?.fingerprint??null,changedFiles:expectedFiles,impactEscalation:context?.impact?.escalation??null});
}

function guard(){
 const strategy=readJson(STRATEGY,{});const memory=readJson(process.env.FLIXO_REPAIR_MEMORY??'diagnostics/auto-repair/memory.json',{cases:[]});const map=readJson(MAP,{});const phase1Report=readJson(PHASE1,null);const branch=git(['branch','--show-current']);const currentSha=git(['rev-parse','HEAD']);const files=changedFiles();
 const upstream=validatePhase1Linkage({phase1Report,currentSha,branch,workingChangedFiles:files});
 const context=phase1Report?.canonicalRepairContext??{};
 const strategyDecision=rankRepairStrategies(strategy,memory,context);const cover=minimizeTestSet(upstream.ok?upstream.changedFiles:[],map);const security=upstream.ok?securityGuardian({changedFiles:upstream.changedFiles,branch}):Object.freeze({schemaVersion:1,status:'BLOCK',violations:['PHASE1_CONTEXT_BLOCKED'],checkedFiles:files,baselineExit:1});
 const report={schemaVersion:2,protocol:'FLIXO-AI-PHASE2',mode:'POST_MUTATION_GUARD',generatedAt:new Date().toISOString(),agents:PHASE2_AGENTS,upstreamPhase1:{protocol:'FLIXO-AI-PHASE1',contextHash:upstream.contextHash,sourceSha:upstream.sourceSha,failureFingerprint:upstream.failureFingerprint,changedFiles:upstream.changedFiles,impactEscalation:upstream.impactEscalation},repairStrategy:strategyDecision,testSetCover:cover,securityGuardian:security,overallStatus:upstream.ok&&strategyDecision.repairAttemptRequired&&cover.complete&&security.status==='PASS'?'PASS':'BLOCK'};
 fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');if(report.overallStatus!=='PASS')process.exitCode=1;console.log(JSON.stringify(report,null,2));
}
function releaseHandoff(){
 const evidence=readJson(EVIDENCE,{});const phase1Report=readJson(PHASE1,null);const phase2Guard=readJson(OUT,null);const current=git(['rev-parse','HEAD']);const context=phase1Report?.canonicalRepairContext??{};
 const contextIntegrity=verifyCanonicalRepairContext(context);const upstreamFailures=[];
 if(!contextIntegrity.ok) upstreamFailures.push(contextIntegrity.reason);
 if(phase1Report?.mode!=='POSTFLIGHT') upstreamFailures.push('PHASE1_REPORT_NOT_POSTFLIGHT');
 if(phase2Guard?.mode!=='POST_MUTATION_GUARD'||phase2Guard?.overallStatus!=='PASS') upstreamFailures.push('PHASE2_GUARD_NOT_PASS');
 if(phase2Guard?.upstreamPhase1?.contextHash!==context.contextHash) upstreamFailures.push('PHASE2_CONTEXT_HASH_DRIFT');
 const source=String(evidence.targetSha??process.env.FLIXO_FAILED_SHA??context.sourceSha??'');
 if(source!==String(context.sourceSha??'')) upstreamFailures.push('EVIDENCE_PHASE1_SOURCE_SHA_MISMATCH');
 if(evidence.fingerprint && evidence.fingerprint!==context.failure?.fingerprint) upstreamFailures.push('EVIDENCE_PHASE1_FINGERPRINT_MISMATCH');
 const execution=String(process.env.FLIXO_EXECUTION_SHA??current);
 const integrity=validateReleaseIntegrity({expectedSourceSha:source,executionSha:execution,currentExecutionSha:current,prHeadSha:process.env.FLIXO_PR_HEAD_SHA??execution,evidenceSha:execution,evidenceClass:'PRIMARY_EXECUTION'});
 const finalStatus=upstreamFailures.length?'BLOCK':integrity.status;
 const report={schemaVersion:2,protocol:'FLIXO-AI-PHASE2',mode:'RELEASE_HANDOFF',generatedAt:new Date().toISOString(),agents:PHASE2_AGENTS,upstreamPhase1:{contextHash:context.contextHash??null,sourceSha:context.sourceSha??null,failureFingerprint:context.failure?.fingerprint??null},upstreamFailures,releaseIntegrity:integrity,overallStatus:finalStatus};fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');if(finalStatus!=='PASS')process.exitCode=1;console.log(JSON.stringify(report,null,2));
}
function runRelease(){
 const evidence=readJson(path.resolve(ROOT,process.env.FLIXO_DEPLOYMENT_EVIDENCE_PATH??'production-deployment-evidence.json'),{});
 const promotion=String(process.env.FLIXO_PROMOTION_SHA??git(['rev-parse','HEAD']));const main=String(process.env.FLIXO_MAIN_SHA??git(['rev-parse','HEAD']));const ci=String(process.env.FLIXO_CI_CONCLUSION??'success');const deployment=String(evidence.deploymentSha??evidence.canonicalSha??'');
 const integrity=evidence.status==='BLOCKED_EXTERNAL' ? {schemaVersion:1,status:'BLOCKED_EXTERNAL',failures:['EXTERNAL_DEPLOYMENT_BLOCK'],chain:{mainSha:main,promotionSha:promotion,mergeSha:promotion,deploymentSha:deployment||null}} : validateReleaseIntegrity({expectedSourceSha:promotion,executionSha:promotion,currentExecutionSha:main,prHeadSha:promotion,mainSha:main,promotionSha:promotion,mergeSha:promotion,mergeState:ci,evidenceSha:promotion,evidenceClass:'PRIMARY_EXECUTION',deploymentSha:deployment,requireSourceParent:false});
 const report={schemaVersion:1,protocol:'FLIXO-AI-PHASE2',mode:'RELEASE',generatedAt:new Date().toISOString(),agents:PHASE2_AGENTS,releaseIntegrity:integrity};fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');if(integrity.status!=='PASS'&&integrity.status!=='BLOCKED_EXTERNAL')process.exitCode=1;console.log(JSON.stringify(report,null,2));
}
const mode=process.argv.includes('--guard')?'guard':process.argv.includes('--release-handoff')?'release-handoff':process.argv.includes('--release')?'release':' ';if(mode==='guard')guard();else if(mode==='release-handoff')releaseHandoff();else if(mode==='release')runRelease();else{console.error('Usage: --guard|--release-handoff|--release');process.exit(2);}