import type {
  EvolutionBenchmarkContract,
  EvolutionPromotionContract,
  EvolutionProposalContract,
  EvolutionProposalStatus,
  EvolutionMutationPlanContract,
  ObjectiveVerificationContract,
} from "@flixo/contracts";

export interface EvolutionAuditSink {
  persist(event: "proposed" | "benchmarked" | "awaiting_human_approval" | "approved" | "applied" | "rolled_back", proposal: EvolutionProposalContract): Promise<void>;
}

export type EvolutionProposalInput = Readonly<{
  id: string;
  commandId: string;
  agentId: string;
  target: string;
  summary: string;
  baseRevision: string;
  objectiveVerification: ObjectiveVerificationContract;
  mutationPlan: EvolutionMutationPlanContract;
}>;

const now = (): string => new Date().toISOString();

export class EvolutionGovernor {
  private readonly proposals = new Map<string, EvolutionProposalContract>();

  constructor(private readonly auditSink?: EvolutionAuditSink) {}

  async propose(input: EvolutionProposalInput): Promise<EvolutionProposalContract> {
    for (const value of [input.id, input.commandId, input.agentId, input.target, input.summary, input.baseRevision, input.objectiveVerification.id, input.mutationPlan.sandboxId]) {
      if (!value.trim()) throw new Error("EVOLUTION_PROPOSAL_FIELDS_REQUIRED");
    }
    if (this.proposals.has(input.id)) throw new Error("EVOLUTION_PROPOSAL_ALREADY_EXISTS");
    this.validateMutationPlan(input.mutationPlan);
    const timestamp = now();
    const proposal: EvolutionProposalContract = Object.freeze({
      id: input.id,
      commandId: input.commandId,
      agentId: input.agentId,
      target: input.target,
      summary: input.summary,
      baseRevision: input.baseRevision,
      status: "proposed",
      objectiveVerificationId: input.objectiveVerification.id,
      objectiveVerificationStatus: input.objectiveVerification.status,
      mutationPlan: Object.freeze({ ...input.mutationPlan, targetPaths: Object.freeze([...input.mutationPlan.targetPaths]) }),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    if (this.auditSink) await this.auditSink.persist("proposed", proposal);
    this.proposals.set(proposal.id, proposal);
    return proposal;
  }

  async benchmark(
    proposalId: string,
    benchmark: Omit<EvolutionBenchmarkContract, "verifiedAt">,
  ): Promise<EvolutionProposalContract> {
    const proposal = this.require(proposalId);
    if (proposal.status !== "proposed" && proposal.status !== "benchmarked") throw new Error("EVOLUTION_INVALID_BENCHMARK_STATE");
    if (!Number.isFinite(benchmark.score) || !Number.isFinite(benchmark.threshold)) throw new Error("EVOLUTION_INVALID_BENCHMARK");
    const next: EvolutionProposalContract = Object.freeze({
      ...proposal,
      status: "benchmarked",
      benchmark: Object.freeze({ ...benchmark, verifiedAt: now() }),
      updatedAt: now(),
    });
    if (this.auditSink) await this.auditSink.persist("benchmarked", next);
    this.proposals.set(proposalId, next);
    return next;
  }

  async requestPromotion(proposalId: string): EvolutionProposalContract {
    const proposal = this.require(proposalId);
    if (proposal.status !== "benchmarked") throw new Error("EVOLUTION_REQUIRES_BENCHMARK");
    if (!proposal.benchmark?.passed || proposal.benchmark.score < proposal.benchmark.threshold) throw new Error("EVOLUTION_BENCHMARK_NOT_PASSED");
    if (proposal.objectiveVerificationStatus !== "verified") throw new Error("EVOLUTION_OBJECTIVE_NOT_VERIFIED");
    const next: EvolutionProposalContract = Object.freeze({ ...proposal, status: "awaiting_human_approval", updatedAt: now() });
    if (this.auditSink) await this.auditSink.persist("awaiting_human_approval", next);
    this.proposals.set(proposalId, next);
    return next;
  }

  async approve(promotion: EvolutionPromotionContract): Promise<EvolutionProposalContract> {
    if (promotion.action !== "approve" || promotion.approvedBy !== "human") throw new Error("EVOLUTION_HUMAN_APPROVAL_REQUIRED");
    const proposal = this.require(promotion.proposalId);
    if (proposal.status !== "awaiting_human_approval") throw new Error("EVOLUTION_NOT_AWAITING_APPROVAL");
    if (promotion.commandId !== proposal.commandId) throw new Error("EVOLUTION_COMMAND_ID_MISMATCH");
    const next: EvolutionProposalContract = Object.freeze({ ...proposal, status: "approved", updatedAt: promotion.approvedAt });
    if (this.auditSink) await this.auditSink.persist("approved", next);
    this.proposals.set(proposal.id, next);
    return next;
  }

  async recordApplied(proposalId: string, appliedRevision: string): Promise<EvolutionProposalContract> {
    const proposal = this.require(proposalId);
    if (proposal.status !== "approved") throw new Error("EVOLUTION_NOT_APPROVED");
    if (!appliedRevision.trim()) throw new Error("EVOLUTION_APPLIED_REVISION_REQUIRED");
    const next: EvolutionProposalContract = Object.freeze({ ...proposal, status: "applied", appliedRevision, updatedAt: now() });
    if (this.auditSink) await this.auditSink.persist("applied", next);
    this.proposals.set(proposal.id, next);
    return next;
  }

  async rollback(promotion: EvolutionPromotionContract, rollbackRevision: string): Promise<EvolutionProposalContract> {
    if (promotion.action !== "rollback" || promotion.approvedBy !== "human") throw new Error("EVOLUTION_HUMAN_ROLLBACK_REQUIRED");
    const proposal = this.require(promotion.proposalId);
    if (proposal.status !== "applied") throw new Error("EVOLUTION_NOT_APPLIED");
    if (promotion.commandId !== proposal.commandId) throw new Error("EVOLUTION_COMMAND_ID_MISMATCH");
    if (!rollbackRevision.trim()) throw new Error("EVOLUTION_ROLLBACK_REVISION_REQUIRED");
    const next: EvolutionProposalContract = Object.freeze({ ...proposal, status: "rolled_back", rollbackRevision, updatedAt: promotion.approvedAt });
    if (this.auditSink) await this.auditSink.persist("rolled_back", next);
    this.proposals.set(proposal.id, next);
    return next;
  }

  get(proposalId: string): EvolutionProposalContract {
    return this.require(proposalId);
  }

  list(): readonly EvolutionProposalContract[] {
    return Object.freeze([...this.proposals.values()]);
  }

  private validateMutationPlan(plan: EvolutionMutationPlanContract): void {
    if (plan.executionBoundary !== "sandbox-only" || plan.dryRun !== true) throw new Error("EVOLUTION_SANDBOX_ONLY_REQUIRED");
    if (!plan.sandboxId.trim() || plan.maxFiles < 1 || !Number.isInteger(plan.maxFiles)) throw new Error("EVOLUTION_INVALID_MUTATION_PLAN");
    if (plan.targetPaths.length > plan.maxFiles) throw new Error("EVOLUTION_MUTATION_FILE_LIMIT_EXCEEDED");
    for (const path of plan.targetPaths) {
      if (!path.trim() || path.startsWith("/") || path.includes("..") || path.startsWith(".git/")) throw new Error("EVOLUTION_UNSAFE_TARGET_PATH");
    }
  }

  private require(proposalId: string): EvolutionProposalContract {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error("EVOLUTION_PROPOSAL_NOT_FOUND:" + proposalId);
    return proposal;
  }
}

export type EvolutionProposalStatusValue = EvolutionProposalStatus;
