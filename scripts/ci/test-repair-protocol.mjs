#!/usr/bin/env node
import assert from 'node:assert/strict';
import {REPAIR_PROTOCOL,REPAIR_PROTOCOL_HASH,assertProtocolDefinition,assertAgentAdmission,createRepairSession,captureFailure,authorizeMutation,completeRepairSession,validateCommitBoundary,validatePostCommitBoundary,validateErrorOnlyMutation} from './repair-protocol.mjs';

const definition=assertProtocolDefinition();
assert.equal(definition.protocolId,'REPAIR_PROTOCOL');
assert.equal(definition.protocolVersion,'1.0.0');
assert.equal(definition.protocolHash,REPAIR_PROTOCOL_HASH);
assert.equal(REPAIR_PROTOCOL.commitPolicy,'ONE_COMMIT_PER_COMPLETED_REPAIR_SESSION');
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
  {mode:'ERROR_ONLY',failureLocation:'src/failure.ts',selectedFile:'src/failure.ts',changedPaths:['src/failure.ts'],testMutation:false},
);
assert.throws(()=>assertAgentAdmission({actor:'unknownFutureAgent'}),/UNKNOWN_AGENT/);
assert.throws(()=>assertAgentAdmission({actor:'diagnosticAgent',branch:'execution',mutation:true}),/MUTATION_ROLE_BLOCKED/);
assert.throws(()=>assertAgentAdmission({actor:'taskAgent',branch:'execution',mutation:true}),/MUTATION_ROLE_BLOCKED/);
assert.throws(()=>assertAgentAdmission({actor:'implementation',branch:'execution',mutation:true}),/MUTATION_ROLE_BLOCKED/);
const targetSHA='a'.repeat(40);
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
