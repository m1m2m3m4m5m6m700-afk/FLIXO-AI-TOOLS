import { AgentCapability, AgentDescriptor } from "./network.ts";

export type EvaluationCriterion = Readonly<{
  id: string;
  description: string;
  weight: number;
}>;

export type TrainingCase = Readonly<{
  id: string;
  agentId: string;
  objective: string;
  criteria: readonly EvaluationCriterion[];
  constraints: readonly string[];
}>;

export type EvaluationEvidence = Readonly<{
  testsPassed?: number;
  testsFailed?: number;
  reviewFindings?: number;
  requiredArtifacts?: readonly string[];
  completedArtifacts?: readonly string[];
  notes?: string;
}>;

export type EvaluationResult = Readonly<{
  caseId: string;
  agentId: string;
  score: number;
  passed: boolean;
  evidence: EvaluationEvidence;
  timestamp: string;
}>;

export type RewardLedgerEntry = Readonly<{
  agentId: string;
  caseId: string;
  points: number;
  reason: string;
  balance: number;
  timestamp: string;
}>;

export type AgentTrainingProfile = Readonly<{
  agentId: string;
  capability: AgentCapability;
  level: number;
  xp: number;
  rewardBalance: number;
  evaluations: number;
  passedEvaluations: number;
}>;

export type TrainingExecutor = Readonly<{
  execute(testCase: TrainingCase): Promise<EvaluationEvidence>;
}>;

export class AgentEvaluationEngine {
  private readonly results: EvaluationResult[] = [];
  private readonly ledger: RewardLedgerEntry[] = [];
  private readonly profiles = new Map<string, AgentTrainingProfile>();

  constructor(agents: readonly AgentDescriptor[]) {
    for (const agent of agents) {
      const capability = agent.capabilities[0];
      if (capability) {
        this.profiles.set(agent.id, {
          agentId: agent.id,
          capability,
          level: 1,
          xp: 0,
          rewardBalance: 0,
          evaluations: 0,
          passedEvaluations: 0,
        });
      }
    }
  }

  async train(testCases: readonly TrainingCase[], executor: TrainingExecutor): Promise<readonly EvaluationResult[]> {
    const results: EvaluationResult[] = [];
    for (const testCase of testCases) {
      if (!this.profiles.has(testCase.agentId)) throw new Error(`AGENT_NOT_REGISTERED:${testCase.agentId}`);
      const evidence = await executor.execute(testCase);
      results.push(this.evaluate(testCase, evidence));
    }
    return Object.freeze(results);
  }

  evaluate(testCase: TrainingCase, evidence: EvaluationEvidence): EvaluationResult {
    const profile = this.profiles.get(testCase.agentId);
    if (!profile) throw new Error(`AGENT_NOT_REGISTERED:${testCase.agentId}`);

    const totalWeight = testCase.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    if (totalWeight <= 0) throw new Error("INVALID_EVALUATION_WEIGHTS");

    const score = Math.round(
      (testCase.criteria.reduce((sum, criterion) => sum + this.criterionScore(criterion, evidence), 0) / totalWeight) * 100,
    );
    const passed = score >= 80;
    const xp = passed ? 100 + Math.round(score / 10) : Math.max(10, Math.round(score / 2));
    const reward = passed ? Math.max(25, Math.round(score / 2)) : Math.round(score / 5);

    const updated: AgentTrainingProfile = {
      ...profile,
      xp: profile.xp + xp,
      rewardBalance: profile.rewardBalance + reward,
      evaluations: profile.evaluations + 1,
      passedEvaluations: profile.passedEvaluations + (passed ? 1 : 0),
      level: 1 + Math.floor((profile.xp + xp) / 500),
    };
    this.profiles.set(testCase.agentId, updated);

    const result: EvaluationResult = Object.freeze({
      caseId: testCase.id,
      agentId: testCase.agentId,
      score,
      passed,
      evidence,
      timestamp: new Date().toISOString(),
    });
    this.results.push(result);
    this.ledger.push(Object.freeze({
      agentId: testCase.agentId,
      caseId: testCase.id,
      points: reward,
      reason: passed ? "evaluation-passed" : "evaluation-partial",
      balance: updated.rewardBalance,
      timestamp: result.timestamp,
    }));
    return result;
  }

  profile(agentId: string): AgentTrainingProfile {
    const profile = this.profiles.get(agentId);
    if (!profile) throw new Error(`AGENT_NOT_REGISTERED:${agentId}`);
    return Object.freeze({ ...profile });
  }

  leaderboard(): readonly AgentTrainingProfile[] {
    return Object.freeze([...this.profiles.values()].sort((a, b) => b.xp - a.xp));
  }

  rewardLedger(): readonly RewardLedgerEntry[] {
    return Object.freeze([...this.ledger]);
  }

  results(): readonly EvaluationResult[] {
    return Object.freeze([...this.results]);
  }

  private criterionScore(criterion: EvaluationCriterion, evidence: EvaluationEvidence): number {
    switch (criterion.id) {
      case "tests":
        return this.ratio(evidence.testsPassed ?? 0, (evidence.testsPassed ?? 0) + (evidence.testsFailed ?? 0));
      case "artifacts":
        return this.ratio(evidence.completedArtifacts?.length ?? 0, evidence.requiredArtifacts?.length ?? 0);
      case "review":
        return (evidence.reviewFindings ?? 0) === 0 ? 1 : Math.max(0, 1 - (evidence.reviewFindings ?? 0) / 10);
      default:
        return 0;
    }
  }

  private ratio(done: number, total: number): number {
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, done / total));
  }
}
