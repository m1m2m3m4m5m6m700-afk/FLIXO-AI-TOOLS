#!/usr/bin/env node
import assert from 'node:assert/strict';
import {REPAIR_PROTOCOL,REPAIR_PROTOCOL_HASH,assertProtocolDefinition,assertAgentAdmission,createRepairSession,captureFailure,authorizeMutation,completeRepairSession,validateActionVaultVerifierProof,validateCommitBoundary,validatePostCommitBoundary,validateErrorOnlyMutation,validateMinimalRepairScope,validateTargetedRegressionSelection} from './repair-protocol.mjs';

const definition=assertProtocolDefinition();
assert.equal(definition.protocolId,'REPAIR_PROTOCOL');
assert.equal(definition.protocolVersion,'1.0.0');
assert.equal(definition.protocolHash,REPAIR_PROTOCOL_HASH);
assert.equal(REPAIR_PROTOCOL.commitPolicy,'ONE_COMMIT_PER_COMPLETED_REPAIR_SESSION');
assert.equal(REPAIR_PROTOCOL.mutationScope,'ERROR_ONLY');
assert.equal(REPAIR_PROTOCOL.testMutationPolicy,'BLOCK');
assert.throws(
  () => validateErrorOnlyMutation({failureLocation:'src/failure.ts',selectedFile:'src/other.ts',changedPaths:['src/other.ts']}),
  /REPAIR_PROTOCOL_ERROR_TARGET_MISMATCH/,
);
assert.throws(
  () => validateErrorOnlyMutation({failureLocation:'src/failure.ts',selectedFile:'src/failure.ts',changedPaths:['src/failure.ts','src/extra.ts']}),
  /REPAIR_PROTOCOL_ERROR_SCOPE_EXCEEDED/,
);
assert.throws(
  () => validateErrorOnlyMutation({failureLocation:'tests/failure.spec.ts',selectedFile:'tests/failure.spec.ts',changedPaths:['tests/failure.spec.ts']}),
  /REPAIR_PROTOCOL_TEST_MUTATION_BLOCKED/,
);
assert.deepEqual(
  validateErrorOnlyMutation({failureLocation:'src/failure.ts',selectedFile:'src/failure.ts',changedPaths:['src/failure.ts']}),
  {mode:'ERROR_ONLY',failureLocation:'src/failure.ts',selectedFile:'src/failure.ts',selectedFiles:['src/failure.ts'],changedPaths:['src/failure.ts'],testMutation:false,controlPlaneMutation:false,exactTargetSet:true},
);
assert.deepEqual(
  validateErrorOnlyMutation({failureLocation:'src/failure.ts',selectedFiles:['src/failure.ts','src/helper.ts'],changedPaths:['src/failure.ts','src/helper.ts']}),
  {mode:'ERROR_ONLY',failureLocation:'src/failure.ts',selectedFile:'src/failure.ts',selectedFiles:['src/failure.ts','src/helper.ts'],changedPaths:['src/failure.ts','src/helper.ts'],testMutation:false,controlPlaneMutation:false,exactTargetSet:true},
);
assert.throws(
  () => validateErrorOnlyMutation({failureLocation:'src/failure.ts',selectedFiles:['src/helper.ts'],changedPaths:['src/helper.ts']}),
  /REPAIR_PROTOCOL_ERROR_TARGET_MISMATCH|REPAIR_PROTOCOL_CAUSAL_SOURCE_NOT_IN_TARGET_SET/,
);
assert.throws(
  () => validateErrorOnlyMutation({failureLocation:'src/failure.ts',selectedFiles:['src/failure.ts','scripts/ci/repair-protocol.mjs'],changedPaths:['src/failure.ts']}),
  /REPAIR_PROTOCOL_CONTROL_PLANE_MUTATION_BLOCKED/,
);
assert.deepEqual(
  validateMinimalRepairScope({affectedPaths:['src/failure.ts','src/helper.ts'],changedPaths:['src/failure.ts']}),
  {mode:'MINIMAL_AFFECTED_SCOPE',affectedPaths:['src/failure.ts','src/helper.ts'],changedPaths:['src/failure.ts'],unexpectedPaths:[]},
);
assert.throws(
  () => validateMinimalRepairScope({affectedPaths:['src/failure.ts'],changedPaths:['src/failure.ts','src/extra.ts']}),
  /REPAIR_PROTOCOL_SCOPE_EXCEEDED/,
);
assert.throws(
  () => validateMinimalRepairScope({affectedPaths:[],changedPaths:['src/failure.ts']}),
  /REPAIR_PROTOCOL_MINIMAL_SCOPE_AFFECTED_PATHS_REQUIRED/,
);
assert.deepEqual(
  validateTargetedRegressionSelection({exact:true,commands:[['node',['tests/example.mjs']]],regressionMode:'MINIMAL_TARGET_REPEAT'}),
  {mode:'TARGET_ONLY',exact:true,commandCount:1,regressionMode:'MINIMAL_TARGET_REPEAT'},
);
assert.throws(
  () => validateTargetedRegressionSelection({exact:false,commands:[['npm',['test']]],regressionMode:'MINIMAL_TARGET_REPEAT'}),
  /REPAIR_PROTOCOL_TARGETED_REGRESSION_NOT_EXACT/,
);
assert.throws(()=>assertAgentAdmission({actor:'unknownFutureAgent'}),/UNKNOWN_AGENT/);
assert.throws(()=>assertAgentAdmission({actor:'diagnosticAgent',branch:'execution',mutation:true}),/MUTATION_ROLE_BLOCKED/);
assert.throws(()=>assertAgentAdmission({actor:'taskAgent',branch:'execution',mutation:true}),/MUTATION_ROLE_BLOCKED/);
assert.throws(()=>assertAgentAdmission({actor:'implementation',branch:'execution',mutation:true}),/MUTATION_ROLE_BLOCKED/);
const targetSHA='a'.repeat(40);
const actionRepairSession=createRepairSession({repairSessionId:'action-repair-session',actor:'actionRepairBot',failureFingerprint:'action-repair-test',targetSHA,beforeState:{worktree:'clean'}});
assert.equal(actionRepairSession.actor,'actionRepairBot');
const completeProof={
  COGNITIVE_AWARENESS_PROVEN:true,
  ROOT_CAUSE_PROVEN:true,
  FILE_SELECTION_PROVEN:true,
  PROGRAMMER_TWIN_PARITY_PROVEN:true,
  ADVERSARIAL_FALSIFICATION_COMPLETE:true,
  NO_VALID_COUNTEREXAMPLE:true,
  SANDBOX_SIMULATION_PASSED:true,
  DIFFERENTIAL_CHECK_PASSED:true,
  PATCH_CORRECTNESS_PROVEN:true,
  REGRESSION_COUNTEREXAMPLES_EXHAUSTED:true,
  NO_SCOPE_VIOLATION:true,
  NO_TEST_MUTATION:true,
  NO_CONTROL_PLANE_MUTATION:true,
  NO_MAIN_MUTATION:true,
  NO_GATE_WEAKENING:true,
};
const verifierProof = {
  status:'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE',
  challengeId:'challenge-1',
  verifierAgent:'actionRepairVerifier',
  targetSha:targetSHA,
  failureFingerprint:'action-repair-test',
  alternativeHypotheses:[{id:'alt-1',basis:'independent-cause'}],
  falsificationChecks:[{id:'f-1',command:'echo falsify'}],
  counterEvidence:{rejectedHypothesis:'alt-1',evidenceRef:'test',noCounterexampleIsNotPatchCorrect:true},
  mutationRecommendation:'ALLOW_AFTER_FALSIFICATION_NO_COUNTEREXAMPLE',
  role:'ADVERSARIAL_PROGRAMMER_FALSIFIER',
  challengeMode:'FALSIFY_PRIMARY',
  programmerTwinParity:{intelligenceParity:'EXACT',authorityParity:'SEPARATED_BY_DESIGN',targetSha:targetSHA,failureFingerprint:'action-repair-test'},
  primaryCorrectnessProof:{objective:'PROVE_PRIMARY_REPAIR_CORRECT',status:'PRIMARY_CORRECTNESS_PROVEN'},
  cognitiveAwareness:{protocol:'ACTION-SYSTEM-COGNITIVE-AWARENESS-v1',systemWide:true,targetSha:targetSHA,failureFingerprint:'action-repair-test'},
  falsificationComplete:true,
  counterexampleFound:false,
  falsificationSearches:Array.from({length:10},()=>({})),
  remainingRisks:['canonical-ci'],
  proofCompleteness:completeProof,
  preMutationProof:{status:'PROVEN',targetSha:targetSHA,failureFingerprint:'action-repair-test'},
};
const verified=validateActionVaultVerifierProof({proof:verifierProof,targetSHA,failureFingerprint:'action-repair-test'});
assert.equal(verified.verified,true);
assert.equal(verified.mutationRecommendation,'ALLOW_AFTER_FALSIFICATION_NO_COUNTEREXAMPLE');
assert.equal(verified.remainingRiskCount,1);
assert.equal(verified.proofCompleteness.NO_VALID_COUNTEREXAMPLE,true);
assert.throws(()=>validateActionVaultVerifierProof({proof:{...verifierProof,targetSha:'b'.repeat(40)},targetSHA,failureFingerprint:'action-repair-test'}),/SHA_MISMATCH/);
assert.throws(()=>validateActionVaultVerifierProof({proof:{...verifierProof,alternativeHypotheses:[]},targetSHA,failureFingerprint:'action-repair-test'}),/ALTERNATIVES_MISSING/);
assert.throws(()=>validateActionVaultVerifierProof({proof:{...verifierProof,role:'OLD_PREDICTOR'},targetSHA,failureFingerprint:'action-repair-test'}),/ADVERSARIAL_FALSIFIER_ROLE_INVALID/);
assert.throws(()=>validateActionVaultVerifierProof({proof:{...verifierProof,cognitiveAwareness:{protocol:'OTHER',systemWide:true}},targetSHA,failureFingerprint:'action-repair-test'}),/COGNITIVE_AWARENESS_INVALID/);
assert.throws(()=>validateActionVaultVerifierProof({proof:{...verifierProof,programmerTwinParity:{intelligenceParity:'MISMATCH',authorityParity:'SEPARATED_BY_DESIGN'}},targetSHA,failureFingerprint:'action-repair-test'}),/PROGRAMMER_TWIN_PARITY_INVALID/);
const vaultMutationSession={
  ...actionRepairSession,
  state:'FAILURE_CAPTURED',
  actionVaultMission:{role:'ACTION-REPAIR',triadId:'triad-1',messageId:'msg-1',taskId:'task-1',failureFingerprint:'action-repair-test',entrySha:targetSHA,targetSha:targetSHA,ownerAgent:'actionRepairBot',verifierAgent:'actionRepairVerifier',historianAgent:'actionHistorian',programmerTwinParity:{intelligenceParity:'EXACT',authorityParity:'SEPARATED_BY_DESIGN',targetSha},cognitiveAwareness:{protocol:'ACTION-SYSTEM-COGNITIVE-AWARENESS-v1',targetSha,complete:true},proofObligations:['proof'],stopConditions:['GREEN'],noBlindRetry:true},
  actionVaultVerifierProof:verifierProof,
};
assert.equal(assertAgentAdmission({actor:'actionRepairBot',branch:'execution',mutation:true,session:vaultMutationSession}).admitted,true);
assert.throws(()=>assertAgentAdmission({actor:'actionRepairBot',branch:'execution',mutation:true,session:{...vaultMutationSession,actionVaultVerifierProof:{...verifierProof,status:'CHALLENGE_FAILED'}}}),/CHALLENGE_FAILED/);

assert.equal(assertAgentAdmission({actor:'actionRepairBot',branch:'execution',mutation:false}).admitted,true);
const actionCaptured=captureFailure(actionRepairSession,{runId:'action-test-run'});
assert.equal(authorizeMutation(actionCaptured).state,'MUTATION_AUTHORIZED');
const fallbackSession={protocolId:REPAIR_PROTOCOL.protocolId,protocolVersion:REPAIR_PROTOCOL.protocolVersion,protocolHash:REPAIR_PROTOCOL_HASH,state:'FAILURE_CAPTURED',targetSHA,fallback:{actor:'assistantRepairAgent',primaryAgentsUnavailable:true,learnedRule:'known-rule',learnedRuleConfidence:0.95,learnedRuleSupport:2,targetSha:targetSHA}};
assert.equal(assertAgentAdmission({actor:'assistantRepairAgent',branch:'execution',mutation:true,session:fallbackSession}).admitted,true);
assert.throws(()=>assertAgentAdmission({actor:'assistantRepairAgent',branch:'execution',mutation:true,session:{...fallbackSession,fallback:{...fallbackSession.fallback,primaryAgentsUnavailable:false}}}),/FALLBACK_PRIMARY_AGENT_AVAILABLE/);
assert.throws(()=>assertAgentAdmission({actor:'assistantRepairAgent',branch:'execution',mutation:true,session:{...fallbackSession,fallback:{...fallbackSession.fallback,learnedRuleConfidence:0.89}}}),/FALLBACK_LEARNING_THRESHOLD/);

const created=createRepairSession({repairSessionId:'test-session',actor:'repairAgent',failureFingerprint:'failure-test',targetSHA,beforeState:{worktree:'clean'}});
assert.equal(created.state,'PROTOCOL_VALIDATED');
const captured=captureFailure(created,{runId:'test-run'});
assert.equal(captured.state,'FAILURE_CAPTURED');
const authorized=authorizeMutation(captured);
assert.equal(authorized.state,'MUTATION_AUTHORIZED');
const completed=completeRepairSession(authorized,{retestResult:true,resumePoint:'REMAINING_REQUIRED_TESTS',finalVerification:{targetedRetest:true,recurrence:true,regression:true,exactSHA:true}});
assert.equal(completed.state,'COMMIT_PENDING');

const evidence={repairProtocol:completed};
assert.equal(validateCommitBoundary({evidence,branch:'execution',headSHA:targetSHA,changedPaths:['src/example.ts']}).oneCommitOnly,true);
assert.throws(()=>validateCommitBoundary({evidence,branch:'execution',headSHA:targetSHA,changedPaths:['scripts/ci/repair-protocol.mjs']}),/SELF_MUTATION_BLOCKED/);
assert.throws(()=>validateCommitBoundary({evidence,branch:'main',headSHA:targetSHA,changedPaths:['src/example.ts']}),/COMMIT_BRANCH_BLOCKED/);

const committed=validatePostCommitBoundary({evidence,branch:'execution',parentSHA:targetSHA,executionSHA:'b'.repeat(40),commitCount:1});
assert.equal(committed.state,'COMMITTED');
assert.equal(committed.commitCount,1);
assert.equal(committed.finalSHA,'b'.repeat(40));
assert.throws(()=>validatePostCommitBoundary({evidence,branch:'execution',parentSHA:targetSHA,executionSHA:'b'.repeat(40),commitCount:2}),/EXPECTS_ONE_COMMIT/);
console.log('REPAIR_PROTOCOL_TEST=PASS');
