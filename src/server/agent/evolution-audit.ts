import type { EvolutionAuditSink, EvolutionProposalContract } from "@flixo/agent-orchestrator";
import { appendAgentTaskEvent, upsertAgentTask } from "./durable-task-store.ts";
import { createAgentEvent } from "@/lib/agent/event-gateway";

import type { AgentAuditContext } from "./orchestrator-audit.ts";

const revisionFor = (status: EvolutionProposalContract["status"]): number => ({ proposed: 1, benchmarked: 2, awaiting_human_approval: 3, approved: 4, applied: 5, rejected: 6, rolled_back: 7 })[status];

export class SupabaseAgentEvolutionAuditSink implements EvolutionAuditSink {
  constructor(private readonly context: AgentAuditContext) {}

  async persist(event: Parameters<EvolutionAuditSink["persist"]>[0], proposal: EvolutionProposalContract): Promise<void> {
    const terminal = event === "applied" || event === "rolled_back";
    await upsertAgentTask({
      taskId: this.context.taskId,
      conversationId: this.context.conversationId,
      ownerId: this.context.ownerId,
      lifecycle: terminal ? "COMPLETED" : "VERIFYING",
      state: terminal ? "COMPLETED" : "VERIFYING",
      revision: revisionFor(proposal.status),
      confirmationRequired: event === "awaiting_human_approval",
      request: this.context.request ?? null,
      runtime: { evolution: true, proposalId: proposal.id, status: proposal.status },
      lastError: null,
    });
    const envelope = createAgentEvent({
      source: "SYSTEM",
      eventType: "evolution." + event,
      userId: this.context.ownerId,
      conversationId: this.context.conversationId,
      taskId: this.context.taskId,
      traceId: this.context.traceId ?? null,
      payload: { proposal },
    });
    await appendAgentTaskEvent(envelope);
  }
}