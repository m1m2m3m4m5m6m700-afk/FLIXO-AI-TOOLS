import * as FlixoBotRuntime from './flixo-bot-openai-runtime';
import {
  applyNextStep,
  createTrace,
  finishTraceSpan,
  markRunStale,
  scheduleRetry,
  serializeFlixoBotRunState,
  startRun,
  startTraceSpan,
  type FlixoBotRunState,
  type FlixoBotTrace,
} from './flixo-bot-openai-runtime';

export const FLIXO_BOT_GATEWAY_AGENT_ID = 'execution-agent-clone-v1' as const;
export const FLIXO_BOT_GATEWAY_MAX_TURNS = 6 as const;
export const FLIXO_BOT_GATEWAY_MAX_RETRIES = 2 as const;

export type FlixoBotGatewayRuntime = Readonly<{
  state: FlixoBotRunState;
  trace: FlixoBotTrace;
  runSpanId: string;
}>;

export type FlixoBotRuntimeSummary = Readonly<{
  protocol: string;
  runId: string;
  taskId: string;
  status: FlixoBotRunState['status'];
  traceId: string;
  exactSha: string;
  turnCount: number;
  retryCount: number;
  eventCount: number;
  resumeState: string;
}>;

export function beginFlixoBotGatewayRuntime(input: Readonly<{
  taskId: string;
  exactSha: string;
  request: string;
}>): FlixoBotGatewayRuntime {
  const state = startRun(FlixoBotRuntime.createFlixoBotRunState({
    taskId: input.taskId,
    agentId: FLIXO_BOT_GATEWAY_AGENT_ID,
    exactSha: input.exactSha,
    request: input.request,
    maxTurns: FLIXO_BOT_GATEWAY_MAX_TURNS,
    maxRetries: FLIXO_BOT_GATEWAY_MAX_RETRIES,
  }), input.exactSha);

  const trace = startTraceSpan(createTrace(state.traceId), {
    kind: 'RUN',
    name: 'FLIXO BOT gateway run',
    parentSpanId: null,
    attributes: {
      agentId: FLIXO_BOT_GATEWAY_AGENT_ID,
      taskId: input.taskId,
    },
  });

  return Object.freeze({
    state,
    trace,
    runSpanId: trace.spans[0]?.spanId ?? '',
  });
}

export function beginModelTurn(
  runtime: FlixoBotGatewayRuntime,
  provider: string,
): Readonly<{ runtime: FlixoBotGatewayRuntime; spanId: string }> {
  const trace = startTraceSpan(runtime.trace, {
    kind: 'MODEL',
    name: 'provider:' + provider,
    parentSpanId: runtime.runSpanId || null,
    attributes: { provider },
  });
  return Object.freeze({
    runtime: Object.freeze({ ...runtime, trace }),
    spanId: trace.spans.at(-1)?.spanId ?? '',
  });
}

export function finishModelTurn(
  runtime: FlixoBotGatewayRuntime,
  spanId: string,
  outcome: 'success' | 'failure',
): FlixoBotGatewayRuntime {
  void outcome;
  const span = runtime.trace.spans.find((item) => item.spanId === spanId);
  if (!span || span.endedAt) return runtime;
  return Object.freeze({
    ...runtime,
    trace: finishTraceSpan(runtime.trace, spanId),
  });
}

export function noteProviderFailure(
  runtime: FlixoBotGatewayRuntime,
  reason: string,
): FlixoBotGatewayRuntime {
  return Object.freeze({
    ...runtime,
    state: scheduleRetry(runtime.state, runtime.state.exactSha, reason),
  });
}

export function finalizeFlixoBotGatewayRuntime(
  runtime: FlixoBotGatewayRuntime,
  mode: 'chat' | 'clarify' | 'plan',
  output: unknown,
): FlixoBotGatewayRuntime {
  const state = mode === 'plan'
    ? applyNextStep(runtime.state, runtime.state.exactSha, {
      type: 'INTERRUPTION',
      reason: 'PLAN_REQUIRES_EXPLICIT_USER_CONFIRMATION',
      requiresApproval: true,
    })
    : applyNextStep(runtime.state, runtime.state.exactSha, {
      type: 'FINAL',
      output,
    });

  const trace = runtime.trace.spans.some((span) => span.spanId === runtime.runSpanId && span.endedAt === null)
    ? finishTraceSpan(runtime.trace, runtime.runSpanId)
    : runtime.trace;

  return Object.freeze({ ...runtime, state, trace });
}

export function markFlixoBotGatewayRuntimeStale(
  runtime: FlixoBotGatewayRuntime,
  currentSha: string,
): FlixoBotGatewayRuntime {
  return Object.freeze({
    ...runtime,
    state: markRunStale(runtime.state, currentSha),
  });
}

export function toFlixoBotRuntimeSummary(
  runtime: FlixoBotGatewayRuntime,
): FlixoBotRuntimeSummary {
  return Object.freeze({
    protocol: runtime.state.protocol,
    runId: runtime.state.runId,
    taskId: runtime.state.taskId,
    status: runtime.state.status,
    traceId: runtime.state.traceId,
    exactSha: runtime.state.exactSha,
    turnCount: runtime.state.turnCount,
    retryCount: runtime.state.retryCount,
    eventCount: runtime.state.events.length,
    resumeState: serializeFlixoBotRunState(runtime.state),
  });
}
