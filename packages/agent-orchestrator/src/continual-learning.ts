import type { AgentExperience, ExperienceStore } from "./experience.ts";
import { AgentRewardEngine, type RewardResult } from "./reward.ts";
import { ObjectiveVerifier } from "./objective-verifier.ts";

export type SkillRecord = Readonly<{
  id: string;
  agentId: string;
  capability: string;
  pattern: string;
  proficiency: number;
  sampleCount: number;
  verifiedSamples: number;
  lastUpdated: string;
}>;

export type LearningSnapshot = Readonly<{
  agentId: string;
  sampleCount: number;
  averageReward: number;
  bestReward: number;
  latestReward: number;
  strengths: readonly string[];
  weaknesses: readonly string[];
  skills: readonly SkillRecord[];
}>;

export type CurriculumItem = Readonly<{
  id: string;
  agentId: string;
  objective: string;
  rationale: string;
  priority: number;
  difficulty: number;
  focus?: string;
}>;

export type ContinualLearningPolicy = Readonly<{
  curriculumSize: number;
  masteryThreshold: number;
  weaknessThreshold: number;
  minExploration: number;
}>;

export const DEFAULT_CONTINUAL_LEARNING_POLICY: ContinualLearningPolicy = Object.freeze({
  curriculumSize: 8, masteryThreshold: 0.85, weaknessThreshold: 0.65, minExploration: 0.1,
});

const capabilityFrom = (experience: AgentExperience): string => {
  const role = experience.agentId.trim();
  return role || "unknown";
};

export class ContinualLearningEngine {
  constructor(
    private readonly store: ExperienceStore,
    private readonly rewardEngine = new AgentRewardEngine(),
    private readonly verifier = new ObjectiveVerifier(),
    private readonly policy: ContinualLearningPolicy = DEFAULT_CONTINUAL_LEARNING_POLICY,
  ) {}

  record(experience: AgentExperience): RewardResult {
    const verification = experience.report.verification ?? this.verifier.verify({ id: `${experience.commandId}:${experience.stepId}`, commandId: experience.commandId, stepId: experience.stepId, agentId: experience.agentId, evidence: experience.report.evidence ?? {} });
    const reward = this.rewardEngine.calculateVerified(experience.report.evidence ?? {}, verification);
    const persisted = Object.freeze({ ...experience, report: Object.freeze({ ...experience.report, verification }), reward });
    this.store.append(persisted);
    return reward;
  }

  skillMemory(agentId: string): readonly SkillRecord[] {
    const experiences = this.store.byAgent(agentId);
    const buckets = new Map<string, AgentExperience[]>();
    for (const experience of experiences) {
      const capability = capabilityFrom(experience);
      const patterns = experience.failurePatterns?.length ? experience.failurePatterns : [experience.reward.reasons[0] ?? "general-execution"];
      for (const pattern of patterns) {
        const key = capability + ":" + pattern;
        const bucket = buckets.get(key) ?? [];
        bucket.push(experience);
        buckets.set(key, bucket);
      }
    }
    return Object.freeze([...buckets.entries()].map(([key, items]) => {
      const proficiency = items.reduce((sum, item) => sum + item.reward.score, 0) / Math.max(1, items.length) / 100;
      const verifiedSamples = items.filter((item) => item.reward.score >= 80 && item.reward.signals.verification >= 0.8).length;
      const [capability, pattern] = key.split(":");
      return Object.freeze({
        id: "skill-" + agentId + "-" + key,
        agentId, capability, pattern,
        proficiency: Math.min(1, proficiency),
        sampleCount: items.length,
        verifiedSamples,
        lastUpdated: items.at(-1)?.timestamp ?? new Date(0).toISOString(),
      });
    }));
  }

  snapshot(agentId: string): LearningSnapshot {
    const experiences = this.store.byAgent(agentId);
    const rewards = experiences.map((item) => item.reward.score);
    const skills = this.skillMemory(agentId);
    const averageReward = rewards.length ? rewards.reduce((sum, value) => sum + value, 0) / rewards.length : 0;
    const bestReward = rewards.length ? Math.max(...rewards) : 0;
    const latestReward = rewards.at(-1) ?? 0;
    const strengths = skills.filter((skill) => skill.proficiency >= this.policy.masteryThreshold).map((skill) => skill.pattern);
    const weaknesses = skills.filter((skill) => skill.proficiency < this.policy.weaknessThreshold).map((skill) => skill.pattern);
    if (!experiences.length) weaknesses.push("needs verified practice");
    return Object.freeze({
      agentId, sampleCount: experiences.length, averageReward, bestReward, latestReward,
      strengths: Object.freeze([...new Set(strengths)]),
      weaknesses: Object.freeze([...new Set(weaknesses)]),
      skills,
    });
  }

  curriculum(agentId: string, objective: string): readonly CurriculumItem[] {
    const snapshot = this.snapshot(agentId);
    const count = Math.max(1, Math.min(this.policy.curriculumSize, 32));
    const failureCounts = new Map<string, number>();
    for (const experience of this.store.byAgent(agentId)) {
      for (const pattern of experience.failurePatterns ?? []) failureCounts.set(pattern, (failureCounts.get(pattern) ?? 0) + 1);
    }
    const failureFocus = [...failureCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([pattern])=>pattern);
    const weak = snapshot.skills.filter((skill) => skill.proficiency < this.policy.weaknessThreshold);
    const mastered = snapshot.skills.filter((skill) => skill.proficiency >= this.policy.masteryThreshold);
    const items: CurriculumItem[] = [];
    for (let index = 0; index < count; index += 1) {
      const focus = failureFocus[index % Math.max(1, failureFocus.length)] ?? weak[index % Math.max(1, weak.length)]?.pattern;
      const difficulty = Math.min(1, 0.35 + index * (0.65 / Math.max(1, count - 1)) + (mastered.length ? 0.1 : 0));
      const rationale = focus
        ? `Target recurring weakness: ${focus}.`
        : "Use a harder verified variant to prevent overfitting.";
      items.push(Object.freeze({
        id: `curriculum-${agentId}-${index + 1}`, agentId,
        objective: `${objective} — level ${index + 1}${focus ? ` — focus: ${focus}` : ""}`,
        rationale, priority: Math.max(0, 1 - index / count), difficulty, ...(focus ? { focus } : {}),
      }));
    }
    return Object.freeze(items);
  }

  selectForObjective(objective: string, agentIds: readonly string[]): readonly LearningSnapshot[] {
    return Object.freeze(agentIds.map((agentId) => this.snapshot(agentId)).sort((a, b) =>
      b.averageReward - a.averageReward || b.sampleCount - a.sampleCount || a.agentId.localeCompare(b.agentId)));
  }
}
