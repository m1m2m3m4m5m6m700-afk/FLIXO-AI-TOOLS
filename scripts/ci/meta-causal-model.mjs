import crypto from 'node:crypto';

const DIMENSIONS = Object.freeze([
  'IDENTITY_COHERENCE',
  'TEMPORAL_COHERENCE',
  'EPISTEMIC_INTEGRITY',
  'AUTHORITY_COHERENCE',
  'BOUNDARY_ISOLATION',
  'FEEDBACK_STABILITY',
  'CAUSAL_ORDERING',
]);

const SIGNALS = Object.freeze([
  { id:'STALE_IDENTITY', dimension:'IDENTITY_COHERENCE', weight:1, patterns:[/SHA mismatch/iu,/stale SHA/iu,/head race/iu,/wrong target SHA/iu] },
  { id:'TEMPORAL_DRIFT', dimension:'TEMPORAL_COHERENCE', weight:1, patterns:[/newer commit/iu,/superseded/iu,/current HEAD/iu,/concurrent/iu] },
  { id:'EVIDENCE_WEAKNESS', dimension:'EPISTEMIC_INTEGRITY', weight:1, patterns:[/ambiguous/iu,/without evidence/iu,/unknown root cause/iu,/exact source location/iu] },
  { id:'AUTHORITY_DRIFT', dimension:'AUTHORITY_COHERENCE', weight:1, patterns:[/main/iu,/wrong branch/iu,/third branch/iu,/control-plane/iu,/registry/iu,/permission/iu] },
  { id:'BOUNDARY_LEAK', dimension:'BOUNDARY_ISOLATION', weight:1, patterns:[/provider/iu,/rate limit/iu,/external/iu,/untrusted artifact/iu,/user-controlled/iu] },
  { id:'FEEDBACK_LOOP', dimension:'FEEDBACK_STABILITY', weight:1, patterns:[/recursion/iu,/repeat/iu,/reverted/iu,/same strategy/iu,/same failure/iu,/retry/iu] },
  { id:'ORDERING_DRIFT', dimension:'CAUSAL_ORDERING', weight:1, patterns:[/certification/iu,/secondary/iu,/downstream/iu,/primary red/iu,/earliest gate/iu] },
]);

const clamp=(x)=>Math.max(0,Math.min(1,Number(x)||0));
const hash=(value)=>crypto.createHash('sha256').update(String(value),'utf8').digest('hex');

function countHits(text, patterns){
  return patterns.reduce((n,p)=>n+(p.test(text)?1:0),0);
}

function historySignals(entries=[]){
  const text=entries.map(x=>[x.rootCause,x.rule,x.lesson].filter(Boolean).join(' ')).join('\n');
  return text;
}

export function buildMetaCausalModel({
  failureLog='',
  targetSha='',
  currentHeadSha='',
  failedRunId='',
  taskId='',
  branch='execution',
  historicalKnowledge=[],
  exactCases=[],
  doNotRepeat=[],
}={}){
  const log=String(failureLog??'');
  const history=historySignals(historicalKnowledge);
  const combined=log+'\n'+history;
  const dimensions=Object.fromEntries(DIMENSIONS.map((dimension)=>[dimension,{risk:0,evidence:[],signals:[]}]));

  for(const signal of SIGNALS){
    const hits=countHits(combined,signal.patterns);
    if(hits){
      const d=dimensions[signal.dimension];
      d.risk=clamp(d.risk + Math.min(1,hits*0.22));
      d.evidence.push(signal.id);
      d.signals.push(hits);
    }
  }

  const hardBlocks=[];
  if(!/^[a-f0-9]{40}$/iu.test(targetSha)) hardBlocks.push('EXACT_SHA_MISSING');
  if(!failedRunId) hardBlocks.push('FAILED_RUN_ID_MISSING');
  if(!taskId) hardBlocks.push('TASK_ID_MISSING');
  if(branch !== 'execution') hardBlocks.push('MUTATION_BRANCH_NOT_EXECUTION');
  if(currentHeadSha && currentHeadSha !== targetSha){
    hardBlocks.push('CURRENT_HEAD_DIFFERS_FROM_TARGET_SHA');
    dimensions.IDENTITY_COHERENCE.risk=1;
    dimensions.TEMPORAL_COHERENCE.risk=1;
  }
  if(doNotRepeat.length){
    hardBlocks.push('HISTORICALLY_REJECTED_STRATEGY_PRESENT');
    dimensions.FEEDBACK_STABILITY.risk=1;
  }
  if(exactCases.some(x=>Number(x.failures??0)>0 && Number(x.successes??0)===0)){
    dimensions.FEEDBACK_STABILITY.risk=Math.max(dimensions.FEEDBACK_STABILITY.risk,0.85);
  }

  const providerAndMutation=/provider|rate limit|external/iu.test(log) && /mutat|patch|source/iu.test(log);
  if(providerAndMutation){
    hardBlocks.push('EXTERNAL_FAILURE_SOURCE_MUTATION_COLLISION');
    dimensions.BOUNDARY_ISOLATION.risk=1;
  }

  const evidenceIntegrity=clamp(1-dimensions.EPISTEMIC_INTEGRITY.risk);
  const systemRisks=Object.values(dimensions).map(x=>x.risk);
  const systemicRisk=Number((systemRisks.reduce((a,b)=>a+b,0)/systemRisks.length).toFixed(3));

  let governingRoot='CAUSAL-OBSERVABILITY-LOSS';
  if(hardBlocks.includes('CURRENT_HEAD_DIFFERS_FROM_TARGET_SHA')) governingRoot='TEMPORAL-IDENTITY-COLLAPSE';
  else if(hardBlocks.includes('MUTATION_BRANCH_NOT_EXECUTION')) governingRoot='AUTHORITY-TOPOLOGY-COLLAPSE';
  else if(hardBlocks.includes('EXTERNAL_FAILURE_SOURCE_MUTATION_COLLISION')) governingRoot='BOUNDARY-CONTAMINATION';
  else if(hardBlocks.includes('HISTORICALLY_REJECTED_STRATEGY_PRESENT')) governingRoot='FEEDBACK-LEARNING-LOOP-FAILURE';
  else if(systemicRisk >= 0.55) governingRoot='CAUSAL-CONTROL-PLANE-INCOHERENCE';

  const mutationAllowed=hardBlocks.length===0 && evidenceIntegrity>=0.45;

  return {
    protocol:'META-CAUSAL-MODEL-v1',
    governingRoot,
    systemicRisk,
    mutationAllowed,
    hardBlocks,
    dimensions,
    evidenceIntegrity,
    identityDigest:hash([taskId,failedRunId,targetSha,branch,governingRoot].join('|')),
    invariant:'The repair system must preserve trustworthy causal observability while evidence, authority, time, boundaries and learning remain coherent.',
    nextQuestion: mutationAllowed
      ? 'Which bounded source change resolves the selected root without reducing causal observability?'
      : 'Which control-plane or evidence defect must be corrected before source mutation can be considered?',
  };
}
