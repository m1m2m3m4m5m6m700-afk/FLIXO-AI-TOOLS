import type { EvaluationEvidence } from "./evaluation.ts";

export const REWARD_WEIGHTS = Object.freeze({
  correctness: 0.30, verification: 0.20, quality: 0.15,
  evidence: 0.15, efficiency: 0.10, policyDiscipline: 0.10,
});

export type RewardSignals = Readonly<{
  correctness: number; verification: number; quality: number;
  evidence: number; efficiency: number; policyDiscipline: number;
}>;

export type RewardResult = Readonly<{
  score: number; signals: RewardSignals; penalty: number; reasons: readonly string[];
}>;

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

export class AgentRewardEngine {
  calculate(evidence: EvaluationEvidence): RewardResult {
    const tests = (evidence.testsPassed ?? 0) + (evidence.testsFailed ?? 0);
    const testRate = tests > 0 ? (evidence.testsPassed ?? 0) / tests : 0;
    const artifacts = evidence.requiredArtifacts?.length ?? 0;
    const completedArtifacts = evidence.completedArtifacts?.length ?? 0;
    const artifactRate = artifacts > 0 ? completedArtifacts / artifacts : 0;
    const reviewQuality = clamp(1 - (evidence.reviewFindings ?? 0) / 10);
    const securityQuality = clamp(1 - (evidence.securityFindings ?? 0) / 10);
    const performanceQuality = clamp(1 - (evidence.performanceRegressions ?? 0) / 10);
    const outOfScope = evidence.outOfScopeActions ?? 0;
    const delegated = evidence.delegatedTasks ?? 0;
    const signals: RewardSignals = Object.freeze({
      correctness: clamp(testRate * 0.7 + artifactRate * 0.3),
      verification: clamp(testRate * 0.8 + (evidence.evidenceVerified ? 0.2 : 0)),
      quality: clamp(reviewQuality * 0.5 + securityQuality * 0.25 + performanceQuality * 0.25),
      evidence: clamp((artifactRate + (evidence.evidenceVerified ? 1 : 0)) / 2),
      efficiency: clamp(1 - Math.max(0, evidence.performanceRegressions ?? 0) / 10),
      policyDiscipline: outOfScope === 0 && delegated === 0 ? 1 : 0,
    });
    const weighted = signals.correctness * REWARD_WEIGHTS.correctness
      + signals.verification * REWARD_WEIGHTS.verification
      + signals.quality * REWARD_WEIGHTS.quality
      + signals.evidence * REWARD_WEIGHTS.evidence
      + signals.efficiency * REWARD_WEIGHTS.efficiency
      + signals.policyDiscipline * REWARD_WEIGHTS.policyDiscipline;
    const penalty = clamp((outOfScope + delegated) * 0.25);
    const score = Math.round(clamp(weighted - penalty) * 100);
    const reasons = [
      ...(outOfScope ? ["out-of-scope-action"] : []),
      ...(delegated ? ["unauthorized-delegation"] : []),
      ...(score < 80 ? ["below-reward-threshold"] : ["verified-success"]),
    ];
    return Object.freeze({ score, signals, penalty, reasons: Object.freeze(reasons) });
  }
}
