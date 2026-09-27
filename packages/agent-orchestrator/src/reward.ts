import type { EvaluationEvidence } from "./evaluation.ts";
import type { ObjectiveVerificationContract } from "@flixo/contracts";

export const REWARD_WEIGHTS = Object.freeze({
  correctness: 0.30,
  verification: 0.20,
  quality: 0.15,
  evidence: 0.15,
  efficiency: 0.10,
  policyDiscipline: 0.10,
});

export type RewardSignals = Readonly<{
  correctness: number;
  verification: number;
  quality: number;
  evidence: number;
  efficiency: number;
  policyDiscipline: number;
  adversarialDiscovery: number;
  adversarialPrecision: number;
}>;

export type RewardResult = Readonly<{
  score: number;
  signals: RewardSignals;
  penalty: number;
  reasons: readonly string[];
}>;

export type AdversarialRewardSignals = Readonly<{
  verifiedFindings: number;
  falsePositiveFindings: number;
  resolvedDisputes: number;
  unresolvedDisputes: number;
  agreement: number;
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
      adversarialDiscovery: 0,
      adversarialPrecision: 0,
    });

    const weighted =
      signals.correctness * REWARD_WEIGHTS.correctness
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

    return Object.freeze({
      score,
      signals,
      penalty,
      reasons: Object.freeze(reasons),
    });
  }

  calculateVerified(
    evidence: EvaluationEvidence,
    verification: ObjectiveVerificationContract,
  ): RewardResult {
    const base = this.calculate(evidence);
    if (verification.status === "verified") return base;

    return Object.freeze({
      ...base,
      score: 0,
      signals: Object.freeze({
        ...base.signals,
        verification: 0,
        evidence: 0,
      }),
      reasons: Object.freeze([
        "unverified-objective",
        verification.status === "unresolved"
          ? "objective-verification-unresolved"
          : "objective-verification-rejected",
      ]),
    });
  }

  calculateAdversarial(signals: AdversarialRewardSignals): RewardResult {
    const verified = clamp(
      signals.verifiedFindings
      / Math.max(1, signals.verifiedFindings + signals.falsePositiveFindings),
    );
    const precision = clamp(
      1
      - signals.falsePositiveFindings
        / Math.max(1, signals.verifiedFindings + signals.falsePositiveFindings),
    );
    const resolution = clamp(
      signals.resolvedDisputes
      / Math.max(1, signals.resolvedDisputes + signals.unresolvedDisputes),
    );
    const evidence = clamp(signals.agreement * 0.4 + verified * 0.6);
    const discovery = clamp(Math.min(1, signals.verifiedFindings / 3));
    const penalty = clamp(
      signals.falsePositiveFindings * 0.15
      + signals.unresolvedDisputes * 0.05,
    );
    const weighted =
      discovery * 0.35
      + precision * 0.30
      + resolution * 0.20
      + evidence * 0.15;
    const score = Math.round(clamp(weighted - penalty) * 100);
    const reasons = [
      ...(signals.verifiedFindings ? ["verified-defect-discovery"] : []),
      ...(signals.falsePositiveFindings ? ["false-positive-adversarial-finding"] : []),
      ...(signals.unresolvedDisputes ? ["unresolved-dispute"] : []),
      ...(score >= 80
        ? ["adversarial-reward-earned"]
        : ["adversarial-reward-below-threshold"]),
    ];

    return Object.freeze({
      score,
      signals: Object.freeze({
        correctness: resolution,
        verification: precision,
        quality: precision,
        evidence,
        efficiency: resolution,
        policyDiscipline: 1,
        adversarialDiscovery: discovery,
        adversarialPrecision: precision,
      }),
      penalty,
      reasons: Object.freeze(reasons),
    });
  }
}
