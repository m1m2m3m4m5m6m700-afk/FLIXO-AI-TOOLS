#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  MEMORY_LAYERS,
  REGISTERED_BOT_COUNT,
  buildFixedBotIdentities,
  validateActiveBotSet,
  makeKnowledge,
  canonicalKey,
  mergeCanonical,
  decayKnowledge,
  memoryAdvisoryDecision,
  poisoningSafe,
  compactMemory,
  rebuildMemory,
  classifyDifficulty,
  skillReputation,
  buildCapabilityMap,
  CAPABILITY_MAP,
  FAILURE_INJECTION_CATALOG,
  SWARM_CONTRACT_VERSION,
  adaptiveSwarmSize,
  selectAdaptiveSwarm,
  assignAdaptiveRoles,
  validateMissionResult,
  learningDecision,
  promotionTrial,
  canaryDecision,
  fingerprintFailure,
  inferFallback,
  transferStrategy,
  synthesizeCases,
  generateHypotheses,
  failurePrediction,
  buildKnowledgeGraph,
  compareReplay,
  buildSimulationEvidence,
  detectDrift,
  validateHandoff,
  rootCauseMemoryLink,
  expandSwarmSelection,
  buildRcaChain,
  evaluateShadowStrategy,
  importMemoryHistory,
  historicalBackfill,
  buildWeaknessGenome,
  validateSkillsContinuously,
  runUpgradeEngine,
  buildControllerLearningSignal,
  injectFailureScenario,
  validateFailureInjection,
} from '../../src/lib/agent/swarm/learning-memory-routing.ts';

const sha='a'.repeat(40);
const h='b'.repeat(64);
const c='c'.repeat(64);

assert.deepEqual(Object.keys(MEMORY_LAYERS),['L0','L1','L2','L3','L4']);
assert.equal(canonicalKey('Routing','Bind   routing evidence.'),canonicalKey(' routing ','Bind routing evidence.'));
assert.equal(MEMORY_LAYERS.L0,'CONSTITUTION');
assert.equal(MEMORY_LAYERS.L4,'CURRENT_MISSION_MEMORY');

const identities=buildFixedBotIdentities();
assert.equal(identities.length,REGISTERED_BOT_COUNT);
assert.equal(identities[0].botId,'CELL-001');
assert.equal(identities[199].botId,'CELL-200');
assert.equal(identities.every(x=>x.authority==='CENTRALIZED' && !x.active && x.missionId===null),true);
assert.equal(validateActiveBotSet(['CELL-001','CELL-200']).length,2);
assert.throws(()=>validateActiveBotSet(['CELL-001','CELL-001']),/SWARM_ACTIVE_BOT_SET_INVALID/);

const make=(id,extra={})=>makeKnowledge({
  id,
  scope:'routing',
  content:'Bind routing evidence to exact SHA.',
  source:'test',
  sourceType:'TEST',
  version:'1',
  layer:'L1',
  status:'VERIFIED',
  validity:'CURRENT',
  confidence:.96,
  authority:.98,
  provenance:['test'],
  exactSha:sha,
  exactShaVerified:true,
  evidenceCount:3,
  polarity:'SUPPORTS',
  createdAt:'2026-09-01T00:00:00Z',
  lastVerifiedAt:'2026-09-20T00:00:00Z',
  expiresAt:null,
  ...extra
});

const merged=mergeCanonical([make('A'),make('B'),make('C',{polarity:'REFUTES'})]);
assert.equal(merged.canonical.length,1);
assert.equal(merged.duplicates.length,1);
assert.equal(merged.contradictions.length,1);
assert.deepEqual(memoryAdvisoryDecision(make('D'),sha),{
  usableAsAdvisory:true,
  exactShaMatch:true,
  requiresFreshEvidence:false,
  authorityGranted:false,
});
assert.equal(decayKnowledge(make('D'),Date.parse('2026-10-21T00:00:00Z'),30).validity,'STALE');
assert.equal(poisoningSafe(make('E'),sha),true);
assert.equal(poisoningSafe(make('F',{sourceType:'GENERATED'}),sha),false);
assert.equal(compactMemory([make('G'),make('H',{layer:'L4',status:'PROBABLE',confidence:.8})]).active.length,2);
const xs=[make('I'),make('J',{content:'Other claim.'})];
const dig=createHash('sha256').update(JSON.stringify(xs.slice().sort((a,b)=>a.id.localeCompare(b.id))),'utf8').digest('hex');
assert.equal(rebuildMemory(xs,{recordCount:2,digest:dig,exactSha:sha}).length,2);

assert.equal(classifyDifficulty({ambiguity:0,novelty:0,dependencyCount:0,risk:0,uncertainty:0,capabilityCount:1}),'D1');
const reps=skillReputation([
  {botId:'CELL-101',skill:'routing',capability:'filter-mask',outcome:'SUCCESS',contextKey:'a',exactSha:sha,verified:true,timestamp:'2026-09-20T00:00:00Z'},
  {botId:'CELL-101',skill:'routing',capability:'filter-mask',outcome:'SUCCESS',contextKey:'b',exactSha:sha,verified:true,timestamp:'2026-09-21T00:00:00Z'}
]);
assert.equal(reps[0].successRate,1);
assert.equal(buildCapabilityMap(['filter-mask','unknown-capability'])[1].known,false);
assert.equal(Array.isArray(CAPABILITY_MAP['filter-mask'].requiredSkills),true);
assert.equal(FAILURE_INJECTION_CATALOG.length >= 11,true);
assert.match(SWARM_CONTRACT_VERSION,/^WAVE5-ROUTING-MEMORY-LEARNING-INTELLIGENCE-/u);
assert.equal(adaptiveSwarmSize('D5',6,1,1)<=50,true);
const selected=selectAdaptiveSwarm({
  currentSha:sha,
  difficulty:'D2',
  requiredCapabilities:['filter-mask'],
  observations:[
    {botId:'CELL-101',skill:'gpu',capability:'filter-mask',outcome:'SUCCESS',contextKey:'same',exactSha:sha,verified:true,timestamp:'2026-09-21T00:00:00Z'}
  ]
});
assert(selected.includes('CELL-101'));
assert.equal(assignAdaptiveRoles(['CELL-101','CELL-102'],['filter-mask']).length,2);

const result={
  missionId:'M1',
  taskId:'TASK-041',
  botId:'CELL-101',
  exactSha:sha,
  outcome:'SUCCESS',
  strategyId:'strategy-a',
  failureFingerprint:null,
  rootCause:null,
  evidenceRefs:['run:1'],
  verified:true,
  reverted:false,
};
assert.equal(validateMissionResult(result),true);
assert.equal(learningDecision({...result,validationPassed:true,currentSha:sha,contradictions:0}),'VERIFIED_KNOWLEDGE');
assert.equal(learningDecision({...result,validationPassed:false,currentSha:sha,contradictions:0}),'PROVISIONAL_LESSON');
assert.equal(learningDecision({...result,outcome:'PROPOSED',validationPassed:false,currentSha:sha,contradictions:0}),'NO_CONFIDENCE_CHANGE');
assert.equal(learningDecision({...result,outcome:'REVERTED',reverted:true,validationPassed:true,currentSha:sha,contradictions:0}),'STRATEGY_REJECTED');

const failureFp=fingerprintFailure({
  category:'runtime',
  normalizedMessage:'GPU unavailable',
  violatedInvariant:'runtime capability',
  causalSource:'device adapter',
  affectedScope:'filter-mask'
});
assert.equal(failureFp.length,64);
assert.equal(learningDecision({
  ...result,
  outcome:'FAILURE',
  failureFingerprint:failureFp,
  validationPassed:true,
  currentSha:sha,
  contradictions:0
}),'ANTI_LESSON');

assert.equal(promotionTrial({attempts:2,successes:2,distinctContexts:2,independentChallenges:1,contradictions:0}).eligible,false);
assert.equal(promotionTrial({attempts:4,successes:4,distinctContexts:2,independentChallenges:1,contradictions:0}).eligible,true);
assert.equal(canaryDecision({baselineFailureRate:.1,canaryFailureRate:.3,allowedRegression:.05,trials:10}),'ROLLBACK');
assert.deepEqual(inferFallback({status:'FAILED',strategyId:'primary'},{strategyId:'fallback'}),{strategyId:'fallback',source:'FALLBACK'});
assert.equal(transferStrategy({sourceFingerprint:h,targetFailureClass:'runtime',strategyId:'S1',verifiedContexts:2,exactShaEvidence:[sha]}).eligible,true);

const synthesis=synthesizeCases([
  {fingerprint:h,rootCause:'runtime',strategyId:'S1',outcome:'FAILURE'},
  {fingerprint:c,rootCause:'runtime',strategyId:'S1',outcome:'SUCCESS'}
]);
assert.deepEqual(synthesis.recurringRootCauses,[['runtime',2]]);
assert.deepEqual(generateHypotheses({failures:[{fingerprint:h,rootCause:'runtime'}],max:5}),[`runtime:${h.slice(0,12)}`]);
assert.equal(failurePrediction({fingerprint:h,historical:[{fingerprint:h,outcome:'FAILURE'},{fingerprint:h,outcome:'SUCCESS'}]}).failureRate,.5);

const graph=buildKnowledgeGraph([make('K'),make('L',{content:'Second claim.'})]);
assert.equal(graph.nodes.length,2);
assert.equal(graph.digest.length,64);

assert.equal(compareReplay({historicalOracle:'FAIL',currentOracle:'PASS',historicalOutputHash:h,currentOutputHash:c}).signal,'IMPROVED');
const simulation=buildSimulationEvidence({
  missionId:'M1',
  exactSha:sha,
  taskInputHash:h,
  memorySnapshotIds:['M-SNAP-1'],
  strategyId:'S1',
  outputHash:c,
  oracle:'PASS',
  failureInjection:null
});
assert.equal(simulation.authoritative,false);
assert.equal(simulation.certificationAllowed,false);
assert.equal(simulation.exactSha,sha);

assert.equal(detectDrift({previousContractDigest:h,currentContractDigest:c,previousSchemaVersion:1,currentSchemaVersion:1,exactSha:sha}).drifted,true);
validateHandoff({missionId:'M1',exactSha:sha,capabilityId:'filter-mask',evidenceRefs:['run:1']});
assert.equal(rootCauseMemoryLink({productFailureId:'P1',rootCause:'runtime',exactSha:sha,failureFingerprint:h,evidenceRefs:['run:1']}).layer,'L3');
const expanded=expandSwarmSelection(['CELL-001'],['CELL-002','CELL-003','CELL-004'],3);
assert.deepEqual(expanded,['CELL-001','CELL-002','CELL-003']);
const rca=buildRcaChain({trigger:'test',propagation:'route',violatedInvariant:'exact-sha',causalSource:'router',symptom:'mismatch',exactSha:sha,evidenceRefs:['run:1']});
assert.equal(rca.fingerprint.length,64);
assert.equal(evaluateShadowStrategy({baseline:{oracle:'FAIL',outputHash:h},shadow:{oracle:'PASS',outputHash:c}}).authoritative,false);

const historySource={
  id:'K-HIST',
  content:'Historical routing lesson.',
  source:'historical-test',
  sourceType:'TEST',
  timestamp:'2026-09-01T00:00:00Z',
  version:'1',
  scope:'routing',
  confidence:.8,
  provenance:['historical-run:old-sha'],
  validity:'STALE',
  status:'PROBABLE',
  fingerprint:h
};
const history=importMemoryHistory([historySource],sha);
assert.equal(history.importedCount,1);
assert.equal(history.historicalOnlyCount,1);
assert.equal(history.authority,'ADVISORY_ONLY');
assert.equal(historicalBackfill([historySource],sha).promotionAllowed,false);

const genome=buildWeaknessGenome([
  {fingerprint:h,category:'runtime',rootCause:'adapter',skill:'gpu',capability:'filter-mask',exactSha:sha,outcome:'FAILURE',severity:1,contextKey:'A'},
  {fingerprint:h,category:'runtime',rootCause:'adapter',skill:'gpu',capability:'filter-mask',exactSha:sha,outcome:'FAILURE',severity:.8,contextKey:'B'}
],sha);
assert.equal(genome.genes.length,1);
assert.equal(genome.genes[0].recurrence,2);

const continuousSkill=validateSkillsContinuously([
  {botId:'CELL-101',skill:'gpu',capability:'filter-mask',outcome:'SUCCESS',contextKey:'A',exactSha:sha,verified:true,timestamp:'2026-09-20T00:00:00Z'},
  {botId:'CELL-101',skill:'gpu',capability:'filter-mask',outcome:'FAILURE',contextKey:'B',exactSha:sha,verified:true,timestamp:'2026-09-21T00:00:00Z'}
],sha);
assert.equal(continuousSkill.status,'DEGRADED');

const upgrades=runUpgradeEngine({exactSha:sha,genome,skillValidation:continuousSkill,maxProposals:4});
assert.equal(upgrades.authoritative,false);
assert.equal(upgrades.mutationAllowed,false);

const controllerSignal=buildControllerLearningSignal({
  exactSha:sha,
  missionResults:[{missionId:'M1',outcome:'FAILURE',strategyId:'S1',exactSha:sha,verified:true,reverted:false}],
  genome,
  upgrades,
  skillValidation:continuousSkill
});
assert.equal(controllerSignal.decision,'REVIEW');
assert.equal(controllerSignal.authority,'ADVISORY_ONLY');

const injected=injectFailureScenario({injection:'STALE_SHA',exactSha:sha,payload:{value:'baseline'}});
assert.equal(injected.mutatedPayload.exactSha,'0'.repeat(40));
assert.equal(validateFailureInjection(injected),true);
assert.equal(injected.certificationAllowed,false);

console.log('LATEST_WAVE5_MISSING_CONTRACTS=PASS');

console.log('SWARM_LEARNING_MEMORY_ROUTING=PASS');
