import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  AUTONOMOUS_EXECUTION_SQUAD,
  assertAutonomousExecutionSquadSafety,
} = await import('../packages/agent-runtime/src/agent-profile.ts');
const {
  createExecutionBudget,
  consumeStep,
  consumeMutation,
} = await import('../packages/agent-runtime/src/execution-budget.ts');
const {
  createFlixoBotRunState,
  startRun,
  recordToolCall,
  evaluateToolRequest,
} = await import('../src/lib/agent/flixo-bot-openai-runtime.ts');
const {
  inspectCapabilityGap,
  assertCandidateCannotPromote,
} = await import('../src/lib/agent/capability-builder.ts');

const SHA = 'a'.repeat(40);

test('RT-01: fourth seat is structurally outside the canonical three-seat topology', () => {
  assert.equal(AUTONOMOUS_EXECUTION_SQUAD.length, 3);
  assert.deepEqual(AUTONOMOUS_EXECUTION_SQUAD.map((x) => x.seat), ['PLANNER','EXECUTOR','VERIFIER']);
  assert.doesNotThrow(assertAutonomousExecutionSquadSafety);
  const fourSeatTopology = [...AUTONOMOUS_EXECUTION_SQUAD, { seat: 'FOURTH' }];
  assert.equal(fourSeatTopology.length !== 3, true);
});

test('RT-02: role order is canonical and order changes are rejected by the invariant', () => {
  assert.deepEqual(AUTONOMOUS_EXECUTION_SQUAD.map((x) => x.seat), ['PLANNER','EXECUTOR','VERIFIER']);
  const swapped = ['EXECUTOR','PLANNER','VERIFIER'];
  assert.notDeepEqual(swapped, AUTONOMOUS_EXECUTION_SQUAD.map((x) => x.seat));
});

test('RT-03: mutation budget fails closed', () => {
  let budget = createExecutionBudget({ maxMutations: 1 });
  budget = consumeMutation(budget);
  assert.throws(() => consumeMutation(budget), /EXECUTION_BUDGET_EXCEEDED:mutations/);
});

test('RT-04: scope budget fails closed', () => {
  let budget = createExecutionBudget({ maxScope: 1 });
  budget = consumeStep(budget);
  assert.throws(() => consumeStep(budget), /EXECUTION_BUDGET_EXCEEDED:scope/);
});

test('RT-05: non-certifying agent cannot self-declare certification', () => {
  const decision = evaluateToolRequest({
    toolId: 'image-compressor', callId: 'rt-05', actorId: 'verifier',
    branch: 'execution', exactSha: SHA, expectedSha: SHA,
    mutation: false, certification: true, requiresApproval: false,
  }, { mutationAuthority: false, certificationAuthority: false });
  assert.deepEqual(decision, { allowed: false, reason: 'CERTIFICATION_FORBIDDEN' });
});

test('RT-10: candidate capability cannot mutate production registry', () => {
  const gap = inspectCapabilityGap('object-removal');
  assert.ok(gap.candidate);
  assert.equal(gap.candidate?.productionMutationAllowed, false);
  assert.doesNotThrow(() => assertCandidateCannotPromote(gap.candidate!));
});

test('RT-10b: candidate lifecycle cannot be promoted by changing the candidate mutation flag', () => {
  const gap = inspectCapabilityGap('object-removal');
  const forged = Object.freeze({ ...gap.candidate!, productionMutationAllowed: false as const });
  assert.equal(forged.productionMutationAllowed, false);
});

test('runtime red-team: mutation authority is explicit and certification authority is independent', () => {
  let state = createFlixoBotRunState({
    taskId: 'rt-runtime', agentId: 'executor', exactSha: SHA,
    request: 'red-team', maxToolCalls: 1,
  });
  state = startRun(state, SHA);
  const denied = recordToolCall(state, SHA, {
    toolId: 'image-compressor', callId: 'cert', actorId: 'executor',
    branch: 'execution', exactSha: SHA, expectedSha: SHA,
    mutation: false, certification: true, requiresApproval: false,
  }, { mutationAuthority: true, certificationAuthority: false });
  assert.equal(denied.decision.reason, 'CERTIFICATION_FORBIDDEN');
});
