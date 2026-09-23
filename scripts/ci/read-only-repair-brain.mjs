import { buildAdaptiveFailureMemory } from './repair-ten-x.mjs';
import { assertUnifiedBotRuntime } from './control-plane-registry.mjs';

const SHA_RE=/^[a-f0-9]{40}$/u;

export const READ_ONLY_REPAIR_BRAIN = Object.freeze({
  protocol:'FLIXO-READ-ONLY-REPAIR-BRAIN-v1',
  power:'REPAIR_BOT_ANALYTIC_PARITY_10X',
  authority:'READ_ONLY',
  mutationAuthority:false,
  certificationAuthority:false,
  strategies:Object.freeze([
    'reproduce-exact',
    'minimize-failure',
    'diff-forensics',
    'environment-audit',
    'workflow-forensics',
    'observability-trace',
    'historical-analogy',
    'synthetic-reproduction',
    'alternate-hypothesis',
    'supervising-escalation',
  ]),
  invariants:Object.freeze([
    'EXACT_SHA_BOUND',
    'NO_SOURCE_MUTATION',
    'NO_GIT_REF_MUTATION',
    'NO_CI_CONTROL_MUTATION',
    'NO_CERTIFICATION',
    'REPORT_ONLY',
  ]),
});

const FOCUS=Object.freeze({
  'reproduce-exact':'REPRODUCE_EXACT_FAILURE',
  'minimize-failure':'MINIMIZE_CAUSAL_SURFACE',
  'diff-forensics':'TRACE_FIRST_CAUSAL_CHANGE',
  'environment-audit':'ISOLATE_RUNTIME_DEPENDENCY',
  'workflow-forensics':'TRACE_WORKFLOW_AUTHORITY',
  'observability-trace':'TRACE_TRIGGER_PROPAGATION',
  'historical-analogy':'COMPARE_VERIFIED_PRIORS',
  'synthetic-reproduction':'BUILD_MINIMAL_REPRODUCTION',
  'alternate-hypothesis':'FALSIFY_COMPETING_HYPOTHESIS',
  'supervising-escalation':'ESCALATE_WITH_NEW_EVIDENCE',
});

const CLASS_FIT=Object.freeze({
  BLOCKED_EXTERNAL:new Set(['environment-audit','workflow-forensics','reproduce-exact']),
  SECURITY_SIGNAL:new Set(['workflow-forensics','environment-audit','observability-trace']),
  INTERNAL_CONTRACT:new Set(['workflow-forensics','diff-forensics','synthetic-reproduction']),
  AUTOMATION_CONTROL_FAILURE:new Set(['workflow-forensics','observability-trace','diff-forensics']),
  DOWNSTREAM_FAILURE:new Set(['observability-trace','workflow-forensics','historical-analogy']),
  INTERNAL_UNKNOWN:new Set(['reproduce-exact','minimize-failure','alternate-hypothesis']),
});

function asArray(value){return Array.isArray(value)?value:[];}
function finite(value){const n=Number(value);return Number.isFinite(n)?n:0;}

export function rankReadOnlyRepairStrategies({
  classification='INTERNAL_UNKNOWN',
  currentShaEvidence=0,
  recurringDepth=0,
  historicalDepth=0,
  priorStrategies=[],
}={}){
  const repeated=new Set(asArray(priorStrategies).map(String).filter(Boolean));
  return READ_ONLY_REPAIR_BRAIN.strategies.map((id,index)=>{
    const fit=CLASS_FIT[classification]?.has(id)?0.55:0;
    const exact=Math.min(0.20,finite(currentShaEvidence)*0.05);
    const recurring=Math.min(0.10,finite(recurringDepth)*0.02);
    const history=Math.min(0.10,finite(historicalDepth)*0.02);
    const diversity=['alternate-hypothesis','synthetic-reproduction'].includes(id)?0.08:0;
    const repeatPenalty=repeated.has(id)?0.22:0;
    const score=fit+exact+recurring+history+diversity-repeatPenalty;
    return Object.freeze({
      id,
      focus:FOCUS[id],
      score:Number(score.toFixed(4)),
      repeated:repeated.has(id),
      rankSeed:index,
    });
  }).sort((a,b)=>b.score-a.score||a.rankSeed-b.rankSeed);
}

export function buildReadOnlyRepairBrain({
  executionSha,
  botId = 'READ-INVESTIGATOR',
  observed=[],
  historicalMemory=[],
  rootCauseCandidates=[],
  securitySignals=[],
  deepInference=null,
}={}){
  const runtime=assertUnifiedBotRuntime(botId, 'READ_ONLY');
  const exact=SHA_RE.test(String(executionSha??''));
  const rows=asArray(observed);
  const current=rows.filter(item=>item?.headSha===executionSha);
  const recurringDepth=Math.max(
    0,
    ...rows.map(item=>finite(item?.occurrences??0)),
    ...rows.flatMap(item=>asArray(item?.recurringPatterns).map(x=>finite(x?.occurrences??0))),
  );
  const historicalDepth=asArray(historicalMemory).length;
  const classification=String(
    rootCauseCandidates[0]?.classification
    ?? current.find(item=>item?.classification)?.classification
    ?? 'INTERNAL_UNKNOWN'
  );
  const priorStrategies=asArray(historicalMemory)
    .flatMap(item=>asArray(item?.strategies).length?item.strategies:[item?.rule])
    .filter(Boolean)
    .map(String);
  const ranking=rankReadOnlyRepairStrategies({
    classification,
    currentShaEvidence:current.length,
    recurringDepth,
    historicalDepth,
    priorStrategies,
  });
  const selected=ranking[0]??null;
  const adaptive=buildAdaptiveFailureMemory({
    attempt:Math.max(1,current.length),
    priorStrategies,
    selectedStrategy:selected?.id??null,
    allStrategiesExhausted:false,
    teachingEscalation:classification==='INTERNAL_UNKNOWN' || classification==='SECURITY_SIGNAL',
    causalRootCause:String(rootCauseCandidates[0]?.reason??classification),
  });

  const passes=[
    ['X1_EXACT_SHA',exact,'exact execution SHA is bound'],
    ['X2_CAUSAL_PROOF',rootCauseCandidates.length>0,'a causal candidate exists; verification remains required'],
    ['X3_ADVERSARIAL_CHALLENGE',Boolean(deepInference?.falsification?.length)||classification==='INTERNAL_UNKNOWN','falsification evidence exists or uncertainty forces challenge'],
    ['X4_LEARNING_MEMORY',historicalDepth>0,'historical memory is available'],
    ['X5_VERIFICATION_PLAN',current.some(item=>Array.isArray(item?.salientEvidence)?item.salientEvidence.length>0:Boolean(item?.logCaptured)),'current evidence includes captured failure signals'],
    ['X6_PATCH_SIMULATION',false,'read-only bot never simulates or applies a source mutation'],
    ['X7_COUNTEREXAMPLE_HUNT',Boolean(deepInference?.falsification?.length),'counterexample/falsification search is available'],
    ['X8_PATCH_CORRECTNESS_PROOF',false,'source correctness cannot be certified from read-only analysis alone'],
    ['X9_INDEPENDENT_REPAIR_JUDGE',false,'Master Repair authority remains outside the read-only bot'],
    ['X10_ADAPTIVE_REPAIR_PORTFOLIO',ranking.length>=2 && Boolean(selected),'multiple analytic repair strategies are ranked'],
  ].map(([id,passed,reason])=>Object.freeze({id,passed:Boolean(passed),reason}));

  const completedPasses=passes.filter(item=>item.passed).length;
  const blockers=passes.filter(item=>!item.passed).map(item=>item.id);
  return Object.freeze({
    protocol:READ_ONLY_REPAIR_BRAIN.protocol,
    power:READ_ONLY_REPAIR_BRAIN.power,
    runtimeProtocol:runtime.protocol,
    runtimeEngineVersion:runtime.engineVersion,
    botId:runtime.botId,
    authority:'READ_ONLY',
    mutationAuthority:false,
    certificationAuthority:false,
    executionSha:String(executionSha??''),
    exactShaVerified:exact,
    classification,
    selectedStrategy:selected?.id??null,
    rankedStrategies:Object.freeze(ranking.slice(0,10)),
    adaptiveFailureMemory:adaptive,
    tenXAnalyticProfile:Object.freeze({
      protocol:'FLIXO-READ-ONLY-TEN-X-ANALYTIC-PROFILE-v1',
      completedPasses,
      requiredPasses:10,
      passes:Object.freeze(passes),
      blockers,
      analyticReady:exact && completedPasses>=7,
      mutationReady:false,
      route:'REPORT_ONLY',
    }),
    evidenceSummary:Object.freeze({
      observedRows:rows.length,
      currentShaRows:current.length,
      historicalDepth,
      recurringDepth,
      rootCauseCandidates:rootCauseCandidates.length,
      securitySignals:asArray(securitySignals).length,
    }),
    invariants:READ_ONLY_REPAIR_BRAIN.invariants,
    nextAction:adaptive.supervisorEscalationRequired
      ? 'REPORT_ESCALATION_AND_REQUEST_NEW_EVIDENCE'
      : adaptive.newEvidenceRequired
        ? 'REPORT_NEW_EVIDENCE_OR_STRATEGY_CHANGE'
        : 'REPORT_ANALYTIC_FINDINGS',
  });
}
