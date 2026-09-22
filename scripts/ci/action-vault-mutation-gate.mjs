#!/usr/bin/env node
import fs from 'node:fs';
import { validateActionVaultVerifierProof, validateActionVaultPreMutationProofs } from './repair-protocol.mjs';

export const APPROVED_MUTATION_RECOMMENDATIONS=Object.freeze([
  'ALLOW',
  'ALLOW_AFTER_FALSIFICATION_NO_COUNTEREXAMPLE',
]);

const shaOk=(v)=>/^[a-f0-9]{40}$/u.test(String(v??''));

export function evaluateMutationGate({
  targetSha=null,
  currentSha=null,
  failureFingerprint=null,
  verifierProof=null,
  cognitiveAwareness=null,
  rootCauseProof=null,
  fileSelection=null,
  programmerTwinParity=null,
  falsificationReport=null,
  simulationProof=null,
  differentialProof=null,
  patchCorrectness=null,
  regressionCounterexamples=null,
  preMutationProof=null,
  catalogReview=null,
  diagnosisKnowledgeReview=null,
  mutationScope={changedPaths:[],selectedFiles:[],testMutation:false,controlPlaneMutation:false,mainMutation:false,gateWeakening:false},
  branch='execution',
  fiveXEnvelope=null,
  fiveXCycleState=null,
}={}){
  const failures=[];
  if (!preMutationProof || typeof preMutationProof !== 'object') failures.push('PRE_MUTATION_PROOF_MISSING');
  if (preMutationProof) {
    try {
      validateActionVaultPreMutationProofs({
        sandboxProof:preMutationProof.sandboxSimulation,
        differentialProof:preMutationProof.differentialProof,
        patchCorrectnessProof:preMutationProof.patchCorrectness,
        regressionCounterexamples:preMutationProof.regressionCounterexamples,
        targetSHA:targetSha,
        failureFingerprint,
      });
      if (preMutationProof.status !== 'PROVEN' || preMutationProof.noMutationApplied !== true) failures.push('PRE_MUTATION_PROOF_STATUS_INVALID');
      if (verifierProof?.preMutationProof?.proofDigest && verifierProof.preMutationProof.proofDigest !== preMutationProof.patchCorrectness?.proofDigest) failures.push('PRE_MUTATION_DIGEST_MISMATCH');
    } catch (error) {
      failures.push('PRE_MUTATION_PROOF_INVALID:'+String(error?.message??error));
    }
  }
  const currentRunId=String(preMutationProof?.failedRunId??verifierProof?.runId??'');
  const twinSearches=Array.isArray(falsificationReport?.falsificationSearches)?falsificationReport.falsificationSearches:[];
  if (!currentRunId || twinSearches.length<10 || twinSearches.some(item => item?.targetSha!==targetSha || item?.failureFingerprint!==failureFingerprint || item?.runId!==currentRunId || Number.isNaN(Date.parse(String(item?.observedAt??''))))) failures.push('FALSIFICATION_EVIDENCE_PROVENANCE_INVALID');
  const rcaRecords=Array.isArray(rootCauseProof?.evidenceRecords)?rootCauseProof.evidenceRecords:[];
  if (rootCauseProof?.protocol==='CAUSAL-EVIDENCE-GRAPH-v1' && (!rcaRecords.length || rcaRecords.some(item => item?.targetSha!==targetSha || item?.failureFingerprint!==failureFingerprint || item?.runId!==currentRunId || Number.isNaN(Date.parse(String(item?.timestamp??'')))))) failures.push('RCA_EVIDENCE_PROVENANCE_INVALID');
  const checks={
    EXACT_SHA:shaOk(targetSha)&&shaOk(currentSha)&&targetSha===currentSha,
    FAILURE_FINGERPRINT:typeof failureFingerprint==='string'&&failureFingerprint.length>0,
    DIAGNOSIS_KNOWLEDGE_MATCH:Boolean(diagnosisKnowledgeReview?.protocol==='ACTION-VAULT-DIAGNOSIS-KNOWLEDGE-REVIEW-v1'&&diagnosisKnowledgeReview?.reviewer==='ACTION-HISTORIAN-3'&&diagnosisKnowledgeReview?.decision==='MATCH'&&diagnosisKnowledgeReview?.allowSourceMutation===true&&diagnosisKnowledgeReview?.targetSha===targetSha&&diagnosisKnowledgeReview?.fingerprint===failureFingerprint&&diagnosisKnowledgeReview?.catalogDigest===catalogReview?.digest&&typeof diagnosisKnowledgeReview?.diagnosisDigest==='string'&&diagnosisKnowledgeReview.diagnosisDigest.length===64),
    CATALOG_REVIEW:Boolean(catalogReview?.status==='REVIEWED'&&catalogReview?.reviewer==='ACTION-HISTORIAN-3'&&catalogReview?.beforeMutation===true&&catalogReview?.mutationAuthority===false&&catalogReview?.taskId&&catalogReview?.fingerprint===failureFingerprint&&catalogReview?.targetSha===targetSha&&catalogReview?.source?.indexId==='ACTION-INDEX-4000'&&Number(catalogReview?.source?.declaredCapacity)>=1000000&&Number(catalogReview?.source?.actualRecordCount)>0&&typeof catalogReview?.digest==='string'&&catalogReview.digest.length===64),
    COGNITIVE_AWARENESS:Boolean(cognitiveAwareness?.protocol==='ACTION-SYSTEM-COGNITIVE-AWARENESS-v1'&&cognitiveAwareness?.targetSha===targetSha&&cognitiveAwareness?.failureFingerprint===failureFingerprint&&cognitiveAwareness?.awarenessCompleteness?.complete===true),
    CAUSAL_EVIDENCE_GRAPH_PROVEN:Boolean(rootCauseProof?.protocol==='CAUSAL-EVIDENCE-GRAPH-v1'&&rootCauseProof?.status==='PROVEN'&&rootCauseProof?.targetSha===targetSha&&rootCauseProof?.failureFingerprint===failureFingerprint&&rootCauseProof?.sourceMutationAllowed===false&&rootCauseProof?.proofClaims?.ROOT_CAUSE_LINKED_TO_FAILURE_SIGNAL===true&&rootCauseProof?.proofClaims?.LOCATION_LINKED_TO_CAUSE===true&&rootCauseProof?.proofClaims?.MECHANISM_EXPLAINED===true&&rootCauseProof?.proofClaims?.ALTERNATIVES_CHALLENGED===true),
    ROOT_CAUSE_PROOF:Boolean(rootCauseProof?.status==='PROVEN'&&rootCauseProof?.targetSha===targetSha&&rootCauseProof?.failureFingerprint===failureFingerprint),
    FILE_SELECTION:Boolean(fileSelection?.decision==='SELECTED'&&fileSelection?.targetSha===targetSha&&fileSelection?.failureFingerprint===failureFingerprint&&Array.isArray(fileSelection?.selectedFiles)&&fileSelection.selectedFiles.length>0),
    PROGRAMMER_TWIN_PARITY:Boolean(programmerTwinParity?.intelligenceParity==='EXACT'&&programmerTwinParity?.authorityParity==='SEPARATED_BY_DESIGN'&&programmerTwinParity?.targetSha===targetSha&&programmerTwinParity?.failureFingerprint===failureFingerprint),
    ADVERSARIAL_FALSIFICATION_COMPLETE:Boolean(falsificationReport?.falsificationComplete===true&&falsificationReport?.counterexampleFound===false&&falsificationReport?.targetSha===targetSha&&falsificationReport?.failureFingerprint===failureFingerprint),
    NO_VALID_COUNTEREXAMPLE:Boolean(falsificationReport?.counterexampleFound===false&&falsificationReport?.falsificationComplete===true&&regressionCounterexamples?.counterexampleFound===false&&regressionCounterexamples?.exhausted===true),
    SANDBOX_SIMULATION:Boolean(simulationProof?.status==='PASS'||simulationProof?.ok===true||simulationProof?.status==='PROVEN'),
    DIFFERENTIAL_VERIFICATION:Boolean(differentialProof?.status==='PASS'),
    PATCH_CORRECTNESS:Boolean(patchCorrectness?.status==='PROVEN'&&patchCorrectness?.proofCompleteness?.PATCH_TARGET_PROVEN===true&&patchCorrectness?.proofCompleteness?.PATCH_MECHANISM_PROVEN===true),
    REGRESSION_COUNTEREXAMPLES_EXHAUSTED:Boolean(regressionCounterexamples?.exhausted===true&&regressionCounterexamples?.targetSha===targetSha&&regressionCounterexamples?.failureFingerprint===failureFingerprint),
    NO_SCOPE_VIOLATION:mutationScope.testMutation===false&&mutationScope.controlPlaneMutation===false&&mutationScope.mainMutation===false&&mutationScope.gateWeakening===false&&branch==='execution',
    NO_TEST_MUTATION:mutationScope.testMutation===false,
    NO_CONTROL_PLANE_MUTATION:mutationScope.controlPlaneMutation===false,
    NO_MAIN_MUTATION:mutationScope.mainMutation===false,
    NO_GATE_WEAKENING:mutationScope.gateWeakening===false,
    FIVE_X_EXECUTION_READY:Boolean(
      fiveXEnvelope?.status==='READY_FOR_AUTHORIZED_EXECUTION' &&
      fiveXEnvelope?.exactSha===targetSha &&
      fiveXEnvelope?.branch===branch &&
      fiveXEnvelope?.mutationAuthority===false &&
      fiveXEnvelope?.certificationAuthority===false &&
      Array.isArray(fiveXEnvelope?.blockers) &&
      fiveXEnvelope.blockers.length===0
    ),
    FIVE_X_REPAIR_CYCLE_READY:Boolean(
      fiveXCycleState?.protocol==='FLIXO-FIVE-X-REPAIR-CYCLE-v1' &&
      fiveXCycleState?.targetSha===targetSha &&
      fiveXCycleState?.currentSha===currentSha &&
      fiveXCycleState?.mutationReady===true &&
      fiveXCycleState?.staleEvidence===false &&
      fiveXCycleState?.invalidatedPriorEvidence===false &&
      fiveXCycleState?.counterexampleFound!==true
    ),
  };
  for(const [key,ok] of Object.entries(checks)) if(!ok) failures.push(key);
  let normalizedVerifier=null;
  if(verifierProof){
    try{
      normalizedVerifier=validateActionVaultVerifierProof({proof:verifierProof,targetSHA:targetSha,failureFingerprint,verifierAgent:'actionRepairVerifier'});
    }catch(error){ failures.push('ACTION_VAULT_VERIFIER_PROOF:'+String(error?.message??error)); }
  } else {
    failures.push('ACTION_VAULT_VERIFIER_PROOF_MISSING');
  }
  const recommendation=verifierProof?.mutationRecommendation??null;
  if(!APPROVED_MUTATION_RECOMMENDATIONS.includes(recommendation)) failures.push('MUTATION_RECOMMENDATION_NOT_APPROVED');
  if(!Array.isArray(verifierProof?.remainingRisks)) failures.push('REMAINING_RISKS_REQUIRED');
  const proofCompleteness=verifierProof?.proofCompleteness??{};
  const requiredCompleteness=[
    'CATALOG_REVIEW_PROVEN','DIAGNOSIS_KNOWLEDGE_MATCH_PROVEN','COGNITIVE_AWARENESS_PROVEN','CAUSAL_EVIDENCE_GRAPH_PROVEN','ROOT_CAUSE_PROVEN','FILE_SELECTION_PROVEN',
    'PROGRAMMER_TWIN_PARITY_PROVEN','ADVERSARIAL_FALSIFICATION_COMPLETE','NO_VALID_COUNTEREXAMPLE',
    'SANDBOX_SIMULATION_PASSED','DIFFERENTIAL_CHECK_PASSED','PATCH_CORRECTNESS_PROVEN',
    'REGRESSION_COUNTEREXAMPLES_EXHAUSTED','NO_SCOPE_VIOLATION','NO_TEST_MUTATION',
    'NO_CONTROL_PLANE_MUTATION','NO_MAIN_MUTATION','NO_GATE_WEAKENING',
  ];
  for(const key of requiredCompleteness) if(proofCompleteness[key]!==true) failures.push('PROOF_COMPLETENESS:'+key);
  return Object.freeze({
    schemaVersion:1,
    protocol:'ACTION-VAULT-MUTATION-GATE-v1',
    status:failures.length?'BLOCK':'PASS',
    mutationAllowed:failures.length===0,
    recommendation,
    targetSha,
    currentSha,
    failureFingerprint,
    checks,
    proofCompleteness,
    normalizedVerifier,
    failures,
    rule:'MUTATION_BLOCKED_UNTIL_ALL_REQUIRED_PROOFS_PASS',
    generatedAt:new Date().toISOString(),
  });
}

if(process.argv[1]?.endsWith('action-vault-mutation-gate.mjs')&&process.argv[2]){
  const report=evaluateMutationGate(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));
  fs.writeFileSync(process.argv[3]??'/tmp/action-vault-mutation-gate.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(report.status!=='PASS')process.exitCode=1;
}