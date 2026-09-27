import { AgentCapability, AgentHeartbeat, AgentNetworkControlPlane, AgentNetworkSnapshot, AgentPermission, DEFAULT_AGENT_NETWORK, type AgentAuditSink } from "./network.ts";
import { AdversarialTwinWorker } from "./adversarial.ts";
import { RedTeamWorker } from "./red-team.ts";
import { AgentCognitiveLedger, FailureIntelligence, ConfidenceCalibrator } from "./cognitive.ts";
import type { EvaluationEvidence } from "./evaluation.ts";
import { ObjectiveVerifier } from "./objective-verifier.ts";
export * from "./network.ts";
export * from "./evaluation.ts";

const MAX_PLAN_STEPS = 32;

export type CommandAuthority = Readonly<{
  commandId: string;
  issuedBy: "human" | "system";
  issuedAt: string;
}>;

export type AgentInstruction = Readonly<{
  stepId: string;
  commandId: string;
  role: string;
  objective: string;
  constraints: readonly string[];
  context: Readonly<Record<string, unknown>>;
}>;

export type AgentStep = Readonly<{
  stepId: string;
  role: string;
  objective: string;
  dependsOn: readonly string[];
  constraints: readonly string[];
  requiredCapabilities?: readonly AgentCapability[];
  requiredPermissions?: readonly AgentPermission[];
  execution?: Readonly<{ toolId: string; parameters: Readonly<Record<string, unknown>> }>;
}>;

export type AgentPlan = Readonly<{
  commandId: string;
  objective: string;
  steps: readonly AgentStep[];
}>;

export type AgentReport = Readonly<{
  stepId: string;
  commandId: string;
  status: "completed" | "failed" | "blocked";
  summary: string;
  evidence?: Readonly<Record<string, unknown>>;
  verification?: import("@flixo/contracts").ObjectiveVerificationContract;
}>;

export interface AgentWorker {
  readonly id: string;
  run(instruction: AgentInstruction): Promise<AgentReport>;
}

export type AgentAdapterFactory = (descriptor: Readonly<{ id: string; role: string }>) => AgentWorker;

export const createSupervisedWorker = (
  descriptor: Readonly<{ id: string; role: string }>,
  execute: (instruction: AgentInstruction) => Promise<AgentReport>,
): AgentWorker => Object.freeze({
  id: descriptor.role,
  run: execute,
});

export interface AgentPlanner {
  plan(command: CommandAuthority, objective: string): Promise<AgentPlan>;
}

export interface AgentObserver {
  onDispatch(instruction: AgentInstruction): void;
  onReport(report: AgentReport): void | Promise<void>;
}

export class DirectCommandOrchestrator {
  private activeCommandId: string | null = null;
  private readonly workers = new Map<string, AgentWorker>();
  private readonly adversarialRoles = new Set<string>();
  private readonly objectiveVerifier = new ObjectiveVerifier();

  constructor(
    private readonly planner: AgentPlanner,
    private readonly observer: AgentObserver = {
      onDispatch: () => undefined,
      onReport: () => undefined,
    },
    private readonly network = new AgentNetworkControlPlane(),
    private readonly cognitiveLedger = new AgentCognitiveLedger(),
    private readonly failureIntelligence = new FailureIntelligence(),
    private readonly confidenceCalibrator = new ConfidenceCalibrator(),
    private readonly auditSink?: AgentAuditSink,
  ) {}

  registerWorker(worker: AgentWorker): void {
    if (!worker.id.trim()) throw new Error("WORKER_ID_REQUIRED");
    if (this.workers.has(worker.id)) throw new Error(`WORKER_ALREADY_REGISTERED:${worker.id}`);
    this.workers.set(worker.id, worker);
  }

  registerAdversarialWorker(role: string, worker: AgentWorker): void {
    if (!role.trim()) throw new Error("ADVERSARIAL_ROLE_REQUIRED");
    if (this.adversarialRoles.has(role)) throw new Error(`ADVERSARIAL_ALREADY_REGISTERED:${role}`);
    if (worker.id !== role) throw new Error("ADVERSARIAL_ROLE_ID_MISMATCH");
    this.workers.set(role, worker);
    this.adversarialRoles.add(role);
  }

  enableDefaultRedTeam(invoker: import("./model-adapter.ts").AgentModelInvoker): void {
    if (!this.workers.has("red-team")) this.registerWorker(new RedTeamWorker(invoker));
  }

  enableDefaultAdversarialMode(invoker: import("./model-adapter.ts").AgentModelInvoker): void {
    for (const descriptor of DEFAULT_AGENT_NETWORK) {
      if (!this.adversarialRoles.has(descriptor.role)) {
        this.registerAdversarialWorker(
          descriptor.role,
          new AdversarialTwinWorker({ id: descriptor.id, role: descriptor.role }, { invoker }),
        );
      }
    }
  }

  async dispatch(command: CommandAuthority, objective: string): Promise<readonly AgentReport[]> {
    if (!command.commandId.trim()) throw new Error("COMMAND_ID_REQUIRED");
    if (command.issuedBy !== "human") throw new Error("DIRECT_HUMAN_COMMAND_REQUIRED");
    if (this.activeCommandId !== null) throw new Error("COMMAND_ALREADY_ACTIVE");

    this.activeCommandId = command.commandId;
    let networkStarted = false;
    let commandOutcome: "completed" | "failed" = "failed";
    try {
      this.network.begin(command.commandId, command.issuedBy);
      networkStarted = true;
      await this.persistLatestAuditEvent();
      const plan = await this.planner.plan(command, objective);
      this.assertPlan(plan, command);

      const reports = new Map<string, AgentReport>();
      const pending = new Map(plan.steps.map((step) => [step.stepId, step]));

      while (pending.size) {
        const ready = [...pending.values()].filter((step) =>
          step.dependsOn.every((dependency) => reports.get(dependency)?.status === "completed"),
        );

        const blocked = [...pending.values()].filter((step) =>
          step.dependsOn.some((dependency) => {
            const report = reports.get(dependency);
            return report?.status === "failed" || report?.status === "blocked";
          }),
        );

        for (const step of blocked) {
          const report: AgentReport = Object.freeze({
            stepId: step.stepId,
            commandId: command.commandId,
            status: "blocked",
            summary: "Dependency failed or was blocked.",
          });
          reports.set(step.stepId, report);
          pending.delete(step.stepId);
          const verifiedReport = this.verifyReport(report, step.role);
          await this.observer.onReport(verifiedReport);
          this.cognitiveLedger.observe(verifiedReport.commandId, verifiedReport.stepId, step.role, verifiedReport.summary);
          const evaluationEvidence = verifiedReport.evidence as EvaluationEvidence | undefined;
          if (evaluationEvidence) {
            const verified = verifiedReport.verification?.status === "verified";
            this.failureIntelligence.classify(report.commandId, report.stepId, step.role, evaluationEvidence);
            const state = this.cognitiveLedger.snapshot().states.find((item) => item.commandId === report.commandId && item.stepId === report.stepId);
            this.confidenceCalibrator.record(step.role, state?.confidence ?? 0.5, verified);
          }
        }

        if (!ready.length) {
          if (pending.size) throw new Error("PLAN_DEPENDENCY_DEADLOCK");
          break;
        }

        const batch = await Promise.allSettled(ready.map(async (step) => {
          const requiredCapabilities = step.requiredCapabilities ?? [];
          const requiredPermissions = step.requiredPermissions ?? [];
          this.network.authorize(step.stepId, command.commandId, step.role, requiredCapabilities, requiredPermissions);
          await this.persistLatestAuditEvent();
          const worker = this.workers.get(step.role);
          if (!worker) {
            const report: AgentReport = Object.freeze({
              stepId: step.stepId,
              commandId: command.commandId,
              status: "failed",
              summary: `No worker registered for role: ${step.role}`,
              evidence: { testsPassed: 0, testsFailed: 1, evidenceVerified: false, outOfScopeActions: 0, delegatedTasks: 0, notes: "WORKER_NOT_REGISTERED" },
            });
            this.network.report(command.commandId, step.stepId, step.role, report.status, report.summary);
            await this.persistLatestAuditEvent();
            await this.observer.onReport(report);
            return report;
          }

          const instruction: AgentInstruction = Object.freeze({
            stepId: step.stepId,
            commandId: command.commandId,
            role: step.role,
            objective: step.objective,
            constraints: step.constraints,
            context: Object.freeze({ objective: plan.objective, ...(step.execution ? { execution: step.execution } : {}) }),
          });

          this.observer.onDispatch(instruction);
          this.cognitiveLedger.upsertState({
            commandId: instruction.commandId,
            stepId: instruction.stepId,
            agentId: instruction.role,
            goal: instruction.objective,
            hypotheses: [],
            assumptions: instruction.constraints,
            plannedActions: [],
            observations: [],
            evidence: [],
            uncertainties: [],
            detectedRisks: [],
            rejectedApproaches: [],
            confidence: 0.5,
            verificationState: "pending",
          });
          let rawReport: AgentReport;
          try {
            rawReport = await worker.run(instruction);
          } catch (error) {
            rawReport = Object.freeze({
              stepId: step.stepId,
              commandId: command.commandId,
              status: "failed" as const,
              summary: `Worker '${step.role}' threw before producing a report.`,
              evidence: {
                testsPassed: 0,
                testsFailed: 1,
                evidenceVerified: false,
                outOfScopeActions: 0,
                delegatedTasks: 0,
                notes: error instanceof Error ? error.name : "UNKNOWN_WORKER_ERROR",
              },
            });
          }
          if (rawReport.commandId !== command.commandId || rawReport.stepId !== step.stepId) {
            throw new Error("WORKER_REPORT_IDENTITY_MISMATCH");
          }
          const report = this.verifyReport(rawReport, step.role);
          this.network.report(command.commandId, step.stepId, step.role, report.status, report.summary);
          await this.persistLatestAuditEvent();
          await this.observer.onReport(report);
          this.cognitiveLedger.observe(report.commandId, report.stepId, step.role, report.summary);
          const currentState = this.cognitiveLedger.snapshot().states.find((item) => item.commandId === report.commandId && item.stepId === report.stepId);
          this.cognitiveLedger.upsertState({ commandId: report.commandId, stepId: report.stepId, agentId: step.role, goal: currentState?.goal ?? step.objective, hypotheses: currentState?.hypotheses ?? [], assumptions: currentState?.assumptions ?? step.constraints, plannedActions: currentState?.plannedActions ?? [], observations: currentState?.observations ?? [report.summary], evidence: currentState?.evidence ?? [], uncertainties: currentState?.uncertainties ?? [], detectedRisks: currentState?.detectedRisks ?? [], rejectedApproaches: currentState?.rejectedApproaches ?? [], confidence: currentState?.confidence ?? 0.5, verificationState: report.verification?.status ?? "unresolved" });
          const evaluationEvidence = report.evidence as EvaluationEvidence | undefined;
          if (evaluationEvidence) {
            const verified = report.verification?.status === "verified";
            this.failureIntelligence.classify(report.commandId, report.stepId, step.role, evaluationEvidence);
            const state = this.cognitiveLedger.snapshot().states.find((item) => item.commandId === report.commandId && item.stepId === report.stepId);
            this.confidenceCalibrator.record(step.role, state?.confidence ?? 0.5, verified);
          }
          return report;
        }));

        const rejectedBatch = batch.find((result) => result.status === "rejected");
        if (rejectedBatch) throw rejectedBatch.reason;
        const completedBatch = batch.map((result) => {
          if (result.status !== "fulfilled") throw result.reason;
          return result.value;
        });
        for (const report of completedBatch) {
          reports.set(report.stepId, report);
          pending.delete(report.stepId);
        }
      }

      const finalReports = Object.freeze([...reports.values()]);
      commandOutcome = finalReports.every((report) => report.status === "completed" && report.verification?.status === "verified")
        ? "completed"
        : "failed";
      return finalReports;
    } finally {
      try {
        if (networkStarted && this.auditSink) {
          const snapshot = this.network.snapshot();
          await this.auditSink.persist(snapshot.events);
          await this.auditSink.finalize(commandOutcome, snapshot.events);
        }
      } finally {
        try {
          if (networkStarted) this.network.end(command.commandId);
        } finally {
          this.activeCommandId = null;
        }
      }
    }
  }

  async heartbeat(heartbeat: AgentHeartbeat): Promise<void> {
    this.network.heartbeat(heartbeat);
    await this.persistLatestAuditEvent();
  }

  private async persistLatestAuditEvent(): Promise<void> {
    if (!this.auditSink) return;
    const events = this.network.snapshot().events;
    const latest = events.at(-1);
    if (latest) await this.auditSink.persist(Object.freeze([latest]));
  }

  snapshot(): AgentNetworkSnapshot {
    return this.network.snapshot();
  }

  failureRecords(agentId?: string) { return this.failureIntelligence.list(agentId); }

  confidenceProfile(agentId: string) { return this.confidenceCalibrator.summarize(agentId); }

  cognitiveSnapshot(): import("./cognitive.ts").AgentCognitiveSnapshot {
    return this.cognitiveLedger.snapshot();
  }

  private verifyReport(report: AgentReport, agentId: string): AgentReport {
    const evidence = (report.evidence ?? {}) as EvaluationEvidence;
    const verification = this.objectiveVerifier.verify({ id: `${report.commandId}:${report.stepId}`, commandId: report.commandId, stepId: report.stepId, agentId, evidence });
    return Object.freeze({ ...report, verification });
  }

  private assertPlan(plan: AgentPlan, command: CommandAuthority): void {
    if (plan.commandId !== command.commandId) throw new Error("PLAN_COMMAND_ID_MISMATCH");
    if (!plan.steps.length) throw new Error("EMPTY_AGENT_PLAN");
    if (plan.steps.length > MAX_PLAN_STEPS) throw new Error("PLAN_STEP_LIMIT_EXCEEDED");
    const ids = new Set<string>();
    for (const step of plan.steps) {
      if (!step.stepId.trim()) throw new Error("STEP_ID_REQUIRED");
      if (ids.has(step.stepId)) throw new Error(`DUPLICATE_STEP_ID:${step.stepId}`);
      ids.add(step.stepId);
      if (!step.role.trim()) throw new Error(`EMPTY_STEP_ROLE:${step.stepId}`);
      if (!step.objective.trim()) throw new Error(`EMPTY_STEP_OBJECTIVE:${step.stepId}`);
      if (!Array.isArray(step.dependsOn) || !Array.isArray(step.constraints)) throw new Error(`INVALID_STEP_CONTRACT:${step.stepId}`);
      const dependencies = new Set(step.dependsOn);
      if (dependencies.size !== step.dependsOn.length) throw new Error(`DUPLICATE_DEPENDENCY:${step.stepId}`);
      if (dependencies.has(step.stepId)) throw new Error(`SELF_DEPENDENCY:${step.stepId}`);
      if (step.execution && (
        !step.execution.toolId.trim()
        || !(step.requiredPermissions ?? []).includes("execute")
      )) {
        throw new Error(`EXECUTION_PERMISSION_REQUIRED:${step.stepId}`);
      }
    }
    const byId = new Map(plan.steps.map((step) => [step.stepId, step]));
    for (const step of plan.steps) {
      for (const dependency of step.dependsOn) {
        if (!byId.has(dependency)) throw new Error(`UNKNOWN_DEPENDENCY:${step.stepId}:${dependency}`);
      }
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (stepId: string): void => {
      if (visited.has(stepId)) return;
      if (visiting.has(stepId)) throw new Error("PLAN_DEPENDENCY_CYCLE");
      visiting.add(stepId);
      for (const dependency of byId.get(stepId)?.dependsOn ?? []) visit(dependency);
      visiting.delete(stepId);
      visited.add(stepId);
    };
    for (const step of plan.steps) visit(step.stepId);
  }
}

export * from "./reward.ts";
export * from "./experience.ts";
export * from "./learning.ts";
export * from "./agent-profiles.ts";
export * from "./model-adapter.ts";
export * from "./continual-learning.ts";
export * from "./http-model-invoker.ts";
export * from "./adversarial.ts";
export * from "./red-team.ts";
export * from "./agent-learning-lab.ts";

export * from "./cognitive.ts";
export * from "./objective-verifier.ts";

export * from "./evolution-governor.ts";
