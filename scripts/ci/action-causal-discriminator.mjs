import crypto from 'node:crypto';

const SIGNALS = Object.freeze([
  {
    id: 'typescript-async-contract',
    className: 'TYPE_CONTRACT',
    patterns: [
      /TS1064\b/iu,
      /return type of an async function or method must be the global Promise/iu,
      /Did you mean to write ['"]?Promise/iu,
    ],
    mutationAllowed: true,
    targetScope: 'exact-source-function',
  },
  {
    id: 'typescript-missing-import',
    className: 'TYPE_CONTRACT',
    patterns: [/TS2304\b/iu, /Cannot find name ["'][^"']+["']/iu],
    mutationAllowed: true,
    targetScope: 'exact-source-import',
  },
  {
    id: 'workflow-artifact-provenance',
    className: 'WORKFLOW_SECURITY',
    patterns: [/artifact poisoning/iu, /artifact.*untrusted.*workflow_dispatch/iu],
    mutationAllowed: true,
    targetScope: 'exact-workflow-artifact-consumer',
  },
  {
    id: 'workflow-env-injection',
    className: 'WORKFLOW_SECURITY',
    patterns: [
      /Environment variable built from user-controlled sources/iu,
      /GITHUB_ENV/iu,
      /user-controlled.*environment variable/iu,
    ],
    mutationAllowed: true,
    targetScope: 'exact-workflow-env-boundary',
  },
  {
    id: 'lint',
    className: 'STATIC_ANALYSIS',
    patterns: [/eslint/iu, /no-unused-vars/iu, /unused variable/iu],
    mutationAllowed: true,
    targetScope: 'exact-source-line',
  },
  {
    id: 'format',
    className: 'STATIC_ANALYSIS',
    patterns: [/prettier/iu, /code style/iu, /formatting/iu],
    mutationAllowed: true,
    targetScope: 'exact-source-file',
  },
  {
    id: 'external-tooling',
    className: 'EXTERNAL',
    patterns: [/rate limit/iu, /api-deployments-free-per-day/iu, /provider.*failed/iu, /network.*timeout/iu],
    mutationAllowed: false,
    targetScope: 'no-source-mutation',
  },
]);

const clamp01=(value)=>Math.max(0,Math.min(1,Number(value)||0));
const countMatches=(log,patterns)=>patterns.reduce((n,pattern)=>n+(pattern.test(log)?1:0),0);

function hash(value){
  return crypto.createHash('sha256').update(String(value),'utf8').digest('hex');
}

function sourceLocationHints(log){
  return [...new Set(
    String(log??'').match(/(?:^|[\s(])((?:src|scripts|\.github|diagnostics|docs)\/[A-Za-z0-9_./-]+\.(?:mjs|cjs|js|jsx|ts|tsx|yml|yaml|json))(?:[:)]|\s|$)/g)
      ?.map((value)=>value.replace(/^[\s(]+|[:)\s]+$/g,'')) ?? []
  )].slice(0,12);
}

function historicalOutcome(strategyId, exactCases){
  let success=0;
  let rejected=0;
  for(const item of exactCases??[]){
    success += (item.successfulStrategies??[]).filter((value)=>value===strategyId).length;
    rejected += (item.failedStrategies??[]).filter((value)=>value===strategyId).length;
    rejected += (item.rules??[]).filter((value)=>value===strategyId && item.outcome==='FAILED').length;
  }
  return {success,rejected};
}

function buildCandidate(signal, log, exactCases, doNotRepeat){
  const anchors=countMatches(log,signal.patterns);
  const locationHints=sourceLocationHints(log);
  const history=historicalOutcome(signal.id,exactCases);
  const repeatedRejected=doNotRepeat.includes(signal.id);
  const evidenceScore=clamp01(
    0.50 +
    anchors*0.18 +
    (locationHints.length?0.12:0) +
    Math.min(history.success,3)*0.06 -
    Math.min(history.rejected,3)*0.10 -
    (repeatedRejected?0.15:0)
  );
  const contradictions=[];
  if(repeatedRejected) contradictions.push('HISTORICAL_REJECTION_FOR_SAME_STRATEGY');
  if(signal.mutationAllowed && !locationHints.length) contradictions.push('SOURCE_LOCATION_NOT_EXPLICIT');
  return {
    id:signal.id,
    className:signal.className,
    targetScope:signal.targetScope,
    mutationAllowed:signal.mutationAllowed && !repeatedRejected,
    proposalOnly:!signal.mutationAllowed || repeatedRejected,
    historicallyRejected:repeatedRejected,
    evidenceAnchors:anchors,
    sourceLocationHints:locationHints,
    historicalOutcome:history,
    contradictions,
    evidenceScore,
    falsificationTarget: signal.mutationAllowed
      ? 'A plausible earlier causal boundary or competing diagnostic must be ruled out before mutation.'
      : 'External/tooling evidence must remain isolated from source-repair decisions.',
  };
}

export function buildCausalDiscriminator({
  failureLog='',
  exactCases=[],
  doNotRepeat=[],
  fingerprint='',
  targetSha='',
}={}){
  const log=String(failureLog??'');
  const candidates=SIGNALS.map((signal)=>buildCandidate(signal,log,exactCases,doNotRepeat))
    .filter((candidate)=>candidate.evidenceAnchors>0)
    .sort((a,b)=>b.evidenceScore-a.evidenceScore || b.evidenceAnchors-a.evidenceAnchors);

  const [top,runnerUp]=candidates;
  const margin=top ? top.evidenceScore-(runnerUp?.evidenceScore??0) : 0;
  const ambiguous=!top || top.historicallyRejected || (top.mutationAllowed && (top.evidenceScore<0.78 || margin<0.08 || top.contradictions.includes('SOURCE_LOCATION_NOT_EXPLICIT')));
  const selected=ambiguous ? null : top;

  const probes=[
    {name:'TS_ASYNC',log:'src/lib/demo.ts:42 TS1064 return type of an async function must be Promise',expected:'typescript-async-contract'},
    {name:'ARTIFACT',log:'.github/workflows/auto-repair.yml: artifact poisoning from workflow_dispatch',expected:'workflow-artifact-provenance'},
    {name:'EXTERNAL',log:'provider rate limit exceeded api-deployments-free-per-day',expected:'external-tooling'},
  ];
  const probeResults=probes.map((probe)=>{
    const ranked=SIGNALS.map((signal)=>buildCandidate(signal,probe.log,[],[]))
      .filter((candidate)=>candidate.evidenceAnchors>0)
      .sort((a,b)=>b.evidenceScore-a.evidenceScore);
    return {
      name:probe.name,
      expected:probe.expected,
      actual:ranked[0]?.id??null,
      pass:(ranked[0]?.id??null)===probe.expected,
    };
  });
  const probePassRate=probeResults.filter((item)=>item.pass).length/probeResults.length;
  const distinctProbeDecisions=new Set(probeResults.map((item)=>item.actual)).size;

  const components={
    causalEvidence:top ? clamp01(top.evidenceScore) : 0,
    separation:clamp01(margin/0.25),
    historicalDiscipline:top
      ? clamp01(1 - Math.min(top.historicalOutcome.rejected,3)*0.2)
      : 0,
    probeAccuracy:clamp01(probePassRate),
  };
  const capabilityScore=Number(((components.causalEvidence*0.45)+(components.separation*0.20)+(components.historicalDiscipline*0.15)+(components.probeAccuracy*0.20)).toFixed(3));

  return {
    protocol:'CAUSAL-DISCRIMINATOR-v1',
    identityDigest:hash(fingerprint+'|'+targetSha+'|'+(top?.id??'NONE')),
    hypotheses:candidates,
    ranking:{
      selectedStrategy:selected?.id??null,
      runnerUp:runnerUp?.id??null,
      margin:Number(margin.toFixed(3)),
      ambiguous,
    },
    capabilityScore,
    capabilityMetrics:{
      causalEvidence:components.causalEvidence,
      hypothesisSeparation:components.separation,
      historicalDiscipline:components.historicalDiscipline,
      probeAccuracy:components.probeAccuracy,
      probeCount:probeResults.length,
      distinctProbeDecisions,
    },
    probeSuite:{
      passed:probeResults.every((item)=>item.pass),
      results:probeResults,
    },
    decision:selected ? 'BOUNDED_HYPOTHESIS_SELECTED' : 'NO_SAFE_HYPOTHESIS',
    exactShaBound:Boolean(/^[a-f0-9]{40}$/iu.test(targetSha)),
    failClosed:ambiguous,
  };
}
