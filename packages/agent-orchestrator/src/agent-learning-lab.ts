import type { AgentReport, AgentWorker } from "./index.ts";
import type { AgentRewardEngine, RewardResult } from "./reward.ts";
import { AgentRewardEngine as DefaultRewardEngine } from "./reward.ts";

export type LabGameType = "debate" | "puzzle" | "prediction" | "red-team" | "optimization";

export type LabChallenge = Readonly<{
  id: string;
  game: LabGameType;
  title: string;
  objective: string;
  rules: readonly string[];
  createdBy: string;
  createdAt: string;
  seed: string;
}>;

export type LabSubmission = Readonly<{
  challengeId: string;
  agentId: string;
  answer: string;
  evidence?: readonly string[];
  score?: number;
}>;

export type LabResult = Readonly<{
  challenge: LabChallenge;
  submissions: readonly LabSubmission[];
  rewards: Readonly<Record<string, RewardResult>>;
  winnerIds: readonly string[];
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
  create(game: LabGameType, seed: string, creatorId: string): LabChallenge;
}

export class DefaultLabChallengeFactory implements LabChallengeFactory {
  create(game: LabGameType, seed: string, creatorId: string): LabChallenge {
    const templates: Record<LabGameType, [string, string, string[]]> = {
      debate: ["Evidence Duel", "Defend a claim, then identify the strongest counterargument.", ["Use explicit evidence.", "Do not invent sources.", "Attack the argument, not the participant."]],
      puzzle: ["Constraint Puzzle", "Solve a constrained reasoning problem and expose the key invariant.", ["State assumptions.", "Show the decisive reasoning step.", "No external side effects."]],
      prediction: ["Calibration Game", "Estimate an answer from incomplete information and state uncertainty.", ["Give a confidence estimate.", "Separate facts from assumptions.", "Prefer calibrated uncertainty over bluffing."]],
      "red-team": ["Failure Hunt", "Find a concrete failure mode in a deliberately flawed proposal.", ["Find only actionable defects.", "Distinguish verified from suspected defects.", "False positives reduce reward."]],
      optimization: ["Efficiency Arena", "Improve a solution while preserving its correctness constraints.", ["Preserve correctness.", "Explain the trade-offs.", "Prefer measurable improvements."]],
    };
    const [title, objective, rules] = templates[game];
    return Object.freeze({
      id: `lab-${creatorId}-${Date.now()}-${seed}`,
      game, title, objective, rules: Object.freeze([...rules]),
      createdBy: creatorId, createdAt: new Date().toISOString(), seed,
    });
  }
}

export type LabIdleGate = () => boolean;\n\nexport class AgentLearningLab {
  readonly isolation: LabIsolationPolicy = DEFAULT_LAB_ISOLATION;
  private readonly participants = new Map<string, AgentLabParticipant>();
  private readonly history: LabResult[] = [];

  constructor(
    private readonly factory: LabChallengeFactory = new DefaultLabChallengeFactory(),
    private readonly rewardEngine: AgentRewardEngine = new DefaultRewardEngine(),
  ) {}

  register(participant: AgentLabParticipant): void {
    if (!participant.id.trim()) throw new Error("LAB_AGENT_ID_REQUIRED");
    if (this.participants.has(participant.id)) throw new Error(`LAB_AGENT_ALREADY_REGISTERED:${participant.id}`);
    this.participants.set(participant.id, participant);
  }

  listParticipants(): readonly string[] {
    return Object.freeze([...this.participants.keys()]);
  }

  historyResults(): readonly LabResult[] {
    return Object.freeze([...this.history]);
  }

  async runChallenge(game: LabGameType, creatorId: string, seed: string): Promise<LabResult> {
    if (this.participants.size < 2) throw new Error("LAB_REQUIRES_TWO_AGENTS");
    if (!this.participants.has(creatorId)) throw new Error("LAB_CREATOR_NOT_REGISTERED");

    const challenge = this.factory.create(game, seed, creatorId);
    const submissions = await Promise.all(
      [...this.participants.values()].map((participant) => participant.propose(challenge)),
    );

    for (const submission of submissions) {
      if (submission.challengeId !== challenge.id) throw new Error("LAB_CHALLENGE_ID_MISMATCH");
      if (!this.participants.has(submission.agentId)) throw new Error("LAB_UNKNOWN_SUBMITTER");
      if (!Number.isFinite(submission.score ?? 0)) throw new Error("LAB_INVALID_SCORE");
    }

    const rewards: Record<string, RewardResult> = {};
    for (const submission of submissions) {
      rewards[submission.agentId] = this.rewardEngine.calculate({
        correctness: Math.max(0, Math.min(1, (submission.score ?? 0) / 100)),
        verification: submission.evidence?.length ? 1 : 0,
        quality: Math.max(0, Math.min(1, (submission.answer.length || 0) / 500)),
        evidence: submission.evidence?.length ? 1 : 0,
        efficiency: 1,
        policyDiscipline: 1,
      });
    }

    const best = Math.max(...Object.values(rewards).map((reward) => reward.score));
    const winnerIds = Object.entries(rewards).filter(([, reward]) => reward.score === best).map(([id]) => id);
    const result = Object.freeze({
      challenge,
      submissions: Object.freeze(submissions),
      rewards: Object.freeze(rewards),
      winnerIds: Object.freeze(winnerIds),
    });
    this.history.push(result);
    return result;
  }
}

export const createLabParticipant = (
  worker: AgentWorker,
  score: (report: AgentReport) => number = (report) => report.status === "completed" ? 80 : 20,
): AgentLabParticipant => Object.freeze({
  id: worker.id,
  async propose(challenge) {
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
      score: score(report),
    });
  },
});
