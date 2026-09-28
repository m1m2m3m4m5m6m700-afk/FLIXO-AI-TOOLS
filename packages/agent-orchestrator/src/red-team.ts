import type { AgentInstruction, AgentReport, AgentWorker } from "./index.ts";
import { getAgentModelProfile } from "./agent-profiles.ts";
import type { AgentModelInvoker, AgentModelResponse } from "./model-adapter.ts";
import { AgentRewardEngine } from "./reward.ts";

export type RedTeamFinding = Readonly<{
  category: "security" | "reliability" | "evidence";
  content: string;
  evidence: Readonly<Record<string, unknown>>;
  verified: boolean;
}>;

export type RedTeamDecision = Readonly<{
  status: "completed" | "failed" | "blocked";
  summary: string;
  findings: readonly RedTeamFinding[];
  agreement: number;
  disputes: readonly string[];
}>;

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

export class RedTeamWorker implements AgentWorker {
  readonly id: string;

  constructor(
    private readonly invoker: AgentModelInvoker,
    id = "red-team",
  ) {
    this.id = id;
  }

  async run(instruction: AgentInstruction): Promise<AgentReport> {
    const categories = ["security", "reliability", "evidence"] as const;
    const profile = getAgentModelProfile(instruction.role);
    const positions = await Promise.all(categories.map((category) =>
      this.invoker.invoke({
        instruction,
        profile,
        messages: [
          {
            role: "system",
            content: "You are the " + category + " RED TEAM specialist. Attack the proposed solution independently. Do not assume it is correct. Identify concrete defects, unsafe assumptions, missing verification, regressions, or unsupported claims. Do not see other reviewers' answers. Return JSON with findings.",
          },
          {
            role: "user",
            content: JSON.stringify({
              objective: instruction.objective,
              constraints: instruction.constraints,
              context: instruction.context,
              output: { findings: [{ content: "string", evidence: "object", verified: "boolean" }] },
            }),
          },
        ],
        turn: 1,
      }),
    ));

    const adjudication = await this.invoker.invoke({
      instruction,
      profile,
      messages: [
        {
          role: "system",
          content: "You are the neutral RED TEAM adjudicator. Consolidate independent attacks. Mark a finding verified only when evidence supports it. Penalize false positives and preserve unresolved disputes.",
        },
        {
          role: "user",
          content: JSON.stringify({
            objective: instruction.objective,
            positions: positions.map((item, index) => ({
              category: categories[index],
              content: item.content,
              evidence: item.evidence ?? {},
            })),
            output: {
              status: "completed|failed|blocked",
              summary: "string",
              findings: [{ category: "security|reliability|evidence", content: "string", evidence: "object", verified: "boolean" }],
              agreement: "0..1",
              disputes: "string[]",
            },
          }),
        },
      ],
      turn: 2,
    });

    const decision = this.parse(adjudication);
    const verifiedFindings = decision.findings.filter((item) => item.verified).length;
    const falsePositiveFindings = decision.findings.filter((item) => !item.verified).length;
    const reward = new AgentRewardEngine().calculateAdversarial({
      verifiedFindings,
      falsePositiveFindings,
      resolvedDisputes: Math.max(0, decision.findings.length - decision.disputes.length),
      unresolvedDisputes: decision.disputes.length,
      agreement: decision.agreement,
    });

    return Object.freeze({
      stepId: instruction.stepId,
      commandId: instruction.commandId,
      status: decision.status,
      summary: decision.summary,
      evidence: Object.freeze({
        redTeam: true,
        findings: decision.findings,
        agreement: decision.agreement,
        disputes: decision.disputes,
        verifiedFindings,
        falsePositiveFindings,
        redTeamReward: reward,
        positions: positions.map((item) => ({ content: item.content, evidence: item.evidence ?? {} })),
      }),
    });
  }

  private parse(response: AgentModelResponse): RedTeamDecision {
    try {
      const raw = JSON.parse(response.content) as Partial<RedTeamDecision>;
      const findings = Array.isArray(raw.findings)
        ? raw.findings.filter((item): item is RedTeamFinding =>
          !!item && typeof item === "object"
          && (item as RedTeamFinding).category !== undefined
          && typeof (item as RedTeamFinding).content === "string"
          && typeof (item as RedTeamFinding).verified === "boolean")
        : [];
      return Object.freeze({
        status: raw.status === "failed" || raw.status === "blocked" ? raw.status : "completed",
        summary: typeof raw.summary === "string" && raw.summary.trim() ? raw.summary : response.content,
        findings: Object.freeze(findings),
        agreement: clamp(Number(raw.agreement ?? 0)),
        disputes: Object.freeze(Array.isArray(raw.disputes) ? raw.disputes.filter((item): item is string => typeof item === "string") : []),
      });
    } catch {
      return Object.freeze({
        status: "completed",
        summary: response.content,
        findings: Object.freeze([]),
        agreement: 0,
        disputes: Object.freeze(["RED TEAM adjudication was not structured; no finding was accepted as verified."]),
      });
    }
  }
}
