/**
 * FLIXO BOT — isolated OpenAI-derived runtime substrate.
 *
 * Selected patterns from the supplied OpenAI Agents reference:
 * durable run state, explicit next steps, tool boundaries, bounded retries,
 * Agent-as-tool delegation, and trace spans.
 *
 * This file deliberately does not create a second planner, registry, memory
 * store, event store, governance plane, mutation owner, or certification owner.
 */

export const FLIXO_BOT_OPENAI_RUNTIME_PROTOCOL = 'FLIXO-BOT-OPENAI-RUNTIME-v1' as const;
export const FLIXO_BOT_OPENAI_RUNTIME_SCHEMA_VERSION = '1.1' as const;
export const FLIXO_BOT_CANONICAL_BRANCH = 'execution' as const;

export type FlixoBotRunStatus =
  | 'CREATED' | 'RUNNING' | 'WAITING_APPROVAL' | 'RETRYING'
  | 'SUCCEEDED' | 'FAILED' | 'STALE' | 'CANCELLED' | 'BLOCKED';

export type FlixoBotNextStep =
  | Readonly<{ type: 'RUN_AGAIN'; reason: string }>
  | Readonly<{ type: 'HANDOFF'; targetAgentId: string; reason: string }>
  | Readonly<{ type: 'FINAL'; output: unknown }>
  | Readonly<{ type: 'INTERRUPTION'; reason: string; requiresApproval: boolean }>;

export type FlixoBotRunEvent = Readonly<{
  seq: number;
  type:
    | 'RUN_CREATED' | 'MODEL_TURN' | 'TOOL_CALL' | 'TOOL_RESULT'
    | 'GUARDRAIL_REJECT' | 'RETRY_SCHEDULED' | 'HANDOFF'
    | 'APPROVAL_REQUIRED' | 'APPROVAL_ACCEPTED' | 'INTERRUPTION' | 'FINAL_OUTPUT'
    | 'RUN_FAILED' | 'RUN_CANCELLED' | 'RUN_STALE';
  at: string;
  exactSha: string;
  actorId: string;
  detail?: Readonly<Record<string, unknown>>;
}>;

export type FlixoBotRunState<TContext = unknown> = Readonly<{
  schemaVersion: typeof FLIXO_BOT_OPENAI_RUNTIME_SCHEMA_VERSION;
  protocol: typeof FLIXO_BOT_OPENAI_RUNTIME_PROTOCOL;
  runId: string;
  taskId: string;
  agentId: string;
  branch: typeof FLIXO_BOT_CANONICAL_BRANCH;
  exactSha: string;
  status: FlixoBotRunStatus;
  stepIndex: number;
  turnCount: number;
  retryCount: number;
  maxTurns: number;
  maxRetries: number;
  maxToolCalls: number;
  toolCallCount: number;
  currentOwner: string;
  traceId: string;
  inputDigest: string;
  context: TContext | null;
  pendingApproval: Readonly<{ toolId: string; callId: string; reason: string; approvalId: string }> | null;
  lastError: string | null;
  lastOutput: unknown | null;
  events: readonly FlixoBotRunEvent[];
}>;

export type FlixoBotToolRequest = Readonly<{
  toolId: string;
  callId: string;
  actorId: string;
  branch: string;
  exactSha: string;
  expectedSha: string;
  mutation: boolean;
  certification: boolean;
  requiresApproval: boolean;
}>;

export type FlixoBotToolDecision = Readonly<{
  allowed: boolean;
  reason:
    | 'ALLOW' | 'INVALID_SHA' | 'STALE_SHA' | 'WRONG_WORK_PATH'
    | 'AUTHORITY_REQUIRED' | 'CERTIFICATION_FORBIDDEN' | 'APPROVAL_REQUIRED' | 'BUDGET_EXCEEDED' | 'OWNER_REQUIRED';
}>;

export type FlixoBotAuthority = Readonly<{
  mutationAuthority: boolean;
  certificationAuthority: boolean;
}>;

export type FlixoBotTraceSpan = Readonly<{
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  kind: 'RUN' | 'MODEL' | 'TOOL' | 'GUARDRAIL' | 'HANDOFF' | 'VERIFICATION';
  name: string;
  startedAt: string;
  endedAt: string | null;
  attributes: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type FlixoBotTrace = Readonly<{
  traceId: string;
  spans: readonly FlixoBotTraceSpan[];
}>;

export type CreateRunInput<TContext = unknown> = Readonly<{
  runId?: string;
  taskId: string;
  agentId: string;
  exactSha: string;
  branch?: string;
  request: string;
  context?: TContext | null;
  maxTurns?: number;
  maxRetries?: number;
  maxToolCalls?: number;
}>;

let sequence = 0;
const id = (prefix: string) => prefix + '_' + Date.now().toString(36) + '_' + (++sequence).toString(36);
const now = () => new Date().toISOString();

function required(value: string, name: string): string {
  const v = String(value ?? '').trim();
  if (!v) throw new Error(name + '_REQUIRED');
  return v;
}

export function assertExactSha(value: string, label = 'EXACT_SHA'): string {
  const sha = required(value, label);
  if (!/^[a-f0-9]{40}$/u.test(sha)) throw new Error(label + '_INVALID');
  return sha;
}

export function assertCanonicalExecutionBranch(
  branch: string,
): asserts branch is typeof FLIXO_BOT_CANONICAL_BRANCH {
  if (branch !== FLIXO_BOT_CANONICAL_BRANCH) throw new Error('FLIXO_BOT_NON_CANONICAL_WORK_PATH');
}

function bounded(value: number | undefined, fallback: number, min: number, max: number, name: string): number {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(name + '_INVALID');
  return n;
}

function digest(value: string): string {
  let h = 2166136261;
  for (const c of value) {
    h ^= c.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function append<TContext>(
  state: FlixoBotRunState<TContext>,
  event: Omit<FlixoBotRunEvent, 'seq' | 'at' | 'exactSha'>,
): FlixoBotRunState<TContext> {
  const next: FlixoBotRunEvent = Object.freeze({
    ...event,
    seq: state.events.length + 1,
    at: now(),
    exactSha: state.exactSha,
  });
  return Object.freeze({ ...state, events: Object.freeze([...state.events, next]) });
}

function withStatus<TContext>(
  state: FlixoBotRunState<TContext>,
  nextStatus: FlixoBotRunStatus,
  event: Omit<FlixoBotRunEvent, 'seq' | 'at' | 'exactSha'>,
): FlixoBotRunState<TContext> {
  return append(Object.freeze({ ...state, status: nextStatus }), event);
}

export function createFlixoBotRunState<TContext = unknown>(
  input: CreateRunInput<TContext>,
): FlixoBotRunState<TContext> {
  assertCanonicalExecutionBranch(input.branch ?? FLIXO_BOT_CANONICAL_BRANCH);
  const taskId = required(input.taskId, 'TASK_ID');
  const agentId = required(input.agentId, 'AGENT_ID');
  const request = required(input.request, 'REQUEST');
  const exactSha = assertExactSha(input.exactSha);
  const state: FlixoBotRunState<TContext> = {
    schemaVersion: FLIXO_BOT_OPENAI_RUNTIME_SCHEMA_VERSION,
    protocol: FLIXO_BOT_OPENAI_RUNTIME_PROTOCOL,
    runId: required(input.runId ?? id('run'), 'RUN_ID'),
    taskId, agentId, branch: FLIXO_BOT_CANONICAL_BRANCH, exactSha,
    status: 'CREATED', stepIndex: 0, turnCount: 0, retryCount: 0,
    maxTurns: bounded(input.maxTurns, 24, 1, 128, 'MAX_TURNS'),
    maxRetries: bounded(input.maxRetries, 3, 0, 12, 'MAX_RETRIES'),
    maxToolCalls: bounded(input.maxToolCalls, 8, 1, 32, 'MAX_TOOL_CALLS'),
    toolCallCount: 0,
    currentOwner: agentId, traceId: id('trace'), inputDigest: digest(request),
    context: input.context ?? null, pendingApproval: null,
    lastError: null, lastOutput: null, events: [],
  };
  return append(state, {
    type: 'RUN_CREATED',
    actorId: agentId,
    detail: { taskId, requestDigest: state.inputDigest },
  });
}

export function assertCurrentRunSha(state: FlixoBotRunState, currentSha: string): void {
  if (state.status === 'STALE') throw new Error('FLIXO_BOT_RUN_ALREADY_STALE');
  const current = assertExactSha(currentSha, 'CURRENT_SHA');
  if (state.exactSha !== current) throw new Error('FLIXO_BOT_RUN_STALE_SHA');
}

export function startRun(state: FlixoBotRunState, currentSha: string): FlixoBotRunState {
  assertCurrentRunSha(state, currentSha);
  if (state.status !== 'CREATED') throw new Error('FLIXO_BOT_RUN_START_INVALID_STATE');
  return withStatus(
    Object.freeze({ ...state, turnCount: state.turnCount + 1 }),
    'RUNNING',
    { type: 'MODEL_TURN', actorId: state.currentOwner, detail: { phase: 'start' } },
  );
}

export function evaluateToolRequest(
  request: FlixoBotToolRequest,
  authority: FlixoBotAuthority,
): FlixoBotToolDecision {
  if (!/^[a-f0-9]{40}$/u.test(request.exactSha) || !/^[a-f0-9]{40}$/u.test(request.expectedSha)) {
    return { allowed: false, reason: 'INVALID_SHA' };
  }
  if (request.exactSha !== request.expectedSha) return { allowed: false, reason: 'STALE_SHA' };
  if (request.branch !== FLIXO_BOT_CANONICAL_BRANCH) return { allowed: false, reason: 'WRONG_WORK_PATH' };
  if (request.certification && !authority.certificationAuthority) {
    return { allowed: false, reason: 'CERTIFICATION_FORBIDDEN' };
  }
  if (request.mutation && !authority.mutationAuthority) {
    return { allowed: false, reason: 'AUTHORITY_REQUIRED' };
  }
  if (request.requiresApproval) return { allowed: false, reason: 'APPROVAL_REQUIRED' };
  return { allowed: true, reason: 'ALLOW' };
}

export function recordToolCall(
  state: FlixoBotRunState,
  currentSha: string,
  request: FlixoBotToolRequest,
  authority: FlixoBotAuthority,
): Readonly<{ state: FlixoBotRunState; decision: FlixoBotToolDecision }> {
  assertCurrentRunSha(state, currentSha);
  if (!['RUNNING', 'RETRYING'].includes(state.status)) throw new Error('FLIXO_BOT_TOOL_CALL_INVALID_STATE');
  if (request.actorId !== state.currentOwner) throw new Error('FLIXO_BOT_TOOL_OWNER_MISMATCH');  if (state.toolCallCount >= state.maxToolCalls) {
    const blockedState = withStatus(
      Object.freeze({ ...state, lastError: 'MAX_TOOL_CALLS_EXCEEDED' }),
      'BLOCKED',
      {
        type: 'GUARDRAIL_REJECT',
        actorId: request.actorId,
        detail: { toolId: request.toolId, callId: request.callId, reason: 'MAX_TOOL_CALLS_EXCEEDED' },
      },
    );
    return Object.freeze({
      state: blockedState,
      decision: { allowed: false, reason: 'BUDGET_EXCEEDED' },
    });
  }
  const decision = evaluateToolRequest(request, authority);
  if (!decision.allowed) {
    const approval = decision.reason === 'APPROVAL_REQUIRED';
    return Object.freeze({
      state: withStatus(
        Object.freeze({
          ...state,
          pendingApproval: approval
            ? { toolId: request.toolId, callId: request.callId, reason: decision.reason, approvalId: id('approval') }
            : null,
        }),
        approval ? 'WAITING_APPROVAL' : 'BLOCKED',
        {
          type: approval ? 'APPROVAL_REQUIRED' : 'GUARDRAIL_REJECT',
          actorId: request.actorId,
          detail: { toolId: request.toolId, callId: request.callId, reason: decision.reason },
        },
      ),
      decision,
    });
  }
  return Object.freeze({
    state: append(Object.freeze({ ...state, toolCallCount: state.toolCallCount + 1 }), {
      type: 'TOOL_CALL',
      actorId: request.actorId,
      detail: { toolId: request.toolId, callId: request.callId, mutation: request.mutation },
    }),
    decision,
  });
}

export type FlixoBotToolEvidence = Readonly<{
  inputSha256?: string;
  outputSha256?: string;
  verified?: boolean;
  receiptChainSha256?: string;
  executorId?: string;
  executionMode?: string;
  attempt?: number;
}>;

export function recordToolResult(
  state: FlixoBotRunState,
  currentSha: string,
  actorId: string,
  toolId: string,
  success: boolean,
  output?: unknown,
  evidence: FlixoBotToolEvidence = {},
): FlixoBotRunState {
  assertCurrentRunSha(state, currentSha);
  if (!['RUNNING', 'RETRYING'].includes(state.status)) throw new Error('FLIXO_BOT_TOOL_RESULT_INVALID_STATE');
  if (actorId !== state.currentOwner) throw new Error('FLIXO_BOT_TOOL_RESULT_OWNER_MISMATCH');  if (success && evidence.verified !== true) {
    throw new Error('FLIXO_BOT_TOOL_SUCCESS_REQUIRES_VERIFIED_EVIDENCE');
  }
  if (success && (!/^[a-f0-9]{64}$/u.test(String(evidence.inputSha256 ?? ''))
    || !/^[a-f0-9]{64}$/u.test(String(evidence.outputSha256 ?? ''))
    || !/^[a-f0-9]{64}$/u.test(String(evidence.receiptChainSha256 ?? '')))) {
    throw new Error('FLIXO_BOT_TOOL_SUCCESS_EVIDENCE_INCOMPLETE');
  }
  return append(
    Object.freeze({
      ...state,
      lastError: success ? null : 'TOOL_EXECUTION_FAILED',
      lastOutput: success ? (output ?? null) : null,
    }),
    {
      type: 'TOOL_RESULT',
      actorId,
      detail: {
        toolId,
        success,
        ...evidence,
      },
    },
  );
}

export function approveRun(
  state: FlixoBotRunState,
  currentSha: string,
  approvalId: string,
): FlixoBotRunState {
  assertCurrentRunSha(state, currentSha);
  if (state.status !== 'WAITING_APPROVAL' || !state.pendingApproval) {
    throw new Error('FLIXO_BOT_APPROVAL_INVALID_STATE');
  }
  const requestedApprovalId = required(approvalId, 'APPROVAL_ID');
  if (requestedApprovalId !== state.pendingApproval.approvalId) {
    throw new Error('FLIXO_BOT_APPROVAL_ID_MISMATCH');
  }

  return withStatus(
    Object.freeze({
      ...state,
      status: 'RUNNING',
      pendingApproval: null,
      lastError: null,
    }),
    'RUNNING',
    {
      type: 'APPROVAL_ACCEPTED',
      actorId: state.currentOwner,
      detail: {
        approvalId: requestedApprovalId,
        toolId: state.pendingApproval.toolId,
        callId: state.pendingApproval.callId,
      },
    },
  );
}

export function failRun(
  state: FlixoBotRunState,
  currentSha: string,
  reason: string,
): FlixoBotRunState {
  assertCurrentRunSha(state, currentSha);
  if (['SUCCEEDED', 'FAILED', 'CANCELLED', 'STALE'].includes(state.status)) {
    throw new Error('FLIXO_BOT_FAIL_INVALID_STATE');
  }
  return withStatus(
    Object.freeze({
      ...state,
      lastError: reason,
    }),
    'FAILED',
    {
      type: 'RUN_FAILED',
      actorId: state.currentOwner,
      detail: { reason },
    },
  );
}

export function applyNextStep(
  state: FlixoBotRunState,
  currentSha: string,
  step:
    | Readonly<{ type: 'RUN_AGAIN'; reason: string }>
    | Readonly<{ type: 'HANDOFF'; targetAgentId: string; reason: string }>
    | Readonly<{ type: 'FINAL'; output: unknown }>
    | Readonly<{ type: 'INTERRUPTION'; reason: string; requiresApproval: boolean }>,
): FlixoBotRunState {
  assertCurrentRunSha(state, currentSha);

  if (step.type === 'RUN_AGAIN') {
    if (!['RUNNING', 'RETRYING'].includes(state.status)) throw new Error('FLIXO_BOT_RUN_AGAIN_INVALID_STATE');
    if (state.turnCount >= state.maxTurns) {
      return withStatus(
        Object.freeze({ ...state, lastError: 'MAX_TURNS_EXCEEDED' }),
        'FAILED',
        { type: 'RUN_FAILED', actorId: state.currentOwner, detail: { reason: 'MAX_TURNS_EXCEEDED' } },
      );
    }
    return withStatus(
      Object.freeze({ ...state, stepIndex: state.stepIndex + 1, turnCount: state.turnCount + 1 }),
      'RUNNING',
      { type: 'MODEL_TURN', actorId: state.currentOwner, detail: { reason: step.reason } },
    );
  }

  if (step.type === 'HANDOFF') {
    if (!['RUNNING', 'RETRYING'].includes(state.status)) throw new Error('FLIXO_BOT_HANDOFF_INVALID_STATE');
    const target = required(step.targetAgentId, 'HANDOFF_TARGET_AGENT_ID');
    return withStatus(
      Object.freeze({
        ...state, currentOwner: target,
        stepIndex: state.stepIndex + 1, turnCount: state.turnCount + 1,
      }),
      'RUNNING',
      { type: 'HANDOFF', actorId: state.currentOwner, detail: {
        targetAgentId: target, reason: step.reason, authorityTransferred: false,
      }},
    );
  }

  if (step.type === 'FINAL') {
    if (!['RUNNING', 'RETRYING'].includes(state.status)) throw new Error('FLIXO_BOT_FINAL_INVALID_STATE');
    return withStatus(
      Object.freeze({ ...state, lastOutput: step.output, stepIndex: state.stepIndex + 1 }),
      'SUCCEEDED',
      { type: 'FINAL_OUTPUT', actorId: state.currentOwner },
    );
  }

  if (!['RUNNING', 'RETRYING'].includes(state.status)) throw new Error('FLIXO_BOT_INTERRUPTION_INVALID_STATE');
  return withStatus(
    Object.freeze({
      ...state,
      pendingApproval: step.requiresApproval ? { toolId: '', callId: '', reason: step.reason, approvalId: id('approval') } : null,
    }),
    step.requiresApproval ? 'WAITING_APPROVAL' : 'BLOCKED',
    { type: 'INTERRUPTION', actorId: state.currentOwner, detail: { reason: step.reason } },
  );
}

export function scheduleRetry(state: FlixoBotRunState, currentSha: string, reason: string): FlixoBotRunState {
  assertCurrentRunSha(state, currentSha);
  if (!['RUNNING', 'RETRYING'].includes(state.status)) throw new Error('FLIXO_BOT_RETRY_INVALID_STATE');
  if (state.retryCount >= state.maxRetries) {
    return withStatus(
      Object.freeze({ ...state, lastError: 'RETRY_BUDGET_EXHAUSTED' }),
      'FAILED',
      { type: 'RUN_FAILED', actorId: state.currentOwner, detail: { reason: 'RETRY_BUDGET_EXHAUSTED' } },
    );
  }
  return withStatus(
    Object.freeze({ ...state, retryCount: state.retryCount + 1 }),
    'RETRYING',
    { type: 'RETRY_SCHEDULED', actorId: state.currentOwner, detail: { reason } },
  );
}

export function markRunStale(state: FlixoBotRunState, currentSha: string): FlixoBotRunState {
  const current = assertExactSha(currentSha, 'CURRENT_SHA');
  if (current === state.exactSha) throw new Error('FLIXO_BOT_CANNOT_MARK_CURRENT_SHA_STALE');
  return withStatus(
    state,
    'STALE',
    { type: 'RUN_STALE', actorId: state.currentOwner, detail: { previousSha: state.exactSha, currentSha: current } },
  );
}

export function cancelRun(state: FlixoBotRunState, currentSha: string, reason: string): FlixoBotRunState {
  assertCurrentRunSha(state, currentSha);
  if (['SUCCEEDED', 'FAILED', 'CANCELLED', 'STALE'].includes(state.status)) {
    throw new Error('FLIXO_BOT_CANCEL_INVALID_STATE');
  }
  return withStatus(
    Object.freeze({ ...state, lastError: reason }),
    'CANCELLED',
    { type: 'RUN_CANCELLED', actorId: state.currentOwner, detail: { reason } },
  );
}

export function serializeFlixoBotRunState(state: FlixoBotRunState): string {
  return JSON.stringify(state);
}

export function restoreFlixoBotRunState<TContext = unknown>(
  serialized: string,
  currentSha: string,
): FlixoBotRunState<TContext> {
  if (typeof serialized !== 'string' || serialized.length === 0 || serialized.length > 256_000) {
    throw new Error('FLIXO_BOT_RUN_SERIALIZED_STATE_INVALID');
  }
  let parsed: FlixoBotRunState<TContext>;
  try {
    parsed = JSON.parse(serialized) as FlixoBotRunState<TContext>;
  } catch {
    throw new Error('FLIXO_BOT_RUN_STATE_INVALID_JSON');
  }
  if (!parsed || parsed.protocol !== FLIXO_BOT_OPENAI_RUNTIME_PROTOCOL) throw new Error('FLIXO_BOT_RUN_PROTOCOL_MISMATCH');
  if (parsed.schemaVersion !== FLIXO_BOT_OPENAI_RUNTIME_SCHEMA_VERSION) throw new Error('FLIXO_BOT_RUN_SCHEMA_MISMATCH');
  if (parsed.branch !== FLIXO_BOT_CANONICAL_BRANCH) throw new Error('FLIXO_BOT_RUN_BRANCH_MISMATCH');
  if (!['CREATED', 'RUNNING', 'WAITING_APPROVAL', 'RETRYING', 'SUCCEEDED', 'FAILED', 'STALE', 'CANCELLED', 'BLOCKED'].includes(parsed.status)) {
    throw new Error('FLIXO_BOT_RUN_STATUS_INVALID');
  }
  assertExactSha(parsed.exactSha);
  required(parsed.runId, 'RUN_ID');
  required(parsed.taskId, 'TASK_ID');
  required(parsed.agentId, 'AGENT_ID');
  required(parsed.currentOwner, 'CURRENT_OWNER');
  required(parsed.traceId, 'TRACE_ID');
  if (!Number.isInteger(parsed.stepIndex) || parsed.stepIndex < 0 || parsed.stepIndex > 128) throw new Error('FLIXO_BOT_RUN_STEP_INDEX_INVALID');
  if (!Number.isInteger(parsed.maxTurns) || parsed.maxTurns < 1 || parsed.maxTurns > 128
    || !Number.isInteger(parsed.turnCount) || parsed.turnCount < 0 || parsed.turnCount > parsed.maxTurns) {
    throw new Error('FLIXO_BOT_RUN_TURN_BUDGET_INVALID');
  }
  if (!Number.isInteger(parsed.maxRetries) || parsed.maxRetries < 0 || parsed.maxRetries > 12
    || !Number.isInteger(parsed.retryCount) || parsed.retryCount < 0 || parsed.retryCount > parsed.maxRetries) {
    throw new Error('FLIXO_BOT_RUN_RETRY_BUDGET_INVALID');
  }
  if (!Number.isInteger(parsed.maxToolCalls) || parsed.maxToolCalls < 1 || parsed.maxToolCalls > 32
    || !Number.isInteger(parsed.toolCallCount) || parsed.toolCallCount < 0 || parsed.toolCallCount > parsed.maxToolCalls) {
    throw new Error('FLIXO_BOT_RUN_TOOL_BUDGET_INVALID');
  }
  if (!Array.isArray(parsed.events) || parsed.events.length > 256) throw new Error('FLIXO_BOT_RUN_EVENTS_INVALID');
  if (!parsed.inputDigest || !/^[a-f0-9]{8}$/u.test(parsed.inputDigest)) throw new Error('FLIXO_BOT_RUN_INPUT_DIGEST_INVALID');
  if (parsed.pendingApproval) {
    required(parsed.pendingApproval.approvalId, 'APPROVAL_ID');
    required(parsed.pendingApproval.reason, 'APPROVAL_REASON');
  }
  parsed.events.forEach((event, index) => {
    if (event.seq !== index + 1 || event.exactSha !== parsed.exactSha || !event.actorId || !event.type) {
      throw new Error('FLIXO_BOT_RUN_EVENT_PROVENANCE_INVALID');
    }
  });
  assertCurrentRunSha(parsed, currentSha);
  return Object.freeze({
    ...parsed,
    events: Object.freeze(parsed.events.map((event) => Object.freeze({ ...event }))),
  });
}

export function createTrace(traceId = id('trace')): FlixoBotTrace {
  return Object.freeze({ traceId, spans: [] });
}

export function startTraceSpan(
  trace: FlixoBotTrace,
  input: Omit<FlixoBotTraceSpan, 'traceId' | 'spanId' | 'startedAt' | 'endedAt'>,
): FlixoBotTrace {
  const span: FlixoBotTraceSpan = Object.freeze({
    ...input, traceId: trace.traceId, spanId: id('span'), startedAt: now(), endedAt: null,
  });
  return Object.freeze({ ...trace, spans: Object.freeze([...trace.spans, span]) });
}

export function finishTraceSpan(trace: FlixoBotTrace, spanId: string): FlixoBotTrace {
  const index = trace.spans.findIndex((span) => span.spanId === spanId);
  if (index < 0) throw new Error('FLIXO_BOT_TRACE_SPAN_NOT_FOUND');
  return Object.freeze({
    ...trace,
    spans: Object.freeze(trace.spans.map((span, i) =>
      i === index ? Object.freeze({ ...span, endedAt: now() }) : span)),
  });
}

export function buildNestedAgentToolDescriptor(input: Readonly<{
  toolId: string;
  childAgentId: string;
  description: string;
}>) {
  return Object.freeze({
    toolId: required(input.toolId, 'TOOL_ID'),
    childAgentId: required(input.childAgentId, 'CHILD_AGENT_ID'),
    description: required(input.description, 'DESCRIPTION'),
    executionMode: 'AGENT_AS_TOOL' as const,
    authority: 'INHERITED_BOUNDARY' as const,
    mutationAuthority: false as const,
    certificationAuthority: false as const,
    handoffMayChangeExecutionOwner: true as const,
    handoffTransfersAuthority: false as const,
  });
}
