import type { AgentAuditSink, AgentNetworkEvent } from "@flixo/agent-orchestrator";
import { appendAgentTaskEvent, upsertAgentTask } from "./durable-task-store.ts";
import { createAgentEvent } from "@/lib/agent/event-gateway";

export type AgentAuditContext = Readonly<{ taskId: string; conversationId: string; ownerId: string; traceId?: string | null; request?: string | null; }>;

const lifecycleFor = (status: "completed" | "failed"): "COMPLETED" | "FAILED" => status === "completed" ? "COMPLETED" : "FAILED";

export class SupabaseAgentNetworkAuditSink implements AgentAuditSink {
  private lastPersistedSequence = 0;
  private persistTail: Promise<void> = Promise.resolve();
  constructor(private readonly context: AgentAuditContext) {
    if (!context.taskId.trim() || !context.conversationId.trim() || !context.ownerId.trim()) throw new Error("AGENT_AUDIT_CONTEXT_REQUIRED");
  }
  async persist(events: readonly AgentNetworkEvent[]): Promise<void> {
    const operation = this.persistTail.then(async () => {
      const pending = events.filter((event) => event.sequence > this.lastPersistedSequence);
      if (!pending.length) return;
      const latest = pending.at(-1)!;
      await upsertAgentTask({ taskId: this.context.taskId, conversationId: this.context.conversationId, ownerId: this.context.ownerId, lifecycle: "RUNNING", state: "EXECUTING", revision: latest.sequence, confirmationRequired: false, request: this.context.request ?? null, runtime: { agentNetwork: true, lastSequence: latest.sequence } });
      for (const event of pending) {
        const envelope = createAgentEvent({ source: "SYSTEM", eventType: "agent.network." + event.type, userId: this.context.ownerId, conversationId: this.context.conversationId, taskId: this.context.taskId, traceId: this.context.traceId ?? null, payload: { sequence: event.sequence, commandId: event.commandId, stepId: event.stepId, agentId: event.agentId, timestamp: event.timestamp, data: event.data } });
        await appendAgentTaskEvent(envelope);
        this.lastPersistedSequence = event.sequence;
      }
    });
    this.persistTail = operation.catch(() => undefined);
    return operation;
  }

  async finalize(status: "completed" | "failed", events: readonly AgentNetworkEvent[]): Promise<void> {
    await this.persist(events);
    const latest = events.at(-1);
    await upsertAgentTask({ taskId: this.context.taskId, conversationId: this.context.conversationId, ownerId: this.context.ownerId, lifecycle: lifecycleFor(status), state: status === "completed" ? "COMPLETED" : "FAILED", revision: latest?.sequence ?? this.lastPersistedSequence, confirmationRequired: false, request: this.context.request ?? null, runtime: { agentNetwork: true, lastSequence: latest?.sequence ?? this.lastPersistedSequence }, lastError: status === "failed" ? "DIRECT_COMMAND_EXECUTION_FAILED" : null });
  }
}