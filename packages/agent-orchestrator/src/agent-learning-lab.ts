import type { AgentWorker } from "./index.ts";
import type { RewardResult } from "./reward.ts";
import { AgentRewardEngine } from "./reward.ts";

export type LabGameType = "debate" | "puzzle" | "prediction" | "red-team" | "optimization";
export type LabAcceptanceCriterionKind = "answer-present" | "evidence-present";

export type LabAcceptanceCriterion = Readonly<{
  id: string;
  description: string;
  kind: LabAcceptanceCriterionKind;
  weight: number;
}>;

export type LabChallengeProvenance = Readonly<{
  source: "template" | "adaptive";
  sourceReference?: string;
  createdBy: string;
  seed: string;
  createdAt: string;
}>;

export type LabChallenge = Readonly<{
  id: string;
  game: LabGameType;
  title: string;
  objective: string;
  rules: readonly string[];
  acceptanceCriteria: readonly LabAcceptanceCriterion[];
  difficulty: number;
  createdBy: string;
  createdAt: string;
  seed: string;
  provenance: LabChallengeProvenance;
}>;

export type LabSubmission = Readonly<{
  challengeId: string;
  agentId: string;
  answer: string;
  evidence?: readonly string[];
  score?: number;
}>;

export type LabCriterionResult = Readonly<{
  criterionId: string;
  passed: boolean;
  evidence: readonly string[];
}>;

export type LabEvaluation = Readonly<{
  score: number;
  accepted: boolean;
  criterionResults: readonly LabCriterionResult[];
}>;

export type LabResult = Readonly<{
  challenge: LabChallenge;
  submissions: readonly LabSubmission[];
  evaluations: Readonly<Record<string, LabEvaluation>>;
  rewards: Readonly<Record<string, RewardResult>>;
  winnerIds: readonly string[];
  nextChallengeCreatorIds: readonly string[];
}>;

export type LabIsolationPolicy = Readonly<{
  repositoryAccess: false;
  productionExecution: false;
  humanCommandRequired: false;
  networkWriteAccess: false;
  allowedMemory: "lab-only";
}>;

export const DEFAULT_LAB_ISOLATION: LabIsolationPolicy = Object.freeze({
  repositoryAccess: false,
  productionExecution: false,
  humanCommandRequired: false,
  networkWriteAccess: false,
  allowedMemory: "lab-only",
});

export interface AgentLabParticipant {
  readonly id: string;
  propose(challenge: LabChallenge): Promise<LabSubmission>;
}

export interface LabChallengeFactory {
  create(
    game: LabGameType,
    seed: string,
    creatorId: string,
    difficulty?: number,
    provenance?: LabChallengeProvenance,
  ): LabChallenge;
}

const CRITERIA: Readonly<Record<LabGameType, readonly LabAcceptanceCriterion[]>> = Object.freeze({
  debate: Object.freeze([
    Object.freeze({ id: "answer-present", description: "A substantive answer is provided.", kind: "answer-present", weight: 0.5 }),
    Object.freeze({ id: "evidence-present", description: "At least one evidence item supports the claim.", kind: "evidence-present", weight: 0.5 }),
  ]),
  puzzle: Object.freeze([
    Object.freeze({ id: "answer-present", description: "A solution is provided.", kind: "answer-present", weight: 0.5 }),
    Object.freeze({ id: "evidence-present", description: "The decisive reasoning/evidence is exposed.", kind: "evidence-present", weight: 0.5 }),
  ]),
  prediction: Object.freeze([
    Object.freeze({ id: "answer-present", description: "A prediction is provided.", kind: "answer-present", weight: 0.5 }),
    Object.freeze({ id: "evidence-present", description: "Uncertainty/evidence is explicitly stated.", kind: "evidence-present", weight: 0.5 }),
  ]),
  "red-team": Object.freeze([
    Object.freeze({ id: "answer-present", description: "A concrete finding is provided.", kind: "answer-present", weight: 0.5 }),
    Object.freeze({ id: "evidence-present", description: "The finding has supporting evidence.", kind: "evidence-present", weight: 0.5 }),
  ]),
  optimization: Object.freeze([
    Object.freeze({ id: "answer-present", description: "An optimized solution is provided.", kind: "answer-present", weight: 0.5 }),
    Object.freeze({ id: "evidence-present", description: "The improvement has supporting evidence.", kind: "evidence-present", weight: 0.5 }),
  ]),
});

export class DefaultLabChallengeFactory implements LabChallengeFactory {
  create(
    game: LabGameType,
    seed: string,
    creatorId: string,
    difficulty = 0.5,
    provenance: LabChallengeProvenance = Object.freeze({
      source: "template",
      createdBy: creatorId,
      seed,
      createdAt: new Date().toISOString(),
    }),
  ): LabChallenge {
    const templates: Record<LabGameType, readonly [string, string, string[]]> = {
      debate: ["Evidence Duel", "Defend a claim, then identify the strongest counterargument.", ["Use explicit evidence.", "Do not invent sources.", "Attack the argument, not the participant."]],
      puzzle: ["Constraint Puzzle", "Solve a constrained reasoning problem and expose the key invariant.", ["State assumptions.", "Show the decisive reasoning step.", "No external side effects."]],
      prediction: ["Calibration Game", "Estimate an answer from incomplete information and state uncertainty.", ["Give a confidence estimate.", "Separate facts from assumptions.", "Prefer calibrated uncertainty over bluffing."]],
      "red-team": ["Failure Hunt", "Find a concrete failure mode in a deliberately flawed proposal.", ["Find only actionable defects.", "Distinguish verified from suspected defects.", "False positives reduce reward."]],
      optimization: ["Efficiency Arena", "Improve a solution while preserving its correctness constraints.", ["Preserve correctness.", "Explain the trade-offs.", "Prefer measurable improvements."]],
    };
    const [title, objective, rules] = templates[game];
    const normalizedDifficulty = Math.min(1, Math.max(0.1, difficulty));
    const createdAt = provenance.createdAt;
    return Object.freeze({
      id: `lab-${creatorId}-${seed}-${createdAt}`,
      game,
      title,
      objective: `${objective} Difficulty=${normalizedDifficulty.toFixed(2)}.`,
      rules: Object.freeze([...rules]),
      acceptanceCriteria: CRITERIA[game],
      difficulty: normalizedDifficulty,
      createdBy: creatorId,
      createdAt,
      seed,
      provenance: Object.freeze({ ...provenance }),
    });
  }
}

export type LabIdleGate = () => boolean;

export interface LabScorer {
  evaluate(challenge: LabChallenge, submission: LabSubmission): LabEvaluation;
}

export class ObjectiveLabScorer implements LabScorer {
  evaluate(challenge: LabChallenge, submission: LabSubmission): LabEvaluation {
    const evidence = Object.freeze(submission.evidence ?? []);
    const criterionResults = challenge.acceptanceCriteria.map((criterion) => {
      const passed = criterion.kind === "answer-present"
        ? submission.answer.trim().length > 0
        : evidence.length > 0;
      return Object.freeze({
        criterionId: criterion.id,
        passed,
        evidence: Object.freeze(passed ? [criterion.description] : []),
      });
    });
    const totalWeight = challenge.acceptanceCriteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    const weightedScore = totalWeight > 0
      ? criterionResults.reduce((sum, result) => {
        const criterion = challenge.acceptanceCriteria.find((item) => item.id === result.criterionId);
        return sum + (result.passed ? criterion?.weight ?? 0 : 0);
      }, 0) / totalWeight
      : 0;
    return Object.freeze({
      score: Math.round(weightedScore * 100),
      accepted: criterionResults.every((result) => result.passed),
      criterionResults: Object.freeze(criterionResults),
    });
  }
}

export class AgentLearningLab {
  readonly isolation: LabIsolationPolicy = DEFAULT_LAB_ISOLATION;
  private readonly participants = new Map<string, AgentLabParticipant>();
  private readonly history: LabResult[] = [];

  constructor(
    private readonly factory: LabChallengeFactory = new DefaultLabChallengeFactory(),
    private readonly rewardEngine: AgentRewardEngine = new AgentRewardEngine(),
    private readonly idleGate: LabIdleGate = () => true,
    private readonly scorer: LabScorer = new ObjectiveLabScorer(),
  ) {}

  register(participant: AgentLabParticipant): void {
    if (!participant.id.trim()) throw new Error("LAB_AGENT_ID_REQUIRED");
    if (this.participants.has(participant.id)) throw new Error(`LAB_AGENT_ALREADY_REGISTERED:${participant.id}`);
    this.participants.set(participant.id, participant);
  }

  listParticipants(): readonly string[] {
    return Object.freeze([...this.participants.keys()]);
  }

  canCreateNextChallenge(agentId: string): boolean {
    const latest = this.history[this.history.length - 1];
    return Boolean(latest?.nextChallengeCreatorIds.includes(agentId));
  }

  createNextChallenge(agentId: string, game: LabGameType, seed: string): LabChallenge {
    if (!this.canCreateNextChallenge(agentId)) throw new Error("LAB_CHALLENGE_CREATOR_NOT_AUTHORIZED");
    const latest = this.history[this.history.length - 1];
    const previousDifficulty = latest?.challenge.difficulty ?? 0.5;
    const difficulty = Math.min(1, previousDifficulty + 0.1);
    const createdAt = new Date().toISOString();
    return this.factory.create(game, seed, agentId, difficulty, Object.freeze({
      source: "adaptive",
      sourceReference: latest?.challenge.id,
      createdBy: agentId,
      seed,
      createdAt,
    }));
  }

  historyResults(): readonly LabResult[] {
    return Object.freeze([...this.history]);
  }

  async runChallenge(game: LabGameType, creatorId: string, seed: string): Promise<LabResult> {
    if (!this.idleGate()) throw new Error("LAB_REQUIRES_IDLE_NETWORK");
    if (this.participants.size < 2) throw new Error("LAB_REQUIRES_TWO_AGENTS");
    if (!this.participants.has(creatorId)) throw new Error("LAB_CREATOR_NOT_REGISTERED");

    const createdAt = new Date().toISOString();
    const challenge = this.factory.create(game, seed, creatorId, 0.5, Object.freeze({
      source: "template",
      createdBy: creatorId,
      seed,
      createdAt,
    }));

    const submissions = await Promise.all(
      [...this.participants.values()].map((participant) => participant.propose(challenge)),
    );

    for (const submission of submissions) {
      if (submission.challengeId !== challenge.id) throw new Error("LAB_CHALLENGE_ID_MISMATCH");
      if (!this.participants.has(submission.agentId)) throw new Error("LAB_UNKNOWN_SUBMITTER");
    }

    const evaluations: Record<string, LabEvaluation> = {};
    const rewards: Record<string, RewardResult> = {};
    for (const submission of submissions) {
      const evaluation = this.scorer.evaluate(challenge, submission);
      evaluations[submission.agentId] = evaluation;
      const passedCriteria = evaluation.criterionResults.filter((result) => result.passed).length;
      const failedCriteria = evaluation.criterionResults.length - passedCriteria;
      rewards[submission.agentId] = this.rewardEngine.calculate({
        testsPassed: passedCriteria,
        testsFailed: failedCriteria,
        requiredArtifacts: challenge.acceptanceCriteria.map((criterion) => criterion.id),
        completedArtifacts: evaluation.criterionResults.filter((result) => result.passed).map((result) => result.criterionId),
        evidenceVerified: evaluation.accepted,
        outOfScopeActions: 0,
        delegatedTasks: 0,
      });
    }

    const best = Math.max(...Object.values(rewards).map((reward) => reward.score));
    const winnerIds = Object.entries(rewards).filter(([, reward]) => reward.score === best).map(([id]) => id);
    const result = Object.freeze({
      challenge,
      submissions: Object.freeze(submissions),
      evaluations: Object.freeze(evaluations),
      rewards: Object.freeze(rewards),
      winnerIds: Object.freeze(winnerIds),
      nextChallengeCreatorIds: Object.freeze(winnerIds),
    });
    this.history.push(result);
    return result;
  }
}

export const createLabParticipant = (
  worker: AgentWorker,
): AgentLabParticipant => Object.freeze({
  id: worker.id,
  async propose(challenge: LabChallenge) {
    const report = await worker.run(Object.freeze({
      stepId: `lab:${challenge.id}:${worker.id}`,
      commandId: `LAB:${challenge.id}`,
      role: worker.id,
      objective: challenge.objective,
      constraints: challenge.rules,
      context: Object.freeze({
        labOnly: true,
        repositoryAccess: false,
        productionExecution: false,
        humanCommandRequired: false,
        challenge,
      }),
    }));
    return Object.freeze({
      challengeId: challenge.id,
      agentId: worker.id,
      answer: report.summary,
      evidence: report.evidence ? [JSON.stringify(report.evidence)] : [],
    });
  },
});
