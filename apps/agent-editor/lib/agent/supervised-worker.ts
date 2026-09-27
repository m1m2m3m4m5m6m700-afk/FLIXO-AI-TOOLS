import type { AgentInstruction, AgentReport, AgentWorker } from "@flixo/agent-orchestrator";
import type { ToolRegistry } from "./registry";

type ToolExecutionContext = Readonly<{
  execution?: Readonly<{ toolId: string; parameters: Readonly<Record<string, unknown>> }>;
}>;

export type ToolBackedWorkerOptions = Readonly<{
  role: string;
  toolRegistry: ToolRegistry;
  allowedToolIds: readonly string[];
}>;

export const createToolBackedWorker = (options: ToolBackedWorkerOptions): AgentWorker => {
  if (!options.role.trim()) throw new Error("SUPERVISED_WORKER_ROLE_REQUIRED");
  if (!options.allowedToolIds.length) throw new Error("SUPERVISED_WORKER_ALLOWLIST_REQUIRED");

  return Object.freeze({
    id: options.role,
    async run(instruction: AgentInstruction): Promise<AgentReport> {
      const execution = (instruction.context as ToolExecutionContext).execution;
      if (!execution) {
        return Object.freeze({
          stepId: instruction.stepId,
          commandId: instruction.commandId,
          status: "blocked",
          summary: "No supervised tool execution was attached to the instruction.",
        });
      }
      if (!options.allowedToolIds.includes(execution.toolId)) {
        return Object.freeze({
          stepId: instruction.stepId,
          commandId: instruction.commandId,
          status: "blocked",
          summary: `Tool '${execution.toolId}' is outside this worker's allowlist.`,
          evidence: { toolId: execution.toolId, outOfScopeActions: 1, delegatedTasks: 0, evidenceVerified: false },
        });
      }

      const result = await options.toolRegistry.execute(
        `${instruction.commandId}:${instruction.stepId}`,
        execution.toolId,
        execution.parameters,
      );

      if (result.status === "success") {
        return Object.freeze({
          stepId: instruction.stepId,
          commandId: instruction.commandId,
          status: "completed",
          summary: `Tool '${execution.toolId}' executed through the canonical ToolRegistry.`,
          evidence: {
            toolId: execution.toolId,
            toolResult: result.data ?? {},
            requiredArtifacts: [execution.toolId],
            completedArtifacts: [execution.toolId],
            testsPassed: 0,
            testsFailed: 0,
            evidenceVerified: false,
            outOfScopeActions: 0,
            delegatedTasks: 0,
          },
        });
      }

      return Object.freeze({
        stepId: instruction.stepId,
        commandId: instruction.commandId,
        status: "failed",
        summary: result.errorDetails ?? `Tool '${execution.toolId}' failed.`,
        evidence: {
          toolId: execution.toolId,
          testsPassed: 0,
          testsFailed: 1,
          evidenceVerified: false,
          outOfScopeActions: 0,
          delegatedTasks: 0,
          notes: result.errorDetails ?? "TOOL_EXECUTION_FAILED" ?? "TOOL_EXECUTION_FAILED",
        },
      });
    },
  });
};
