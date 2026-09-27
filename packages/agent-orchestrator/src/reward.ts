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

const nonNegativeInteger = (value: number | undefined, name: string): number => {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`INVALID_REWARD_SIGNAL:${name}`);
  return value;
};

const unitInterval = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`INVALID_REWARD_SIGNAL:${name}`);
  return value;
};

export class AgentRewardEngine {
  calculate(evidence: EvaluationEvidence): RewardResult {
    const testsPassed = nonNegativeInteger(evidence.testsPassed, "testsPassed");
    const testsFailed = nonNegativeInteger(evidence.testsFailed, "testsFailed");
    const reviewFindings = nonNegativeInteger(evidence.reviewFindings, "reviewFindings");
    const securityFindings = nonNegativeInteger(evidence.securityFindings, "securityFindings");
    const performanceRegressions = nonNegativeInteger(evidence.performanceRegressions, "performanceRegressions");
    const outOfScope = nonNegativeInteger(evidence.outOfScopeActions, "outOfScopeActions");
    const delegated = nonNegativeInteger(evidence.delegatedTasks, "delegatedTasks");
    const tests = testsPassed + testsFailed;
    const testRate = tests > 0 ? testsPassed / tests : 0;
    const artifacts = evidence.requiredArtifacts?.length ?? 0;
    const completedArtifacts = evidence.completedArtifacts?.length ?? 0;
    const artifactRate = artifacts > 0 ? completedArtifacts / artifacts : 0;
    const reviewQuality = clamp(1 - reviewFindings / 10);
    const securityQuality = clamp(1 - securityFindings / 10);
    const performanceQuality = clamp(1 - performanceRegressions / 10);

    const signals: RewardSignals = Object.freeze({
      correctness: clamp(testRate * 0.7 + artifactRate * 0.3),
      verification: clamp(testRate * 0.8 + (evidence.evidenceVerified ? 0.2 : 0)),
      quality: clamp(reviewQuality * 0.5 + securityQuality * 0.25 + performanceQuality * 0.25),
      evidence: clamp((artifactRate + (evidence.evidenceVerified ? 1 : 0)) / 2),
      efficiency: clamp(1 - performanceRegressions / 10),
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
    const verifiedFindings = nonNegativeInteger(signals.verifiedFindings, "verifiedFindings");
    const falsePositiveFindings = nonNegativeInteger(signals.falsePositiveFindings, "falsePositiveFindings");
    const resolvedDisputes = nonNegativeInteger(signals.resolvedDisputes, "resolvedDisputes");
    const unresolvedDisputes = nonNegativeInteger(signals.unresolvedDisputes, "unresolvedDisputes");
    const agreement = unitInterval(signals.agreement, "agreement");
    const verified = clamp(
      verifiedFindings / Math.max(1, verifiedFindings + falsePositiveFindings),
    );
    const precision = clamp(
      1 - falsePositiveFindings / Math.max(1, verifiedFindings + falsePositiveFindings),
    );
    const resolution = clamp(
      resolvedDisputes / Math.max(1, resolvedDisputes + unresolvedDisputes),
    );
    const evidence = clamp(agreement * 0.4 + verified * 0.6);
    const discovery = clamp(Math.min(1, verifiedFindings / 3));
    const penalty = clamp(
      falsePositiveFindings * 0.15 + unresolvedDisputes * 0.05,
    );
    const weighted =
      discovery * 0.35
      + precision * 0.30
      + resolution * 0.20
      + evidence * 0.15;
    const score = Math.round(clamp(weighted - penalty) * 100);
    const reasons = [
      ...(verifiedFindings ? ["verified-defect-discovery"] : []),
      ...(falsePositiveFindings ? ["false-positive-adversarial-finding"] : []),
      ...(unresolvedDisputes ? ["unresolved-dispute"] : []),
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
