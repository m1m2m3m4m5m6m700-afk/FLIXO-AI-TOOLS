import type { AgentExperience, ExperienceStore } from "./experience.ts";
import { AgentRewardEngine, type RewardResult } from "./reward.ts";

export type LearningSnapshot = Readonly<{
  agentId: string;
  sampleCount: number;
  averageReward: number;
  bestReward: number;
  latestReward: number;
  strengths: readonly string[];
  weaknesses: readonly string[];
}>;

export type CurriculumItem = Readonly<{
  id: string;
  agentId: string;
  objective: string;
  rationale: string;
  priority: number;
}>;

export type ContinualLearningPolicy = Readonly<{
  curriculumSize: number;
  masteryThreshold: number;
  weaknessThreshold: number;
  minExploration: number;
}>;

export const DEFAULT_CONTINUAL_LEARNING_POLICY: ContinualLearningPolicy = Object.freeze({
  curriculumSize: 8,
  masteryThreshold: 0.85,
  weaknessThreshold: 0.65,
  minExploration: 0.1,
});

export class ContinualLearningEngine {
  constructor(
    private readonly store: ExperienceStore,
    private readonly rewardEngine = new AgentRewardEngine(),
    private readonly policy: ContinualLearningPolicy = DEFAULT_CONTINUAL_LEARNING_POLICY,
  ) {}

  record(experience: AgentExperience): RewardResult {
    const reward = experience.reward;
    this.store.append(Object.freeze({ ...experience, reward }));
    return reward;
  }

  snapshot(agentId: string): LearningSnapshot {
    const experiences = this.store.byAgent(agentId);
    const rewards = experiences.map((item) => item.reward.score);
    const averageReward = rewards.length ? rewards.reduce((sum, value) => sum + value, 0) / rewards.length : 0;
    const bestReward = rewards.length ? Math.max(...rewards) : 0;
    const latestReward = rewards.at(-1) ?? 0;
    const strengths = averageReward >= this.policy.masteryThreshold * 100
      ? ["consistent high-reward execution"]
      : [];
    const weaknesses = averageReward < this.policy.weaknessThreshold * 100
      ? ["needs more verified practice"]
      : [];
    return Object.freeze({
      agentId,
      sampleCount: experiences.length,
      averageReward,
      bestReward,
      latestReward,
      strengths: Object.freeze(strengths),
      weaknesses: Object.freeze(weaknesses),
    });
  }

  curriculum(agentId: string, objective: string): readonly CurriculumItem[] {
    const snapshot = this.snapshot(agentId);
    const count = Math.max(1, Math.min(this.policy.curriculumSize, 32));
    const items: CurriculumItem[] = [];
    for (let index = 0; index < count; index += 1) {
      const priority = Math.max(0, 1 - index / count);
      const rationale = snapshot.averageReward < this.policy.weaknessThreshold * 100
        ? "Increase verified practice on the current weakness before expanding scope."
        : "Use a harder variant to prevent overfitting to familiar examples.";
      items.push(Object.freeze({
        id: `curriculum-${agentId}-${index + 1}`,
        agentId,
        objective: `${objective} — level ${index + 1}`,
        rationale,
        priority,
      }));
    }
    return Object.freeze(items);
  }

  selectForObjective(objective: string, agentIds: readonly string[]): readonly LearningSnapshot[] {
    return Object.freeze(
      agentIds
        .map((agentId) => this.snapshot(agentId))
        .sort((a, b) =>
          b.averageReward - a.averageReward
          || b.sampleCount - a.sampleCount
          || a.agentId.localeCompare(b.agentId),
        ),
    );
  }
}
