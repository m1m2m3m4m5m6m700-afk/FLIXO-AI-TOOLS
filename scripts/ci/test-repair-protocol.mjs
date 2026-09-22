#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {REPAIR_PROTOCOL,REPAIR_PROTOCOL_HASH,assertProtocolDefinition,assertAgentAdmission,createRepairSession,captureFailure,authorizeMutation,completeRepairSession,validateActionVaultVerifierProof,validateActionVaultPreMutationProofs,validateCommitBoundary,validatePostCommitBoundary,validateErrorOnlyMutation,validateMinimalRepairScope,validateTargetedRegressionSelection} from './repair-protocol.mjs';

const definition=assertProtocolDefinition();
assert.equal(definition.protocolId,'REPAIR_PROTOCOL');
assert.equal(definition.protocolVersion,'1.0.0');
assert.equal(definition.protocolHash,REPAIR_PROTOCOL_HASH);
assert.equal(REPAIR_PROTOCOL.commitPolicy,'ONE_COMMIT_PER_COMPLETED_REPAIR_SESSION');
assert.equal(REPAIR_PROTOCOL.mutationScope,'ERROR_ONLY');
assert.equal(REPAIR_PROTOCOL.cellLabRequired,true);
assert.equal(REPAIR_PROTOCOL.cellLabConsensusPath,'diagnostics/agents/cell-lab/consensus/<taskId>.json');
const targetSHA='a'.repeat(40);
const chairBinding = {
  required:true,
  chairId:'chair_1',
  leaseId:'a'.repeat(64),
  fencingHash:'b'.repeat(64),
  holderAgentId:'AUTO_REPAIR_BOT',
  taskId:'repair-test-task',
  workPackageId:'repair-test-work-package',
  targetSha:targetSHA,
  centralVerified:true,
  released:false
};
assert.throws(()=>assertAgentAdmission({actor:'repairAgent',branch:'execution',mutation:true,session:{state:'FAILURE_CAPTURED',protocolId:REPAIR_PROTOCOL.protocolId,protocolVersion:REPAIR_PROTOCOL.protocolVersion,protocolHash:REPAIR_PROTOCOL_HASH,targetSHA,taskId:'missing-lab'}}),/REPAIR_PROTOCOL_CHAIR_REQUIRED/);

const cellLabMutationSession = (consensus) => ({
  state:'FAILURE_CAPTURED',
  protocolId:REPAIR_PROTOCOL.protocolId,
  protocolVersion:REPAIR_PROTOCOL.protocolVersion,
  protocolHash:REPAIR_PROTOCOL_HASH,
  targetSHA,
  taskId:'repair-test-cell-lab-errors',
  chairBinding,
  cellLabConsensus:consensus,
});

const cellLabConsensus = (taskId, owner) => ({
  protocolId:'CELL-LAB-COLLABORATIVE-CONSENSUS',
  protocolVersion:'1.0.0',
  labId:'CELL-LAB-TEST-001',
  taskId,
  exactSha:targetSHA,
  objective:'Test shared-cell decision process.',
  integratedPlan:'Discuss → challenge → synthesize → agree → execute → verify.',
  planHash:crypto.createHash('sha256').update('Discuss → challenge → synthesize → agree → execute → verify.','utf8').digest('hex'),
  status:'AGREED',
  executionReady:true,
  discussionClosed:true,
  communicationEvidence:{channel:'CANONICAL_AGENT_COMMUNICATION',messageIds:['m1','m2','m3','m4','r1','r2','r3','r4']},
  participants:[
    {id:'MASTER-1',status:'AGREED',basis:'Orchestration reviewed.'},
    {id:'MASTER-2',status:'AGREED',basis:'Verification reviewed.'},
    {id:'MASTER-3',status:'AGREED',basis:'RCA reviewed.'},
    {id:owner,status:'AGREED',basis:'Execution scope accepted.'},
  ],
  discussions:[
    {kind:'OPINION',actor:'MASTER-1',messageId:'m1',text:'Use the smallest causal repair.',responses:['MASTER-2','MASTER-3'],responseMessageIds:['r1','r2'],resolution:'Integrated.'},
    {kind:'QUESTION',actor:owner,messageId:'m2',text:'Is the scope bounded?',responses:['MASTER-2'],responseMessageIds:['r3'],resolution:'Yes.',status:'ANSWERED'},
    {kind:'CHALLENGE',actor:'MASTER-3',messageId:'m3',text:'Could another cause explain the symptom?',responses:['MASTER-1','MASTER-2'],responseMessageIds:['r1','r3'],resolution:'Alternatives rejected by evidence.'},
    {kind:'DECISION',actor:'MASTER-1',messageId:'m4',text:'Proceed with the integrated plan.',responses:['MASTER-2','MASTER-3',owner],responseMessageIds:['r1','r3','r4'],resolution:'All required participants agreed.',status:'AGREED'},
  ],
  dissentResolved:[],
  remainingQuestions:[],
  unresolvedConflicts:[],
  proofObligations:['TARGETED_REGRESSION','EXACT_SHA_VERIFY'],
  stopConditions:['SHA_DRIFT','UNSAFE_SCOPE','CONFLICT'],
});

const exactShaMismatchConsensus = {...cellLabConsensus('repair-test-cell-lab-errors','repairAgent'), exactSha:'b'.repeat(40)};
assert.throws(
  () => assertAgentAdmission({actor:'repairAgent',branch:'execution',mutation:true,session:cellLabMutationSession(exactShaMismatchConsensus)}),
  /CELL_LAB_EXACT_SHA_MISMATCH/,
);
const planHashMismatchConsensus = {...cellLabConsensus('repair-test-cell-lab-errors','repairAgent'), planHash:'0'.repeat(64)};
assert.throws(
  () => assertAgentAdmission({actor:'repairAgent',branch:'execution',mutation:true,session:cellLabMutationSession(planHashMismatchConsensus)}),
  /CELL_LAB_PLAN_HASH_MISMATCH/,
);


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
const priorAutoRepairContext = process.env.FLIXO_AUTO_REPAIR_CONTEXT;
process.env.FLIXO_AUTO_REPAIR_CONTEXT = 'true';
try {
  assert.throws(() => assertAgentAdmission({
    actor:'actionRepairBot',
    branch:'execution',
    mutation:true,
    session:{state:'FAILURE_CAPTURED',protocolId:REPAIR_PROTOCOL.protocolId,protocolVersion:REPAIR_PROTOCOL.protocolVersion,protocolHash:REPAIR_PROTOCOL_HASH,targetSHA,taskId:'auto-repair-no-bypass'}
  }),/REPAIR_PROTOCOL_CHAIR_REQUIRED/);
} finally {
  if (priorAutoRepairContext === undefined) delete process.env.FLIXO_AUTO_REPAIR_CONTEXT;
  else process.env.FLIXO_AUTO_REPAIR_CONTEXT = priorAutoRepairContext;
}
assert.throws(() => assertAgentAdmission({
  actor:'repairAgent',
  branch:'execution',
  mutation:true,
  session:{state:'FAILURE_CAPTURED',protocolId:REPAIR_PROTOCOL.protocolId,protocolVersion:REPAIR_PROTOCOL.protocolVersion,protocolHash:REPAIR_PROTOCOL_HASH,targetSHA,taskId:'auto-repair-no-chair',cellLabConsensus:cellLabConsensus('auto-repair-no-chair','repairAgent')}
}),/REPAIR_PROTOCOL_CHAIR_REQUIRED/);
assert.throws(()=>assertAgentAdmission({actor:'actionHistorian',branch:'execution',mutation:true,session:{state:'FAILURE_CAPTURED',taskId:'repair-test-task-historian-fail',protocolId:REPAIR_PROTOCOL.protocolId,protocolVersion:REPAIR_PROTOCOL.protocolVersion,protocolHash:REPAIR_PROTOCOL_HASH,targetSHA,chairBinding,cellLabConsensus:cellLabConsensus('repair-test-task-historian-fail','actionHistorian')}}),/SUPERVISOR_MODE_REQUIRED/);
assert.equal(assertAgentAdmission({
  actor:'actionRepairVerifier', branch:'execution', mutation:true,
  session:{state:'FAILURE_CAPTURED',taskId:'repair-test-task',protocolId:REPAIR_PROTOCOL.protocolId,protocolVersion:REPAIR_PROTOCOL.protocolVersion,protocolHash:REPAIR_PROTOCOL_HASH,targetSHA,chairBinding,cellLabConsensus:cellLabConsensus('repair-test-task','actionRepairVerifier'),
    actionVaultMission:{role:'ACTION-REPAIR-2',mutationSeat:'ACTION-REPAIR-2',supervisorMode:'NORMAL_TRIAD',entrySha:targetSHA,targetSha:targetSHA,candidateRepairApproved:true}}
}).admitted,true);
assert.equal(assertAgentAdmission({
  actor:'actionHistorian', branch:'execution', mutation:true,
  session:{state:'FAILURE_CAPTURED',taskId:'repair-test-task-historian',protocolId:REPAIR_PROTOCOL.protocolId,protocolVersion:REPAIR_PROTOCOL.protocolVersion,protocolHash:REPAIR_PROTOCOL_HASH,targetSHA,chairBinding,cellLabConsensus:cellLabConsensus('repair-test-task-historian','actionHistorian'),
    actionVaultMission:{role:'ACTION-HISTORIAN-3',mutationSeat:'ACTION-HISTORIAN-3',supervisorMode:'SUPERVISOR_20',entrySha:targetSHA,targetSha:targetSHA,catalogReviewed:true,bothProgrammingProposalsReviewed:true,supervisorDecision:true}}
}).admitted,true);
const actionRepairSession=createRepairSession({repairSessionId:'action-repair-session',actor:'actionRepairBot',failureFingerprint:'action-repair-test',targetSHA,beforeState:{worktree:'clean'}});
assert.equal(actionRepairSession.actor,'actionRepairBot');
const completeProof={
  COGNITIVE_AWARENESS_PROVEN:true,
  CAUSAL_EVIDENCE_GRAPH_PROVEN:true,
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
  remainingRisks:[],
  proofCompleteness:completeProof,
  preMutationProof:{status:'PROVEN',targetSha:targetSHA,failureFingerprint:'action-repair-test'},
};
const verified=validateActionVaultVerifierProof({proof:verifierProof,targetSHA,failureFingerprint:'action-repair-test'});
assert.equal(verified.verified,true);
assert.equal(verified.mutationRecommendation,'ALLOW_AFTER_FALSIFICATION_NO_COUNTEREXAMPLE');
assert.equal(verified.remainingRiskCount,0);
assert.equal(verified.proofCompleteness.NO_VALID_COUNTEREXAMPLE,true);
assert.throws(()=>validateActionVaultVerifierProof({proof:{...verifierProof,targetSha:'b'.repeat(40)},targetSHA,failureFingerprint:'action-repair-test'}),/SHA_MISMATCH/);
assert.throws(()=>validateActionVaultVerifierProof({proof:{...verifierProof,alternativeHypotheses:[]},targetSHA,failureFingerprint:'action-repair-test'}),/ALTERNATIVES_MISSING/);
assert.throws(()=>validateActionVaultVerifierProof({proof:{...verifierProof,role:'OLD_PREDICTOR'},targetSHA,failureFingerprint:'action-repair-test'}),/ADVERSARIAL_FALSIFIER_ROLE_INVALID/);
assert.throws(()=>validateActionVaultVerifierProof({proof:{...verifierProof,cognitiveAwareness:{protocol:'OTHER',systemWide:true}},targetSHA,failureFingerprint:'action-repair-test'}),/COGNITIVE_AWARENESS_INVALID/);
assert.throws(()=>validateActionVaultVerifierProof({proof:{...verifierProof,programmerTwinParity:{intelligenceParity:'MISMATCH',authorityParity:'SEPARATED_BY_DESIGN'}},targetSHA,failureFingerprint:'action-repair-test'}),/PROGRAMMER_TWIN_PARITY_INVALID/);
const vaultMutationSession={
  ...actionRepairSession,
  chairBinding,
  state:'FAILURE_CAPTURED',
  actionVaultMission:{role:'ACTION-REPAIR',triadId:'triad-1',messageId:'msg-1',taskId:'task-1',failureFingerprint:'action-repair-test',entrySha:targetSHA,targetSha:targetSHA,ownerAgent:'actionRepairBot',verifierAgent:'actionRepairVerifier',historianAgent:'actionHistorian',programmerTwinParity:{intelligenceParity:'EXACT',authorityParity:'SEPARATED_BY_DESIGN',targetSha:targetSHA},cognitiveAwareness:{protocol:'ACTION-SYSTEM-COGNITIVE-AWARENESS-v1',targetSha:targetSHA,complete:true},sandboxProof:{protocol:'REPAIR_SANDBOX_SIMULATION_V1',status:'PASS',targetSha:targetSHA,failureFingerprint:'action-repair-test',exactShaBound:true,mutationPerformed:false,patchDigest:'digest',regressionCounterexamples:{targetSha:targetSHA,failureFingerprint:'action-repair-test',exhausted:true,counterexampleFound:false}},differentialProof:{protocol:'DIFFERENTIAL_REPAIR_VERIFICATION_V1',status:'PASS',targetSha:targetSHA,executionEvidence:{required:true,receiptCount:1}},patchCorrectnessProof:{status:'PROVEN',targetSha:targetSHA,patchDigest:'digest',mutationPerformed:false,differentialStatus:'PASS'},proofObligations:['proof'],stopConditions:['GREEN'],noBlindRetry:true,diagnosisKnowledgeReview:{protocol:'ACTION-VAULT-DIAGNOSIS-KNOWLEDGE-REVIEW-v1',reviewer:'ACTION-HISTORIAN-3',decision:'MATCH',allowSourceMutation:true,targetSha:targetSHA,fingerprint:'action-repair-test',diagnosisDigest:'a'.repeat(64)},catalogReview:{status:'REVIEWED',reviewer:'ACTION-HISTORIAN-3',beforeMutation:true,mutationAuthority:false,targetSha:targetSHA,fingerprint:'action-repair-test',source:{indexId:'ACTION-INDEX-4000',declaredCapacity:1000000,actualRecordCount:1},digest:'b'.repeat(64)}},
  actionVaultVerifierProof:verifierProof,
  cellLabConsensus:cellLabConsensus('task-1','actionRepairBot'),
};
assert.equal(validateActionVaultPreMutationProofs({sandboxProof:vaultMutationSession.actionVaultMission.sandboxProof,differentialProof:vaultMutationSession.actionVaultMission.differentialProof,patchCorrectnessProof:vaultMutationSession.actionVaultMission.patchCorrectnessProof,regressionCounterexamples:{targetSha:targetSHA,failureFingerprint:'action-repair-test',exhausted:true,counterexampleFound:false},targetSHA,failureFingerprint:'action-repair-test'}).verified,true);
assert.equal(assertAgentAdmission({actor:'actionRepairBot',branch:'execution',mutation:true,session:vaultMutationSession}).admitted,true);
assert.throws(()=>assertAgentAdmission({actor:'actionRepairBot',branch:'execution',mutation:true,session:{...vaultMutationSession,actionVaultVerifierProof:{...verifierProof,status:'CHALLENGE_FAILED'}}}),/CHALLENGE_FAILED/);

assert.equal(assertAgentAdmission({actor:'actionRepairBot',branch:'execution',mutation:false}).admitted,true);
const actionCaptured={...captureFailure(actionRepairSession,{runId:'action-test-run'}),chairBinding};
assert.equal(authorizeMutation(actionCaptured).state,'MUTATION_AUTHORIZED');
const fallbackSession={protocolId:REPAIR_PROTOCOL.protocolId,protocolVersion:REPAIR_PROTOCOL.protocolVersion,protocolHash:REPAIR_PROTOCOL_HASH,state:'FAILURE_CAPTURED',taskId:'fallback-task',targetSHA,chairBinding,cellLabConsensus:cellLabConsensus('fallback-task','assistantRepairAgent'),fallback:{actor:'assistantRepairAgent',primaryAgentsUnavailable:true,learnedRule:'known-rule',learnedRuleConfidence:0.95,learnedRuleSupport:2,targetSha:targetSHA}};
assert.equal(assertAgentAdmission({actor:'assistantRepairAgent',branch:'execution',mutation:true,session:fallbackSession}).admitted,true);
assert.throws(()=>assertAgentAdmission({actor:'assistantRepairAgent',branch:'execution',mutation:true,session:{...fallbackSession,fallback:{...fallbackSession.fallback,primaryAgentsUnavailable:false}}}),/FALLBACK_PRIMARY_AGENT_AVAILABLE/);
assert.throws(()=>assertAgentAdmission({actor:'assistantRepairAgent',branch:'execution',mutation:true,session:{...fallbackSession,fallback:{...fallbackSession.fallback,learnedRuleConfidence:0.89}}}),/FALLBACK_LEARNING_THRESHOLD/);

const created=createRepairSession({repairSessionId:'test-session',actor:'repairAgent',failureFingerprint:'failure-test',targetSHA,beforeState:{worktree:'clean'}});
assert.equal(created.state,'PROTOCOL_VALIDATED');
const captured=captureFailure(created,{runId:'test-run'});
assert.equal(captured.state,'FAILURE_CAPTURED');
const authorized=authorizeMutation({...captured,chairBinding});
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
