import type { AgentInstruction, AgentReport, AgentWorker } from "./index.ts";
import { getAgentModelProfile, type AgentModelProfile } from "./agent-profiles.ts";
import type { AgentModelInvoker, AgentModelMessage, AgentModelResponse } from "./model-adapter.ts";

export type AdversarialPosition = Readonly<{
  side: "primary" | "adversary";
  content: string;
  evidence: Readonly<Record<string, unknown>>;
}>;

export type AdversarialDecision = Readonly<{
  status: "completed" | "failed" | "blocked";
  summary: string;
  evidence: Readonly<Record<string, unknown>>;
  agreement: number;
  disputes: readonly string[];
  winningSide: "primary" | "adversary" | "undetermined";
}>;

export type AdversarialAgentOptions = Readonly<{
  invoker: AgentModelInvoker;
  profiles?: readonly AgentModelProfile[];
  maxRounds?: number;
}>;

function evidence(value: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...(value ?? {}) });
}

function message(role: AgentModelMessage["role"], content: string): AgentModelMessage {
  return Object.freeze({ role, content });
}

function positionPrompt(instruction: AgentInstruction, profile: AgentModelProfile, side: "primary" | "adversary"): readonly AgentModelMessage[] {
  const stance = side === "primary"
    ? "Solve the task independently. Do not assume another agent exists. Commit to your best evidence-backed result."
    : "Act as the adversarial twin. Solve the same task independently. Search specifically for hidden assumptions, failure modes, missing evidence, regressions, and incorrect conclusions. Do not see the primary answer.";
  return Object.freeze([
    message("system", `${profile.systemPrompt}\n\n${stance}`),
    message("user", JSON.stringify({
      commandId: instruction.commandId,
      stepId: instruction.stepId,
      objective: instruction.objective,
      constraints: instruction.constraints,
      context: instruction.context,
      output: { result: "string", evidence: "object" },
    })),
  ]);
}

export class AdversarialTwinWorker implements AgentWorker {
  readonly id: string;

  constructor(
    descriptor: Readonly<{ id: string; role: string }>,
    private readonly options: AdversarialAgentOptions,
  ) {
    if (!descriptor.id.trim() || !descriptor.role.trim()) throw new Error("ADVERSARIAL_DESCRIPTOR_REQUIRED");
    this.id = descriptor.role;
  }

  async run(instruction: AgentInstruction): Promise<AgentReport> {
    const profile = getAgentModelProfile(instruction.role, this.options.profiles?.length ? this.options.profiles : undefined);
    const rounds = Math.max(1, Math.min(4, Math.floor(this.options.maxRounds ?? 2)));

    let primary: AgentModelResponse | null = null;
    let adversary: AgentModelResponse | null = null;

    for (let round = 1; round <= rounds; round += 1) {
      [primary, adversary] = await Promise.all([
        this.options.invoker.invoke(Object.freeze({
          instruction,
          profile,
          messages: positionPrompt(instruction, profile, "primary"),
          turn: round,
        })),
        this.options.invoker.invoke(Object.freeze({
          instruction,
          profile,
          messages: positionPrompt(instruction, profile, "adversary"),
          turn: round,
        })),
      ]);

      const adjudication = await this.options.invoker.invoke(Object.freeze({
        instruction,
        profile,
        messages: Object.freeze([
          message("system", `You are the neutral adjudicator for role ${profile.role}. You must compare two independently produced positions. Do not favor either side. Accept claims only when supported by evidence. Preserve unresolved disagreement.`),
          message("user", JSON.stringify({
            objective: instruction.objective,
            primary: { content: primary.content, evidence: evidence(primary.evidence) },
            adversary: { content: adversary.content, evidence: evidence(adversary.evidence) },
            decisionContract: {
              status: "completed|failed|blocked",
              agreement: "0..1",
              winningSide: "primary|adversary|undetermined",
              disputes: "array",
              summary: "evidence-backed resolution",
              evidence: "object",
            },
          })),
        ]),
        turn: round,
      }));

      const decision = this.parseDecision(adjudication);
      if (decision.agreement >= 0.85 || round === rounds) {
        return Object.freeze({
          stepId: instruction.stepId,
          commandId: instruction.commandId,
          status: decision.status,
          summary: decision.summary,
          evidence: Object.freeze({
            ...decision.evidence,
            adversarial: true,
            agreement: decision.agreement,
            disputes: decision.disputes,
            winningSide: decision.winningSide,
            primary: { content: primary.content, evidence: evidence(primary.evidence) },
            adversary: { content: adversary.content, evidence: evidence(adversary.evidence) },
          }),
        });
      }
    }

    throw new Error("ADVERSARIAL_ROUND_EXHAUSTED");
  }

  private parseDecision(response: AgentModelResponse): AdversarialDecision {
    try {
      const raw = JSON.parse(response.content) as Partial<AdversarialDecision>;
      const agreement = Math.min(1, Math.max(0, Number(raw.agreement ?? 0)));
      const winningSide = raw.winningSide === "primary" || raw.winningSide === "adversary"
        ? raw.winningSide
        : "undetermined";
      const status = raw.status === "failed" || raw.status === "blocked" ? raw.status : "completed";
      return Object.freeze({
        status,
        summary: typeof raw.summary === "string" && raw.summary.trim() ? raw.summary : response.content,
        evidence: evidence(raw.evidence ?? response.evidence),
        agreement,
        disputes: Object.freeze(Array.isArray(raw.disputes) ? raw.disputes.filter((item): item is string => typeof item === "string") : []),
        winningSide,
      });
    } catch {
      return Object.freeze({
        status: "completed",
        summary: response.content,
        evidence: evidence(response.evidence),
        agreement: 0,
        disputes: Object.freeze(["Adjudicator did not return structured consensus; preserve both positions."]),
        winningSide: "undetermined",
      });
    }
  }
}

export type AdversarialPair = Readonly<{
  role: string;
  primary: AgentWorker;
  adversary: AgentWorker;
}>;

export function createAdversarialPair(
  descriptor: Readonly<{ id: string; role: string }>,
  options: AdversarialAgentOptions,
): AdversarialPair {
  const primary = new AdversarialTwinWorker({ id: descriptor.id + ":primary", role: descriptor.role }, options);
  const adversary = new AdversarialTwinWorker({ id: descriptor.id + ":adversary", role: descriptor.role }, options);
  return Object.freeze({ role: descriptor.role, primary, adversary });
}
