import { AgentCapability, AgentHeartbeat, AgentNetworkControlPlane, AgentNetworkSnapshot } from "./network.ts";
export * from "./network.ts";
export * from "./evaluation.ts";

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
  onReport(report: AgentReport): void;
}

export class DirectCommandOrchestrator {
  private activeCommandId: string | null = null;
  private readonly workers = new Map<string, AgentWorker>();

  constructor(
    private readonly planner: AgentPlanner,
    private readonly observer: AgentObserver = {
      onDispatch: () => undefined,
      onReport: () => undefined,
    },
    private readonly network = new AgentNetworkControlPlane(),
  ) {}

  registerWorker(worker: AgentWorker): void {
    if (!worker.id.trim()) throw new Error("WORKER_ID_REQUIRED");
    if (this.workers.has(worker.id)) throw new Error(`WORKER_ALREADY_REGISTERED:${worker.id}`);
    this.workers.set(worker.id, worker);
  }

  async dispatch(command: CommandAuthority, objective: string): Promise<readonly AgentReport[]> {
    if (!command.commandId.trim()) throw new Error("COMMAND_ID_REQUIRED");
    if (command.issuedBy !== "human") throw new Error("DIRECT_HUMAN_COMMAND_REQUIRED");
    if (this.activeCommandId !== null) throw new Error("COMMAND_ALREADY_ACTIVE");

    this.activeCommandId = command.commandId;
    this.network.begin(command.commandId, command.issuedBy);
    try {
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
          this.observer.onReport(report);
        }

        if (!ready.length) {
          if (pending.size) throw new Error("PLAN_DEPENDENCY_DEADLOCK");
          break;
        }

        const batch = await Promise.all(ready.map(async (step) => {
          const requiredCapabilities = step.requiredCapabilities ?? [];
          this.network.authorize(step.stepId, command.commandId, step.role, requiredCapabilities);
          const worker = this.workers.get(step.role);
          if (!worker) {
            const report: AgentReport = Object.freeze({
              stepId: step.stepId,
              commandId: command.commandId,
              status: "failed",
              summary: `No worker registered for role: ${step.role}`,
            });
            this.observer.onReport(report);
            return report;
          }

          const instruction: AgentInstruction = Object.freeze({
            stepId: step.stepId,
            commandId: command.commandId,
            role: step.role,
            objective: step.objective,
            constraints: step.constraints,
            context: Object.freeze({ objective: plan.objective }),
          });

          this.observer.onDispatch(instruction);
          const report = await worker.run(instruction);
          if (report.commandId !== command.commandId || report.stepId !== step.stepId) {
            throw new Error("WORKER_REPORT_IDENTITY_MISMATCH");
          }
          this.network.report(command.commandId, step.stepId, step.role, report.status, report.summary);
          this.observer.onReport(report);
          return report;
        }));

        for (const report of batch) {
          reports.set(report.stepId, report);
          pending.delete(report.stepId);
        }
      }

      return Object.freeze([...reports.values()]);
    } finally {
      this.network.end(command.commandId);
      this.activeCommandId = null;
    }
  }

  heartbeat(heartbeat: AgentHeartbeat): void {
    this.network.heartbeat(heartbeat);
  }

  snapshot(): AgentNetworkSnapshot {
    return this.network.snapshot();
  }

  private assertPlan(plan: AgentPlan, command: CommandAuthority): void {
    if (plan.commandId !== command.commandId) throw new Error("PLAN_COMMAND_ID_MISMATCH");
    if (!plan.steps.length) throw new Error("EMPTY_AGENT_PLAN");
    const ids = new Set<string>();
    for (const step of plan.steps) {
      if (ids.has(step.stepId)) throw new Error(`DUPLICATE_STEP_ID:${step.stepId}`);
      ids.add(step.stepId);
      if (!step.objective.trim()) throw new Error(`EMPTY_STEP_OBJECTIVE:${step.stepId}`);
    }
  }
}
