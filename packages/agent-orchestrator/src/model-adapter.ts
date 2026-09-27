import type { AgentInstruction, AgentReport, AgentWorker } from "./index.ts";
import { getAgentModelProfile, type AgentModelProfile } from "./agent-profiles.ts";

export type AgentModelMessage = Readonly<{
  role: "system" | "user" | "assistant";
  content: string;
}>;

export type AgentModelRequest = Readonly<{
  instruction: AgentInstruction;
  profile: AgentModelProfile;
  messages: readonly AgentModelMessage[];
  turn: number;
}>;

export type AgentModelResponse = Readonly<{
  content: string;
  evidence?: Readonly<Record<string, unknown>>;
}>;

export interface AgentModelInvoker {
  invoke(request: AgentModelRequest): Promise<AgentModelResponse>;
}

export type AgentModelWorkerOptions = Readonly<{
  invoker: AgentModelInvoker;
  profiles?: readonly AgentModelProfile[];
  contextProvider?: (instruction: AgentInstruction) => Promise<Readonly<Record<string, unknown>>>;
  maxTurns?: number;
}>;

function normalizeEvidence(evidence: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...(evidence ?? {}) });
}

function normalizeContent(content: string): string {
  const value = content.trim();
  if (!value) throw new Error("AGENT_MODEL_EMPTY_RESPONSE");
  return value;
}

export class ModelBackedAgentWorker implements AgentWorker {
  readonly id: string;
  private readonly invoker: AgentModelInvoker;
  private readonly profiles: readonly AgentModelProfile[];
  private readonly contextProvider: NonNullable<AgentModelWorkerOptions["contextProvider"]>;
  private readonly maxTurns: number;

  constructor(
    descriptor: Readonly<{ id: string; role: string }>,
    options: AgentModelWorkerOptions,
  ) {
    if (!descriptor.id.trim()) throw new Error("AGENT_MODEL_WORKER_ID_REQUIRED");
    if (!descriptor.role.trim()) throw new Error("AGENT_MODEL_WORKER_ROLE_REQUIRED");
    this.id = descriptor.role;
    this.invoker = options.invoker;
    this.profiles = options.profiles ?? [];
    this.contextProvider = options.contextProvider ?? (async () => Object.freeze({}));
    this.maxTurns = Math.max(1, Math.min(32, Math.floor(options.maxTurns ?? 8)));
  }

  async run(instruction: AgentInstruction): Promise<AgentReport> {
    const profile = getAgentModelProfile(instruction.role, this.profiles.length ? this.profiles : undefined);
    const context = await this.contextProvider(instruction);
    const messages: AgentModelMessage[] = [
      { role: "system", content: profile.systemPrompt },
      {
        role: "user",
        content: JSON.stringify({
          commandId: instruction.commandId,
          stepId: instruction.stepId,
          objective: instruction.objective,
          constraints: instruction.constraints,
          context: { ...instruction.context, ...context },
          contract: {
            status: "completed|failed|blocked",
            summary: "concise result",
            evidence: "verifiable evidence only",
          },
        }),
      },
    ];

    let lastResponse: AgentModelResponse | null = null;
    for (let turn = 1; turn <= Math.min(this.maxTurns, profile.maxTurns); turn += 1) {
      lastResponse = await this.invoker.invoke(Object.freeze({
        instruction,
        profile,
        messages: Object.freeze([...messages]),
        turn,
      }));
      const content = normalizeContent(lastResponse.content);
      const status = /(?:blocked|cannot|unable|forbidden)/iu.test(content)
        ? "blocked"
        : "completed";
      return Object.freeze({
        stepId: instruction.stepId,
        commandId: instruction.commandId,
        status,
        summary: content,
        evidence: normalizeEvidence(lastResponse.evidence),
      });
    }

    return Object.freeze({
      stepId: instruction.stepId,
      commandId: instruction.commandId,
      status: "failed",
      summary: lastResponse ? normalizeContent(lastResponse.content) : "Agent model produced no response.",
      evidence: normalizeEvidence(lastResponse?.evidence),
    });
  }
}

export function createModelBackedWorker(
  descriptor: Readonly<{ id: string; role: string }>,
  options: AgentModelWorkerOptions,
): AgentWorker {
  return new ModelBackedAgentWorker(descriptor, options);
}
