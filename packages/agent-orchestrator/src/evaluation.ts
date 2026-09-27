import type { AgentCapability, AgentDescriptor } from "./network.ts";

export type EvaluationCriterion = Readonly<{ id: string; description: string; weight: number }>;
export type TrainingCase = Readonly<{ id: string; agentId: string; objective: string; criteria: readonly EvaluationCriterion[]; constraints: readonly string[] }>;
export type EvaluationEvidence = Readonly<{
  testsPassed?: number;
  testsFailed?: number;
  reviewFindings?: number;
  requiredArtifacts?: readonly string[];
  completedArtifacts?: readonly string[];
  securityFindings?: number;
  performanceRegressions?: number;
  delegatedTasks?: number;
  outOfScopeActions?: number;
  evidenceVerified?: boolean;
  notes?: string;
}>;
export type EvaluationResult = Readonly<{ caseId: string; agentId: string; score: number; passed: boolean; evidence: EvaluationEvidence; timestamp: string }>;
export type RewardLedgerEntry = Readonly<{ agentId: string; caseId: string; points: number; reason: string; balance: number; timestamp: string }>;
export type AgentTrainingProfile = Readonly<{
  agentId: string; capability: AgentCapability; level: number; xp: number; rewardBalance: number;
  trustScore: number; evaluations: number; passedEvaluations: number; failedEvaluations: number;
}>;
export type TrainingExecutor = Readonly<{ execute(testCase: TrainingCase): Promise<EvaluationEvidence> }>;

export const AGENT_TRAINING_CASES: readonly TrainingCase[] = Object.freeze([
  ...([
    ["architect", "architecture", "Design a safe modular architecture boundary."],
    ["planner", "planning", "Produce a dependency-aware execution plan."],
    ["researcher", "research", "Collect and validate relevant evidence."],
    ["implementer", "implementation", "Implement a scoped change with tests."],
    ["reviewer", "code-review", "Find correctness and maintainability defects."],
    ["tester", "testing", "Create and execute meaningful verification."],
    ["security", "security", "Identify security risks and required mitigations."],
    ["performance", "performance", "Detect performance regressions and bottlenecks."],
    ["ui-ux", "ui-ux", "Propose an accessible, coherent interface change."],
    ["integrator", "integration", "Integrate changes and verify the complete system."],
  ] as const).map(([agentId, , objective]) => ({
    id: `benchmark-${agentId}`,
    agentId,
    objective,
    constraints: ["direct-command-only", "no-self-delegation", "provide-verifiable-evidence"],
    criteria: [
      { id: "artifacts", description: "Required deliverables are complete", weight: 0.30 },
      { id: "tests", description: "Verification evidence is successful", weight: 0.30 },
      { id: "review", description: "Quality findings are resolved", weight: 0.20 },
      { id: "discipline", description: "No out-of-scope or unauthorized actions", weight: 0.20 },
    ],
  })) as TrainingCase[],
]);

export class AgentEvaluationEngine {
  private readonly evaluationResults: EvaluationResult[] = [];
  private readonly ledger: RewardLedgerEntry[] = [];
  private readonly profiles = new Map<string, AgentTrainingProfile>();

  constructor(agents: readonly AgentDescriptor[]) {
    for (const agent of agents) {
      const capability = agent.capabilities[0];
      if (capability) this.profiles.set(agent.id, {
        agentId: agent.id, capability, level: 1, xp: 0, rewardBalance: 0, trustScore: 50,
        evaluations: 0, passedEvaluations: 0, failedEvaluations: 0,
      });
    }
  }

  async train(testCases: readonly TrainingCase[], executor: TrainingExecutor): Promise<readonly EvaluationResult[]> {
    const results: EvaluationResult[] = [];
    for (const testCase of testCases) {
      if (!this.profiles.has(testCase.agentId)) throw new Error(`AGENT_NOT_REGISTERED:${testCase.agentId}`);
      results.push(this.evaluate(testCase, await executor.execute(testCase)));
    }
    return Object.freeze(results);
  }

  evaluate(testCase: TrainingCase, evidence: EvaluationEvidence): EvaluationResult {
    const profile = this.profiles.get(testCase.agentId);
    if (!profile) throw new Error(`AGENT_NOT_REGISTERED:${testCase.agentId}`);
    const totalWeight = testCase.criteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight <= 0) throw new Error("INVALID_EVALUATION_WEIGHTS");

    const score = Math.round(Math.min(1, Math.max(0, testCase.criteria.reduce((sum, c) => sum + this.criterionScore(c, evidence), 0) / totalWeight)) * 100);
    const passed = score >= 80;
    const penalty = (evidence.outOfScopeActions ?? 0) * 100 + (evidence.delegatedTasks ?? 0) * 100;
    const baseXp = passed ? 100 + Math.round(score / 2) : Math.max(0, Math.round(score / 2));
    const baseReward = passed ? Math.max(25, Math.round(score / 2)) : Math.round(score / 5);
    const xp = Math.max(0, baseXp - penalty);
    const reward = Math.max(0, baseReward - Math.round(penalty / 4));
    const trustDelta = passed ? Math.min(8, Math.max(1, Math.round((score - 79) / 3))) : -Math.min(15, Math.max(2, Math.round((80 - score) / 3)));
    const updated: AgentTrainingProfile = {
      ...profile, xp: profile.xp + xp, rewardBalance: profile.rewardBalance + reward,
      trustScore: Math.min(100, Math.max(0, profile.trustScore + trustDelta)),
      evaluations: profile.evaluations + 1, passedEvaluations: profile.passedEvaluations + (passed ? 1 : 0),
      failedEvaluations: profile.failedEvaluations + (passed ? 0 : 1),
      level: 1 + Math.floor((profile.xp + xp) / 500),
    };
    this.profiles.set(testCase.agentId, updated);
    const result=Object.freeze({ caseId:testCase.id, agentId:testCase.agentId, score, passed, evidence, timestamp:new Date().toISOString() });
    this.evaluationResults.push(result);
    this.ledger.push(Object.freeze({
      agentId:testCase.agentId, caseId:testCase.id, points:reward,
      reason: penalty > 0 ? "policy-penalty" : passed ? "evaluation-passed" : "evaluation-partial",
      balance:updated.rewardBalance, timestamp:result.timestamp,
    }));
    return result;
  }

  profile(agentId: string): AgentTrainingProfile {
    const p=this.profiles.get(agentId); if (!p) throw new Error(`AGENT_NOT_REGISTERED:${agentId}`); return Object.freeze({...p});
  }
  leaderboard(): readonly AgentTrainingProfile[] { return Object.freeze([...this.profiles.values()].sort((a,b)=>b.trustScore-a.trustScore || b.xp-a.xp)); }
  rewardLedger(): readonly RewardLedgerEntry[] { return Object.freeze([...this.ledger]); }
  results(): readonly EvaluationResult[] { return Object.freeze([...this.evaluationResults]); }
  benchmark(agentId: string): TrainingCase {
    const c=AGENT_TRAINING_CASES.find(x=>x.agentId===agentId); if (!c) throw new Error(`AGENT_NOT_REGISTERED:${agentId}`); return c;
  }

  private criterionScore(c: EvaluationCriterion, e: EvaluationEvidence): number {
    switch(c.id) {
      case "tests": return this.ratio(e.testsPassed ?? 0, (e.testsPassed ?? 0)+(e.testsFailed ?? 0));
      case "artifacts": return this.ratio(e.completedArtifacts?.length ?? 0, e.requiredArtifacts?.length ?? 0);
      case "review": return Math.max(0, 1-(e.reviewFindings ?? 0)/10);
      case "discipline": return e.delegatedTasks || e.outOfScopeActions ? 0 : 1;
      default: return 0;
    }
  }
  private ratio(done:number,total:number):number { return total<=0?0:Math.min(1,Math.max(0,done/total)); }
}
