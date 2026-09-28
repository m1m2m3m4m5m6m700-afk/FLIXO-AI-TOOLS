import type { AgentExperience, AgentExperiencePersistence } from "@flixo/agent-orchestrator";
import { createExternalAgentLearning, listAllExternalAgentLearning, type ExternalAgentLearning } from "./learning-persistence.ts";

const SHA40 = /^[a-f0-9]{40}$/u;

type PersistedExperienceEnvelope = { version: 1; experience: AgentExperience };

const targetShaFromEnv = (): string => {
  const value = [process.env.VERCEL_GIT_COMMIT_SHA, process.env.GITHUB_SHA, process.env.FLIXO_TARGET_SHA]
    .map((item) => item?.trim())
    .find((item) => SHA40.test(String(item ?? "")));
  if (!value) throw new Error("AGENT_EXPERIENCE_TARGET_SHA_REQUIRED");
  return value;
};

const kindFor = (experience: AgentExperience): "LESSON" | "ANTI_LESSON" | "ADVICE" | "COUNTEREXAMPLE" => {
  if (experience.lane === "red-team") return "COUNTEREXAMPLE";
  if (experience.failurePatterns?.length) return "ANTI_LESSON";
  if (experience.report.verification?.status === "verified" && experience.reward.score >= 80) return "LESSON";
  return "ADVICE";
};

const claimFor = (experience: AgentExperience): string =>
  (experience.agentId + ":" + (experience.report.verification?.status ?? "unresolved") + ":" + experience.reward.score + ":" + experience.objective).slice(0, 8000);

const envelopeFor = (experience: AgentExperience): PersistedExperienceEnvelope => ({ version: 1, experience });

const parseEnvelope = (row: ExternalAgentLearning): AgentExperience | null => {
  try {
    const parsed = JSON.parse(row.content) as Partial<PersistedExperienceEnvelope>;
    if (parsed.version !== 1 || !parsed.experience || typeof parsed.experience !== "object") return null;
    const experience = parsed.experience as AgentExperience;
    if (typeof experience.id !== "string" || typeof experience.commandId !== "string" || typeof experience.stepId !== "string" ||
      typeof experience.agentId !== "string" || typeof experience.objective !== "string" || !experience.reward || !experience.report) return null;
    return Object.freeze(experience);
  } catch { return null; }
};

export class SupabaseAgentExperiencePersistence implements AgentExperiencePersistence {
  constructor(private readonly targetSha: string = targetShaFromEnv()) {
    if (!SHA40.test(this.targetSha)) throw new Error("AGENT_EXPERIENCE_TARGET_SHA_INVALID");
  }

  async persist(experience: AgentExperience): Promise<void> {
    const content = JSON.stringify(envelopeFor(experience));
    if (content.length > 16_000) throw new Error("AGENT_EXPERIENCE_CONTENT_TOO_LARGE");
    await createExternalAgentLearning({
      sourceAgent: experience.agentId,
      sourceRole: experience.agentId,
      kind: kindFor(experience),
      status: experience.report.verification?.status === "verified" ? "VERIFIED" : "PROPOSED",
      taskId: experience.id,
      targetSha: this.targetSha,
      claim: claimFor(experience),
      content,
      evidenceRefs: Object.freeze([...(experience.report.verification?.evidence ?? []), ...(experience.failurePatterns ?? [])]).slice(0, 32),
      provenance: Object.freeze({
        experienceVersion: 1,
        experienceId: experience.id,
        commandId: experience.commandId,
        stepId: experience.stepId,
        agentId: experience.agentId,
        verificationState: experience.report.verification?.status ?? "unresolved",
        rewardScore: experience.reward.score,
        lane: experience.lane ?? "primary",
      }),
    });
  }

  async load(): Promise<readonly AgentExperience[]> {
    const rows = await listAllExternalAgentLearning(256);
    return Object.freeze(rows.map(parseEnvelope).filter((experience): experience is AgentExperience => experience !== null));
  }
};
