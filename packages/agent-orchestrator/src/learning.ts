import type { AgentDescriptor } from "./network.ts";
import type { AgentExperience, AgentExperiencePersistence, ExperienceStore } from "./experience.ts";
import { AgentRewardEngine, type RewardResult } from "./reward.ts";
import { ObjectiveVerifier } from "./objective-verifier.ts";
import { FailureIntelligence } from "./cognitive.ts";
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
    private readonly verifier = new ObjectiveVerifier(),
    private readonly failureIntelligence = new FailureIntelligence(),
    private readonly persistence?: AgentExperiencePersistence,
  ) {}
  onDispatch(instruction: AgentInstruction): void {
    this.instructions.set(instruction.stepId, instruction);
  }
  async hydrate(): Promise<void> {
    if (!this.persistence) return;
    const known = new Set(this.store.list().map((item) => item.id));
    for (const experience of await this.persistence.load()) {
      if (!known.has(experience.id)) this.store.append(experience);
    }
  }

  async onReport(report: AgentReport): Promise<void> {
    const instruction = this.instructions.get(report.stepId);
    if (!instruction || instruction.commandId !== report.commandId) return;
    const verification = report.verification ?? this.verifier.verify({ id: `${report.commandId}:${report.stepId}`, commandId: report.commandId, stepId: report.stepId, agentId: instruction.role, evidence: (report.evidence ?? {}) as Parameters<ObjectiveVerifier["verify"]>[0]["evidence"] });
    const evidence = (report.evidence ?? {}) as Parameters<AgentRewardEngine["calculate"]>[0];
    const reward = this.rewardEngine.calculateVerified(evidence, verification);
    const failures = this.failureIntelligence.classify(report.commandId, report.stepId, instruction.role, evidence);
    const experience: AgentExperience = Object.freeze({
      id: report.commandId + ":" + report.stepId,
      commandId: report.commandId,
      stepId: report.stepId,
      agentId: instruction.role,
      objective: instruction.objective,
      report: Object.freeze({ ...report, verification }),
      reward,
      failurePatterns: Object.freeze(failures.map((failure) => failure.pattern)),
      timestamp: new Date().toISOString(),
    });
    this.store.append(experience);
    if (this.persistence) await this.persistence.persist(experience);
    const extra = report.evidence?.redTeamReward;
    if (instruction.role === "red-team" && extra && typeof extra === "object" && "score" in extra) {
      const secondary = Object.freeze({
        ...experience,
        id: experience.id + ":secondary",
        reward: extra as RewardResult,
        lane: "red-team",
        parentExperienceId: experience.id,
      });
      this.store.append(secondary);
      if (this.persistence) await this.persistence.persist(secondary);
    }
    this.instructions.delete(report.stepId);
  }
}
