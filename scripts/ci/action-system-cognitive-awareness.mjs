#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const arg=(name,fallback='')=>{const p='--'+name+'=';const hit=process.argv.find(v=>v.startsWith(p));return hit?hit.slice(p.length):fallback;};
const output=arg('output','/tmp/action-system-cognitive-awareness.json');
const taskId=arg('task','');
const targetSha=arg('sha','');
const fingerprint=arg('fingerprint','');
const failedRunId=arg('run-id','');
const fileSelectionPath=arg('file-selection','');
const failureLogPath=arg('log','');
const diagnosisPath=arg('diagnosis','');
const twinPath=arg('twin','');
const rootCausePath=arg('root-cause','');
if(!taskId||!/^[a-f0-9]{40}$/.test(targetSha)||!fingerprint||!failedRunId)throw new Error('ACTION_AWARENESS_IDENTITY_REQUIRED');

const git=(args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const now=()=>new Date().toISOString();
const currentSha=git(['rev-parse','HEAD']);
const branch=git(['branch','--show-current']);
const status=git(['status','--porcelain']);
const failureLog=failureLogPath&&fs.existsSync(failureLogPath)?fs.readFileSync(failureLogPath,'utf8'):'';
const selection=fileSelectionPath&&fs.existsSync(fileSelectionPath)?JSON.parse(fs.readFileSync(fileSelectionPath,'utf8')):null;
const diagnosis=diagnosisPath&&fs.existsSync(diagnosisPath)?JSON.parse(fs.readFileSync(diagnosisPath,'utf8')):null;
const twin=twinPath&&fs.existsSync(twinPath)?JSON.parse(fs.readFileSync(twinPath,'utf8')):null;
const rootCauseProof=rootCausePath&&fs.existsSync(rootCausePath)?JSON.parse(fs.readFileSync(rootCausePath,'utf8')):null;

const read=(p,fallback=null)=>{try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{return fallback;}};
const safeText=(file)=>{try{const full=path.resolve(process.cwd(),file);if(!full.startsWith(path.resolve(process.cwd())+path.sep)||!fs.existsSync(full))return null;return fs.readFileSync(full,'utf8');}catch{return null;}};
const selectedFiles=(selection?.selectedFiles??[]).map(x=>x.path).filter(Boolean);
const tracked=git(['ls-files']).split(/\r?\n/u).filter(Boolean);
const relevant=tracked.filter(x=>/^\.github\/workflows\/|^scripts\/ci\/|^diagnostics\/auto-repair\/action-vault\/|^docs\/agents\/|^package\.json$|^tsconfig\.json$/u.test(x)).slice(0,600);
const refs=[];
const pushRef=(id,type,source,detail)=>{refs.push({id,type,source,detail});return id;};
const failSignals=(failureLog.match(/error|failure|failed|fatal|exception|timeout/giu)||[]).length;
const shaFresh=currentSha===targetSha;
const fileSelectionValid=selection?.decision==='SELECTED'&&selection?.targetSha===targetSha&&selection?.failureFingerprint===fingerprint;
const twinValid=twin?.protocol==='INDEPENDENT_FALSIFICATION_REPORT-v1'&&twin?.targetSha===targetSha&&twin?.failureFingerprint===fingerprint&&twin?.falsificationComplete===true&&twin?.counterexampleFound===false;
const rootCauseValid=rootCauseProof?.protocol==='CAUSAL-EVIDENCE-GRAPH-v1'&&rootCauseProof?.status==='PROVEN'&&rootCauseProof?.targetSha===targetSha&&rootCauseProof?.failureFingerprint===fingerprint;

function domain(name, facts, evidence, unknowns, contradictions, hypotheses, impact, conclusion, trigger){
  const ids=evidence.map(x=>x.id);
  const basis=ids.length?ids:['NO_EVIDENCE'];
  const confidenceValue=Math.max(0,Math.min(0.98,0.50+Math.min(0.40,ids.length*0.06)-Math.min(0.25,unknowns.length*0.05)-Math.min(0.30,contradictions.length*0.08)));
  const complete=ids.length>0&&basis.length>0&&Boolean(conclusion)&&Array.isArray(unknowns)&&Array.isArray(contradictions)&&(!name.includes('ADVERSARIAL_CONTEXT')||twinValid)&&(!name.includes('CAUSAL_CONTEXT')||rootCauseValid)&&shaFresh&&fileSelectionValid;
  return {facts,evidence,unknowns,contradictions,hypotheses,confidence:{value:Number(confidenceValue.toFixed(3)),basis},evidenceRefs:ids,impact,conclusion,reevaluationTrigger:trigger,completed:complete};
}

const eTask=[
 {id:pushRef('EV-TASK-1','identity','taskId',taskId),type:'identity',value:taskId},
 {id:pushRef('EV-TASK-2','identity','failureFingerprint',fingerprint),type:'identity',value:fingerprint},
 {id:pushRef('EV-TASK-3','run','failedRunId',failedRunId),type:'run',value:failedRunId},
 {id:pushRef('EV-TASK-4','failure-log','failureLog',String(failureLog).slice(0,1200)),type:'failure',value:failSignals}
];
const eRepo=[
 {id:pushRef('EV-REPO-1','git','HEAD',currentSha),type:'sha',value:currentSha},
 {id:pushRef('EV-REPO-2','git','branch',branch),type:'branch',value:branch},
 {id:pushRef('EV-REPO-3','git','status',status),type:'status',value:status||'CLEAN'},
 {id:pushRef('EV-REPO-4','selection','selectedFiles',selectedFiles.join(',')),type:'scope',value:selectedFiles}
];
const eCausal=[
 {id:pushRef('EV-CAUSE-1','diagnosis','rootCause',diagnosis?.rootCause||'UNKNOWN'),type:'diagnosis',value:diagnosis?.rootCause||'UNKNOWN'},
 {id:pushRef('EV-CAUSE-2','diagnosis','location',diagnosis?.location?.file||'UNKNOWN'),type:'location',value:diagnosis?.location?.file||'UNKNOWN'},
 {id:pushRef('EV-CAUSE-3','diagnosis','fingerprint',diagnosis?.failureFingerprint||fingerprint),type:'fingerprint',value:diagnosis?.failureFingerprint||fingerprint}
];
if(rootCauseProof){eCausal.push({id:pushRef('EV-CAUSE-4','causal-proof','rootCauseProof',rootCauseProof.digest||'NO_DIGEST'),type:'causal-proof',value:rootCauseProof});}
const historicalIndex=read('docs/agents/historical-action-errors/index.json',{});
const memory=read('diagnostics/auto-repair/memory.json',{});
const eHistory=[
 {id:pushRef('EV-HIST-1','history','historicalIndex',Array.isArray(historicalIndex?.errors)?historicalIndex.errors.length:Object.keys(historicalIndex||{}).length),type:'history',value:'current repository index'},
 {id:pushRef('EV-HIST-2','history','memory',Array.isArray(memory?.cases)?memory.cases.length:Object.keys(memory||{}).length),type:'history',value:'current repair memory'}
];
const protectedPaths=['scripts/ci/repair-protocol.mjs','scripts/ci/control-plane-registry.mjs','scripts/ci/auto-repair-engine.mjs','scripts/ci/auto-repair-policy.mjs','.github/workflows/auto-repair.yml','main'];
const eSafety=[{id:pushRef('EV-SAFE-1','policy','protectedPaths',protectedPaths.join(',')),type:'policy',value:protectedPaths},
 {id:pushRef('EV-SAFE-2','policy','canonicalAuthority','DAILY_FLIXO_GREEN_GATE'),type:'authority',value:'DAILY_FLIXO_GREEN_GATE'},
 {id:pushRef('EV-SAFE-3','policy','mutationBranch','execution'),type:'authority',value:'execution'}];
const eAdv=[
 {id:pushRef('EV-ADV-1','twin','falsification',twin?.falsificationComplete===true?'COMPLETE':'MISSING'),type:'falsification',value:twin?.status||'MISSING'},
 {id:pushRef('EV-ADV-2','twin','counterexample',twin?.counterexampleFound===false?'NONE':'FOUND_OR_UNKNOWN'),type:'counterexample',value:twin?.counterexampleFound},
 {id:pushRef('EV-ADV-3','policy','noCounterexampleNotGreen','ENFORCED'),type:'policy',value:'NO_COUNTEREXAMPLE_IS_NOT_PATCH_CORRECT'}
];
const workflowFiles=relevant.filter(x=>x.startsWith('.github/workflows/')).slice(0,40);
const eOps=[
 {id:pushRef('EV-OPS-1','workflow','requiredWorkflowCount',workflowFiles.length),type:'workflow',value:workflowFiles},
 {id:pushRef('EV-OPS-2','workflow','branchTriggers','execution/main'),type:'workflow',value:'execution/main'},
 {id:pushRef('EV-OPS-3','lease','heartbeat','5m'),type:'liveness',value:'5 minutes'}
];
const eTemp=[
 {id:pushRef('EV-TEMP-1','sequence','entrySha',targetSha),type:'sequence',value:targetSha},
 {id:pushRef('EV-TEMP-2','sequence','observedSha',currentSha),type:'sequence',value:currentSha},
 {id:pushRef('EV-TEMP-3','policy','staleEvidence',shaFresh?'REJECT_ON_DRIFT':'DRIFT_DETECTED'),type:'policy',value:shaFresh?'ENFORCED':'VIOLATION'}
];
const targetText=selectedFiles.map(safeText).filter(Boolean).join('\n');
const affectedContracts=[...new Set((targetText.match(/(?:contract|protocol|schema|gate|green|sha|liveness|i18n|seo|security|observability)/giu)||[]).map(x=>x.toLowerCase()))];
const eImpact=[
 {id:pushRef('EV-IMPACT-1','source','selectedSurface',selectedFiles.join(',')),type:'surface',value:selectedFiles},
 {id:pushRef('EV-IMPACT-2','contract','keywords',affectedContracts.join(',')),type:'contracts',value:affectedContracts},
 {id:pushRef('EV-IMPACT-3','tests','testSurface','scripts/ci/test-* and repository required CI'),type:'tests',value:'protected'}
];

const domains={
 TASK_SEMANTICS:domain('TASK_SEMANTICS',
  ['Task identity, failure fingerprint and failed run are explicit.'],
  eTask,['SUCCESS_CONDITION_FROM_CURRENT_CANONICAL_GATE'],
  [],[{id:'H1',hypothesis:'repair closes the demonstrated failure without suppressing unrelated REDs'}],
  ['repair'], 'The task is to prove and safely repair the exact failure, not merely produce a passing local command.','When failure fingerprint, run or canonical acceptance changes.'),
 REPOSITORY_CONTEXT:domain('REPOSITORY_CONTEXT',
  ['Current branch, exact HEAD, worktree and selected source surface are observed.'],
  eRepo,['CALL_GRAPH_BEYOND_SELECTED_SURFACE'],[],[{id:'H2',hypothesis:'selected surface is causal source'}],
  ['source','dependencies','CI'],shaFresh&&branch==='execution'?'Current repository identity is fresh and mutation remains execution-only.':'Repository identity is not yet trustworthy.','When HEAD or selected file set changes.'),
 CAUSAL_CONTEXT:domain('CAUSAL_CONTEXT',
  ['Primary diagnosis is consumed as a hypothesis, not as self-proving truth.'],
  eCausal,diagnosis?.rootCause?[]:['PRIMARY_DIAGNOSIS_MISSING'],[],[{id:'H3',hypothesis:String(diagnosis?.rootCause||'UNKNOWN')}],
  ['RCA'],diagnosis?.rootCause?'Primary causal hypothesis is linked to the exact failure fingerprint and location.':'Causal proof remains unresolved.','When RCA, location or fingerprint changes.'),
 HISTORICAL_CONTEXT:domain('HISTORICAL_CONTEXT',
  ['History is sampled from current repository memory/index.'],
  eHistory,['HISTORICAL_MATCHES_MUST_BE_REQUALIFIED_ON_CURRENT_SHA'],[],[{id:'H4',hypothesis:'historical repair may be reusable only when current evidence matches'}],
  ['memory'], 'Historical evidence is support only; current SHA remains authoritative.','When current SHA, context or historical candidate changes.'),
 SAFETY_GOVERNANCE:domain('SAFETY_GOVERNANCE',
  ['Protected control-plane paths and execution-only mutation boundary are explicit.'],
  eSafety,[],[],[{id:'H5',hypothesis:'scope expansion or gate weakening must be blocked'}],
  ['security','authority'], 'Mutation authority is separated from cognitive authority and constrained to execution.','When protected-path policy or canonical authority changes.'),
 ADVERSARIAL_CONTEXT:domain('ADVERSARIAL_CONTEXT',
  ['An independent programmer twin is required to challenge the primary repair.'],
  eAdv,twinValid?[]:['INDEPENDENT_FALSIFICATION_NOT_PROVEN'],twin?.counterexampleFound?['VALID_COUNTEREXAMPLE_FOUND']:[],[{id:'H6',hypothesis:'primary diagnosis/patch can be wrong'}],
  ['counterexamples','falsification'], twinValid?'Independent falsification completed with no valid counterexample; this is not itself patch correctness.':'Adversarial proof is unresolved.','When twin evidence or candidate patch changes.'),
 OPERATIONAL_CONTEXT:domain('OPERATIONAL_CONTEXT',
  ['CI workflows, leases and heartbeat are part of the observed operating context.'],
  eOps,['LIVE_CHECK_RUN_STATE_MUST_BE_CAPTURED'],[],[{id:'H7',hypothesis:'workflow/routing state can cause the observed RED'}],
  ['CI','leases'], 'Operational controls are part of the repair surface even when the source target is elsewhere.','When workflow state, lease or check status changes.'),
 TEMPORAL_CONTEXT:domain('TEMPORAL_CONTEXT',
  ['Entry, observed and future mutation states are distinct.'],
  eTemp,shaFresh?[]:['CURRENT_HEAD_DRIFT'],currentSha!==targetSha?['STALE_SHA']:[],[{id:'H8',hypothesis:'evidence from a different SHA is non-authoritative'}],
  ['exact-sha'], shaFresh?'Temporal evidence is bound to one exact SHA.':'Temporal proof is invalid until requalified.','Any source mutation or execution-head movement.'),
 SYSTEMIC_IMPACT:domain('SYSTEMIC_IMPACT',
  ['The selected source surface is cross-checked against contracts and protected verification surfaces.'],
  eImpact,['RUNTIME_BEHAVIOR_AFTER_PATCH','DOWNSTREAM_BROWSER_EFFECTS'],[],[{id:'H9',hypothesis:'local fix may affect adjacent contracts or runtime behavior'}],
  ['CI','browser','TypeScript','security','workflows','agents','SEO/i18n','observability','memory'], 'System impact is bounded for pre-mutation reasoning; post-mutation proof must re-evaluate affected surfaces.','When candidate patch or affected file graph changes.')
};

const requiredDomains=Object.keys(domains);
const complete=requiredDomains.every(name=>domains[name].completed);
const packet={
 schemaVersion:2,protocol:'ACTION-SYSTEM-COGNITIVE-AWARENESS-v1',
 taskId,failureFingerprint,targetSha,failedRunId,exactShaBound:true,readOnly:true,noMutation:true,
 domains,awarenessCompleteness:{requiredDomains,declaredCompleteDomains:requiredDomains.filter(name=>domains[name].completed),complete},
 repositorySnapshot:{branch,headSha:currentSha,workingTree:status,selectedFiles,trackedRelevantPaths:relevant},
 temporalState:{entrySha:targetSha,observedSha:currentSha,proposedState:'MUTATION_PENDING_PROOF',mutationState:'NOT_MUTATED',verifiedState:'NOT_YET_VERIFIED'},
 governance:{protectedPaths,canonicalProofAuthority:'CURRENT_EXACT_SHA_CI',mutationPolicy:'ROLE_SCOPED',noImplicitAuthority:true,staleEvidenceMustBeRejected:true},
 reasoningDiscipline:{mustSeparateFactFromHypothesis:true,mustStateUnknowns:true,mustGenerateAlternatives:true,mustSeekDisconfirmingEvidence:true,mustReevaluateOnNewEvidence:true,mustPreserveContradictions:true,confidenceCannotReplaceProof:true,historyCannotReplaceCurrentEvidence:true,noCounterexampleDoesNotEqualGreen:true},
 roleExpansion:{ACTION_REPAIR:['whole-system context','correctness proof','downstream impact'],ACTION_REPAIR_2:['independent source analysis','falsification','counterexample search'],ACTION_HISTORIAN_3:['minimal file selection','recurrence evidence','anti-lessons']},
 generatedAt:now()
};
\nconst awarenessValidation=validateActionSystemCognitiveAwareness(packet,{targetSha,failureFingerprint:fingerprint});\npacket.validation=awarenessValidation;\npacket.awarenessCompleteness.complete=packet.awarenessCompleteness.complete===true&&awarenessValidation.valid;fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
fs.writeFileSync(output,JSON.stringify(packet,null,2)+'\n');
console.log(JSON.stringify({status:complete?'PASS':'BLOCK',protocol:packet.protocol,targetSha,failureFingerprint,domainCount:requiredDomains.length,completedDomains:packet.awarenessCompleteness.declaredCompleteDomains.length,complete},null,2));
if(!complete)process.exitCode=1;
\nexport function validateActionSystemCognitiveAwareness(packet,{targetSha=null,failureFingerprint=null}={}){\n  const failures=[];\n  if(!packet||packet.protocol!=='ACTION-SYSTEM-COGNITIVE-AWARENESS-v1') failures.push('AWARENESS_PROTOCOL_INVALID');\n  if(packet?.schemaVersion!==2) failures.push('AWARENESS_SCHEMA_INVALID');\n  if(targetSha&&packet?.targetSha!==targetSha) failures.push('AWARENESS_SHA_MISMATCH');\n  if(failureFingerprint&&packet?.failureFingerprint!==failureFingerprint) failures.push('AWARENESS_FINGERPRINT_MISMATCH');\n  if(packet?.exactShaBound!==true||packet?.readOnly!==true||packet?.noMutation!==true) failures.push('AWARENESS_GOVERNANCE_INVALID');\n  const names=packet?.awarenessCompleteness?.requiredDomains??[];\n  if(names.length!==9) failures.push('AWARENESS_DOMAIN_COUNT_INVALID');\n  for(const name of names){\n    const d=packet?.domains?.[name];\n    if(!d) {failures.push('AWARENESS_DOMAIN_MISSING='+name);continue;}\n    if(!Array.isArray(d.facts)||!Array.isArray(d.evidence)||d.evidence.length===0||!Array.isArray(d.unknowns)||!Array.isArray(d.contradictions)||!Array.isArray(d.hypotheses)||typeof d.confidence?.value!=='number'||!Array.isArray(d.confidence?.basis)||d.confidence.basis.length===0||!Array.isArray(d.evidenceRefs)||d.evidenceRefs.length===0||!Array.isArray(d.impact)||typeof d.conclusion!=='string'||typeof d.reevaluationTrigger!=='string') failures.push('AWARENESS_DOMAIN_EVIDENCE_INVALID='+name);\n    if(d.completed!==true) failures.push('AWARENESS_DOMAIN_UNPROVEN='+name);\n  }\n  if(packet?.domains?.CAUSAL_CONTEXT?.evidence?.length<4) failures.push('AWARENESS_CAUSAL_PROOF_EVIDENCE_MISSING');\n  if(packet?.domains?.ADVERSARIAL_CONTEXT?.completed!==true) failures.push('AWARENESS_ADVERSARIAL_CONTEXT_UNPROVEN');\n  if(packet?.reasoningDiscipline?.confidenceCannotReplaceProof!==true) failures.push('AWARENESS_CONFIDENCE_NOT_PROOF');\n  if(packet?.reasoningDiscipline?.noCounterexampleDoesNotEqualGreen!==true) failures.push('AWARENESS_NO_COUNTEREXAMPLE_RULE_MISSING');\n  const valid=failures.length===0&&packet.awarenessCompleteness.complete===true;\n  return Object.freeze({valid,status:valid?'PROVEN':'BLOCK',failures,targetSha:packet?.targetSha??null,failureFingerprint:packet?.failureFingerprint??null,domainCount:names.length});\n}\n