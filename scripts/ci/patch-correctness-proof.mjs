import crypto from 'node:crypto';

const shaOk=(v)=>/^[a-f0-9]{40}$/u.test(String(v??''));
const bool=(v)=>v===true;
const digest=(v)=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');

export function buildPatchCorrectnessProof({
 targetSha=null,
 failureFingerprint=null,
 diagnosis=null,
 plan=null,
 fileSelection=null,
 awareness=null,
 twin=null,
 simulation=null,
 differential=null,
 regressionCounterexamples=null,
 targetedRegression=null,
 primaryProof=null,
 scopeCheck=true,
 noTestMutation=true,
 noControlPlaneMutation=true,
 noMainMutation=true,
 noGateWeakening=true,
}={}){
 const failures=[];
 if(!shaOk(targetSha)) failures.push('PATCH_SHA_INVALID');
 if(!failureFingerprint) failures.push('PATCH_FINGERPRINT_MISSING');
 const causalGraphProven=Boolean(rootCauseProof?.protocol==='CAUSAL-EVIDENCE-GRAPH-v1'&&rootCauseProof?.status==='PROVEN'&&rootCauseProof?.targetSha===targetSha&&rootCauseProof?.failureFingerprint===failureFingerprint&&rootCauseProof?.sourceMutationAllowed===false&&rootCauseProof?.proofClaims?.ROOT_CAUSE_LINKED_TO_FAILURE_SIGNAL===true&&rootCauseProof?.proofClaims?.LOCATION_LINKED_TO_CAUSE===true&&rootCauseProof?.proofClaims?.MECHANISM_EXPLAINED===true&&rootCauseProof?.proofClaims?.ALTERNATIVES_CHALLENGED===true);
 const rcaProven=Boolean(causalGraphProven&&diagnosis?.diagnosisQuality==='strong'&&Number(diagnosis?.causalConfidence??0)>=0.75&&diagnosis?.ambiguity===false&&diagnosis?.directFailureSignal===true&&diagnosis?.rootCause&&diagnosis?.location?.file);
 const targetProven=Boolean(fileSelection?.decision==='SELECTED'&&fileSelection?.targetSha===targetSha&&fileSelection?.failureFingerprint===failureFingerprint&&fileSelection?.selectedFiles?.some(x=>x.path===diagnosis?.location?.file));
 const mechanismProven=Boolean(plan?.id&&plan?.file&&(!fileSelection?.selectedFiles?.length||fileSelection.selectedFiles.some(x=>x.path===plan.file)));
 const scopeProven=Boolean(scopeCheck&&simulation?.scopeOk===true&&differential?.scopeProof===true);
 const regressionRiskAnalyzed=Boolean(regressionCounterexamples?.searchedCount===regressionCounterexamples?.requiredSearches);
 const simulationPassed=Boolean(simulation?.ok===true);
 const differentialPassed=Boolean(differential?.status==='PASS');
 const targetedPassed=Boolean(targetedRegression?.ok===true||targetedRegression?.status==='PASS'||simulation?.behavioralVerification?.ok===true);
 const twinProven=Boolean(twin?.role==='ADVERSARIAL_PROGRAMMER_FALSIFIER'&&twin?.targetSha===targetSha&&twin?.failureFingerprint===failureFingerprint&&twin?.falsificationComplete===true&&twin?.counterexampleFound===false);
 const awarenessProven=Boolean(awareness?.protocol==='ACTION-SYSTEM-COGNITIVE-AWARENESS-v1'&&awareness?.targetSha===targetSha&&awareness?.failureFingerprint===failureFingerprint&&awareness?.awarenessCompleteness?.complete===true);
 const counterexamplesExhausted=Boolean(regressionCounterexamples?.exhausted===true&&regressionCounterexamples?.counterexampleFound===false&&twin?.counterexampleFound===false);
 const primaryProven=Boolean(primaryProof?.status==='PRIMARY_CORRECTNESS_PROVEN'&&primaryProof?.proofObjective==='PROVE_PRIMARY_REPAIR_CORRECT'&&primaryProof?.targetSha===targetSha&&primaryProof?.failureFingerprint===failureFingerprint);
 if(!causalGraphProven) failures.push('CAUSAL_EVIDENCE_GRAPH_NOT_PROVEN');
 if(!rcaProven) failures.push('ROOT_CAUSE_NOT_PROVEN');
 if(!targetProven) failures.push('PATCH_TARGET_NOT_PROVEN');
 if(!mechanismProven) failures.push('PATCH_MECHANISM_NOT_PROVEN');
 if(!scopeProven) failures.push('PATCH_SCOPE_NOT_PROVEN');
 if(!regressionRiskAnalyzed) failures.push('REGRESSION_RISK_NOT_ANALYZED');
 if(!simulationPassed) failures.push('SIMULATION_NOT_PASSED');
 if(!differentialPassed) failures.push('DIFFERENTIAL_NOT_PASSED');
 if(!targetedPassed) failures.push('TARGETED_REGRESSION_NOT_PROVEN');
 if(!awarenessProven) failures.push('COGNITIVE_AWARENESS_NOT_PROVEN');
 if(!twinProven) failures.push('PROGRAMMER_TWIN_NOT_PROVEN');
 if(!counterexamplesExhausted) failures.push('COUNTEREXAMPLES_NOT_EXHAUSTED');
 if(!primaryProven) failures.push('PRIMARY_CORRECTNESS_NOT_PROVEN');
 if(noTestMutation!==true) failures.push('TEST_MUTATION_POLICY_FAILED');
 if(noControlPlaneMutation!==true) failures.push('CONTROL_PLANE_MUTATION_POLICY_FAILED');
 if(noMainMutation!==true) failures.push('MAIN_MUTATION_POLICY_FAILED');
 if(noGateWeakening!==true) failures.push('GATE_WEAKENING_POLICY_FAILED');
 const all={
  CAUSAL_EVIDENCE_GRAPH_PROVEN:causalGraphProven,
  ROOT_CAUSE_PROVEN:rcaProven,
  PATCH_TARGET_PROVEN:targetProven,
  PATCH_MECHANISM_PROVEN:mechanismProven,
  PATCH_SCOPE_PROVEN:scopeProven,
  REGRESSION_RISK_ANALYZED:regressionRiskAnalyzed,
  SIMULATION_PASSED:simulationPassed,
  DIFFERENTIAL_CHECK_PASSED:differentialPassed,
  TARGETED_REGRESSION_PASSED:targetedPassed,
  COGNITIVE_AWARENESS_PROVEN:awarenessProven,
  PROGRAMMER_TWIN_PARITY_PROVEN:twinProven,
  ADVERSARIAL_FALSIFICATION_COMPLETE:counterexamplesExhausted,
  PRIMARY_CORRECTNESS_PROVEN:primaryProven,
  NO_SCOPE_VIOLATION:scopeProven,
  NO_TEST_MUTATION:noTestMutation===true,
  NO_CONTROL_PLANE_MUTATION:noControlPlaneMutation===true,
  NO_MAIN_MUTATION:noMainMutation===true,
  NO_GATE_WEAKENING:noGateWeakening===true,
 };
 const proofCompleteness={...all,NO_VALID_COUNTEREXAMPLE:counterexamplesExhausted};
 return Object.freeze({
  schemaVersion:1,
  protocol:'PATCH-CORRECTNESS-PROOF-v1',
  status:failures.length===0?'PROVEN':'BLOCK',
  targetSha,
  failureFingerprint,
  exactShaBound:true,
  proofCompleteness,
  claims:all,
  remainingRisks:failures.length?failures:[],
  evidenceRefs:{
   awareness:awareness?.protocol??null,
   twin:twin?.protocol??null,
   simulation:simulation?.reason??null,
   differential:differential?.protocol??null,
   regression:regressionCounterexamples?.protocol??null,
  },
  proofDigest:digest({targetSha,failureFingerprint,proofCompleteness,failures}),
  sourceMutationAllowed:false,
  generatedAt:new Date().toISOString(),
 });
}
