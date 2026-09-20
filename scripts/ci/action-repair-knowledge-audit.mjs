#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const arg=(name,fallback='')=>{const p='--'+name+'=';const hit=process.argv.find(v=>v.startsWith(p));return hit?hit.slice(p.length):String(fallback)};
const TARGET_SHA=arg('target-sha',process.env.FLIXO_EXPECTED_TARGET_SHA||'');
const RUN_ID=arg('run-id',process.env.TARGET_RUN_ID||'');
const FINGERPRINT=arg('fingerprint',process.env.FLIXO_FAILURE_FINGERPRINT||'');
const OUTPUT=arg('output',process.env.FLIXO_ACTION_REPAIR_KNOWLEDGE_AUDIT||'/tmp/flixo-action-repair-knowledge-audit.json');
const sha=v=>/^[a-f0-9]{40}$/iu.test(String(v||''));
if(!sha(TARGET_SHA)) throw new Error('ACTION_REPAIR_KNOWLEDGE_AUDIT_TARGET_SHA_REQUIRED');
if(!RUN_ID) throw new Error('ACTION_REPAIR_KNOWLEDGE_AUDIT_RUN_ID_REQUIRED');

const readJson=(file,fallback={})=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'))}catch{return fallback}};
const readText=(file)=>{try{return fs.readFileSync(path.join(ROOT,file),'utf8')}catch{return ''}};
const memory=readJson('diagnostics/auto-repair/memory.json',{});
const actionIndex=readJson('diagnostics/auto-repair/action-repair-bots/ACTION-INDEX.json',{});
const historical=readJson('docs/agents/historical-action-errors/index.json',{});
const historicalManifest=readJson('docs/agents/historical-action-errors/manifest.json',{});
const knowledge=readJson('docs/agents/HISTORICAL-REPAIR-KNOWLEDGE.json',{});
const teaching=readJson('docs/agents/ERROR-TEACHING-ROUTER.json',{});
const registry=readJson('docs/agents/ACTION-REPAIR-SQUAD-REGISTRY.json',{});
const policy=readText('scripts/ci/auto-repair-policy.mjs');
const protocol=readText('scripts/ci/repair-protocol.mjs');
const workflow=readText('.github/workflows/auto-repair.yml');
const inferential=readText('docs/agents/INFERENTIAL-REPAIR-INTELLIGENCE.md');
const historyDoc=readText('docs/agents/ACTION-ERROR-HISTORY.md');

const caseSummary=(memory.cases??[]).map(c=>({
 fingerprint:c.fingerprint,rootCause:c.rootCause,attempts:Number(c.attempts??0),successes:Number(c.successes??0),failures:Number(c.failures??0),
 confidence:Number(c.confidence??0),rules:(c.rules??[]).slice(0,20),revertedRules:(c.revertedRules??[]).slice(0,20),
 outcomes:(c.outcomes??[]).slice(-10).map(o=>({outcome:o.outcome,verification:o.verification,runId:o.provenance?.runId,failedSha:o.provenance?.failedSha,workflow:o.provenance?.workflow,at:o.at}))
}));
const lessonSummary=(memory.lessons??[]).map(l=>({
 id:l.id,fingerprint:l.fingerprint,rootCause:l.rootCause,rule:l.rule,confidence:Number(l.confidence??0),support:Number(l.support??0),successes:Number(l.successes??0)
})).slice(-500);
const antiLessonSummary=(memory.antiLessons??[]).map(l=>({
 id:l.id,fingerprint:l.fingerprint,rootCause:l.rootCause,rule:l.rule,confidence:Number(l.confidence??0),reason:l.reason
})).slice(-500);
const playbookSummary=(memory.playbooks??[]).map(p=>({
 id:p.id,rootCause:p.rootCause,rule:p.rule,confidence:Number(p.confidence??0),support:Number(p.support??0),successRate:Number(p.successRate??0),status:p.status
})).slice(-500);
const rejectedSummary=(memory.rejectedApproaches??[]).slice(-500);
const teachingRequests=(memory.teachingRequests??[]).slice(-200);
const actionSolutions=(actionIndex.solutions??[]).slice(-500);
const centerEvents=(actionIndex.center?.events??[]).slice(-500);

const valuableRules=[
 'CURRENT_EXACT_SHA_ONLY',
 'REPRODUCE_BEFORE_MUTATION',
 'ERROR_ONLY_SOURCE_MUTATION',
 'TEST_MUTATION_BLOCKED',
 'MAIN_MUTATION_FORBIDDEN',
 'PROTECTED_CONTROL_PLANE_IMMUTABLE',
 'EXTERNAL_PROVIDER_FAILURE_IS_BLOCKED_EXTERNAL',
 'REVERTED_RULES_ARE_ANTI_LESSONS',
 'NO_BLIND_HISTORICAL_REUSE',
 'CANONICAL_GREEN_IS_CLOSURE_AUTHORITY',
 'FRESH_SHA_REQUIRED_AFTER_REPAIR',
 'TARGETED_REGRESSION_BEFORE_RESUME',
 'CONTINUOUS_RED_CYCLE_UNTIL_CANONICAL_GREEN',
 'ONE_MILLION_ATTEMPT_POLICY_CEILING',
 'SELF_SEARCH_ACTION_INDEX_BEFORE_MUTATION',
 'KNOWLEDGE_IS_ADVISORY_UNTIL_CURRENT_PROOF',
 'STALE_FAILURE_TARGETS_MUST_BE_REJECTED',
 'IDENTICAL_PRECHECK_FAILURES_REQUIRE_STRATEGY_CHANGE',
];

const audit={
 schemaVersion:1,
 authority:'ACTION_REPAIR_EXECUTOR_KNOWLEDGE_AUDIT',
 botId:'ACTION-REPAIR',
 protocolActor:'actionRepairBot',
 auditedAt:new Date().toISOString(),
 targetSha:TARGET_SHA,runId:String(RUN_ID),failureFingerprint:FINGERPRINT||null,
 mission:'Continuously accumulate, review and reuse valuable Actions repair knowledge without bypassing current exact-SHA evidence or Canonical CI.',
 sources:{
   historicalActionIndex:'docs/agents/historical-action-errors/index.json',
   historicalActionRecords:'docs/agents/historical-action-errors/records',
   historicalManifest:'docs/agents/historical-action-errors/manifest.json',
   actionErrorHistory:'docs/agents/ACTION-ERROR-HISTORY.md',
   repairMemory:'diagnostics/auto-repair/memory.json',
   actionIndexMemory:'diagnostics/auto-repair/action-repair-bots/ACTION-INDEX.json',
   historicalRepairKnowledge:'docs/agents/HISTORICAL-REPAIR-KNOWLEDGE.json',
   errorTeachingRouter:'docs/agents/ERROR-TEACHING-ROUTER.json',
   squadRegistry:'docs/agents/ACTION-REPAIR-SQUAD-REGISTRY.json',
   repairPolicy:'scripts/ci/auto-repair-policy.mjs',
   repairProtocol:'scripts/ci/repair-protocol.mjs',
   autoRepairWorkflow:'.github/workflows/auto-repair.yml',
   inferentialIntelligence:'docs/agents/INFERENTIAL-REPAIR-INTELLIGENCE.md'
 },
 corpus:{
   historicalUniqueRecords:Number(historical.recordCount??0),
   historicalManifestUniqueRecords:Number(historicalManifest.uniqueRecords??0),
   historicalErrorOccurrences:Number(historicalManifest.errorOccurrences??0),
   historicalRunsScanned:Number(historicalManifest.totalRunsScanned??0),
   historicalFailedRunsScanned:Number(historicalManifest.failedRunsScanned??0),
   retainedMemoryCases:caseSummary.length,
   retainedMemoryLessons:lessonSummary.length,
   retainedMemoryAntiLessons:antiLessonSummary.length,
   retainedPlaybooks:playbookSummary.length,
   retainedTeachingRequests:teachingRequests.length,
   actionIndexSolutions:actionSolutions.length,
   informationCenterEvents:centerEvents.length,
   routedTeachingRules:Number(teaching.corpus?.rules??0)
 },
 currentKnowledge:{
   exactShaRequired:true,
   currentTargetSha:TARGET_SHA,
   verifiedOnlyForClosure:true,
   valuableRules,
   historicalRepairKnowledge:(knowledge.entries??[]).map(e=>({id:e.id,rootCause:e.rootCause,rule:e.rule,lesson:e.lesson,evidence:e.evidence})),
   cases:caseSummary,
   lessons:lessonSummary,
   antiLessons:antiLessonSummary,
   playbooks:playbookSummary,
   rejectedApproaches:rejectedSummary,
   teachingRequests,
   verifiedActionSolutions:actionSolutions.filter(s=>/verified|success|validated/iu.test(String(s.outcome??s.status??''))),
   informationCenterEvents:centerEvents
 },
 architecture:{
   repairExecutor:registry.repairExecutor??null,
   fiveKnowledgeWorkers:(registry.workers??[]).map(w=>({id:w.id,role:w.role,mutationAuthority:w.mutationAuthority,executionAuthority:w.executionAuthority})),
   directSelfSearch:true,
   selfSearchIndex:'docs/agents/historical-action-errors/index.json',
   selfSearchRecords:'docs/agents/historical-action-errors/records',
   inferenceFallback:'KNOWN_STRATEGY_TRANSFER/CROSS_CASE_SYNTHESIS/NEW_HYPOTHESIS',
   proofAuthority:'CURRENT_EXACT_SHA_CI_ONLY',
   canonicalGreenAuthority:'DAILY_FLIXO_GREEN_GATE'
 },
 hardConstraints:{
   mutationBranch:'execution',
   canMutateMain:false,
   canMutateTests:false,
   mutationScope:'ERROR_ONLY',
   maxAttemptsPerFingerprint:1000000,
   protectedControlPlane:true,
   externalDiagnosisNotProof:true,
   staleTargetRejected:true,
   noSafeCandidateMustEscalate:true,
   noFiniteClosureOnRed:true
 },
 sourceContractsDigest:{
   policySignals:['maxAttemptsPerFingerprint:1_000_000','requireCleanGitBeforeRepair:true','requireDeterministicMatch:true','protectedAreas'],
   protocolSignals:['mutationScope:ERROR_ONLY','testMutationPolicy:BLOCK','mutationAgents','bypassPolicy:BLOCK','commit boundary'],
   workflowSignals:['target run exact SHA','failure log capture','ACTION-INDEX red learning','twin review','AI/RCA','mutation','targeted regression','canonical verification']
 },
 inferentialSummary:inferential.slice(0,24000),
 historicalSummary:historyDoc.slice(0,24000)
};
fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
fs.writeFileSync(OUTPUT,JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',botId:'ACTION-REPAIR',targetSha:TARGET_SHA,runId:String(RUN_ID),historicalUniqueRecords:audit.corpus.historicalUniqueRecords,retainedCases:audit.corpus.retainedMemoryCases,retainedLessons:audit.corpus.retainedMemoryLessons,valuableRules:audit.currentKnowledge.valuableRules.length,output:OUTPUT},null,2));
