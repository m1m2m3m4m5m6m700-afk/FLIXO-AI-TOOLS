import type {
  AgentResponse,
  ExecutionRequest,
  ExecutionResult,
  ToolCall,
} from "@flixo/contracts";
import { RuntimeToolRegistry } from "./registry";
import { isTerminal, transition, type RuntimeState } from "./state";

export type RuntimeSnapshot = Readonly<{
  taskId: string;
  traceId: string;
  state: RuntimeState;
  revision: number;
}>;

export class AgentRuntime {
  private snapshot: RuntimeSnapshot;
  private readonly registry: RuntimeToolRegistry;

  constructor(
    registry: RuntimeToolRegistry,
    identity: Readonly<{ taskId: string; traceId: string }>,
  ) {
    this.registry = registry;
    if (!identity.taskId.trim() || !identity.traceId.trim()) {
      throw new Error("Runtime task identity is required.");
    }
    this.snapshot = Object.freeze({
      taskId: identity.taskId,
      traceId: identity.traceId,
      state: "IDLE",
      revision: 0,
    });
  }

  get state(): RuntimeSnapshot {
    return this.snapshot;
  }

  plan(): RuntimeSnapshot {
    return this.move("PLANNED");
  }

  requestConfirmation(): RuntimeSnapshot {
    return this.move("AWAITING_CONFIRMATION");
  }

  confirm(): RuntimeSnapshot {
    return this.move("EXECUTING");
  }

  beginVerification(): RuntimeSnapshot {
    return this.move("VERIFYING");
  }

  complete(): RuntimeSnapshot {
    return this.move("COMPLETED");
  }

  fail(): RuntimeSnapshot {
    if (isTerminal(this.snapshot.state)) return this.snapshot;
    return this.move("FAILED");
  }

  cancel(): RuntimeSnapshot {
    if (this.snapshot.state === "CANCELLED") return this.snapshot;
    return this.move("CANCELLED");
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    if (request.taskId !== this.snapshot.taskId || request.traceId !== this.snapshot.traceId) {
      throw new Error("RUNTIME_IDENTITY_MISMATCH");
    }
    if (this.snapshot.state !== "EXECUTING") {
      throw new Error(`RUNTIME_EXECUTION_BLOCKED:${this.snapshot.state}`);
    }

    const result = await this.registry.execute(request.toolCall);
    if (result.status === "error") this.fail();
    return Object.freeze({
      requestId: request.requestId,
      taskId: request.taskId,
      traceId: request.traceId,
      result,
    });
  }

  createResponse(content: string, toolCalls: readonly ToolCall[], results: readonly ExecutionResult[]): AgentResponse {
    return Object.freeze({
      messageId: crypto.randomUUID(),
      content,
      toolCalls,
      toolResults: results.map((item) => item.result),
      requiresUserConfirmation: this.snapshot.state === "AWAITING_CONFIRMATION",
    });
  }

  private move(next: RuntimeState): RuntimeSnapshot {
    const state = transition(this.snapshot.state, next);
    this.snapshot = Object.freeze({
      ...this.snapshot,
      state,
      revision: this.snapshot.revision + 1,
    });
    return this.snapshot;
  }
}
