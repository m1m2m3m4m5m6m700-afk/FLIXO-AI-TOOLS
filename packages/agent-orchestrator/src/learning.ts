import type { AgentDescriptor } from "./network.ts";
import type { AgentExperience, ExperienceStore } from "./experience.ts";
import { AgentRewardEngine } from "./reward.ts";
import type { AgentInstruction, AgentObserver, AgentReport } from "./index.ts";

export type AgentLearningRecommendation = Readonly<{
  agentId: string;
  capability: AgentDescriptor["capabilities"][number];
  confidence: number;
  averageReward: number;
  sampleCount: number;
  exploration: boolean;
}>;

export type LearningPolicy = Readonly<{ explorationRate: number; minSamplesForExploitation: number }>;

export const DEFAULT_LEARNING_POLICY: LearningPolicy = Object.freeze({
  explorationRate: 0.10, minSamplesForExploitation: 3,
});

export class AgentLearningEngine {
  constructor(
    private readonly agents: readonly AgentDescriptor[],
    private readonly store: ExperienceStore,
    private readonly policy: LearningPolicy = DEFAULT_LEARNING_POLICY,
  ) {
    if (policy.explorationRate < 0 || policy.explorationRate > 1) throw new Error("INVALID_EXPLORATION_RATE");
  }

  recommend(objective: string, randomValue = 0.5): readonly AgentLearningRecommendation[] {
    if (randomValue < 0 || randomValue > 1) throw new Error("INVALID_RANDOM_VALUE");
    const similar = this.store.similar(objective, 20);
    const recommendations = this.agents.map((agent) => {
      const evidence = similar.filter((item) => item.agentId === agent.id);
      const averageReward = evidence.length
        ? evidence.reduce((sum, item) => sum + item.reward.score, 0) / evidence.length : 0;
      const confidence = Math.min(1, evidence.length / this.policy.minSamplesForExploitation);
      return {
        agentId: agent.id, capability: agent.capabilities[0], confidence,
        averageReward, sampleCount: evidence.length,
        exploration: randomValue < this.policy.explorationRate && evidence.length < this.policy.minSamplesForExploitation,
      };
    });
    recommendations.sort((a, b) =>
      Number(b.exploration) - Number(a.exploration)
      || b.confidence - a.confidence || b.averageReward - a.averageReward
      || a.agentId.localeCompare(b.agentId));
    return Object.freeze(recommendations);
  }

  record(experience: AgentExperience): void { this.store.append(experience); }
}


export class AgentLearningObserver implements AgentObserver {
  private readonly instructions = new Map<string, AgentInstruction>();
  constructor(
    private readonly store: ExperienceStore,
    private readonly rewardEngine = new AgentRewardEngine(),
  ) {}
  onDispatch(instruction: AgentInstruction): void {
    this.instructions.set(instruction.stepId, instruction);
  }
  onReport(report: AgentReport): void {
    const instruction = this.instructions.get(report.stepId);
    if (!instruction || instruction.commandId !== report.commandId) return;
    const reward = this.rewardEngine.calculate((report.evidence ?? {}) as Parameters<AgentRewardEngine["calculate"]>[0]);
    const experience: AgentExperience = Object.freeze({
      id: report.commandId + ":" + report.stepId,
      commandId: report.commandId,
      stepId: report.stepId,
      agentId: instruction.role,
      objective: instruction.objective,
      report,
      reward,
      timestamp: new Date().toISOString(),
    });
    this.store.append(experience);
    this.instructions.delete(report.stepId);
  }
}
