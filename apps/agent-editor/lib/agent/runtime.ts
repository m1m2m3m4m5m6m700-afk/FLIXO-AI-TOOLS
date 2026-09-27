import { AgentRuntime as CanonicalAgentRuntime } from "@flixo/agent-runtime";
import { z } from "zod";
import type { AgentResponse, ChatMessage, ToolCallRequest, ToolCallResult } from "../schemas/agent";
import { AgentResponseSchema } from "../schemas/agent";
import { ProjectStateSchema, type Layer, type ProjectState } from "../schemas/project";
import { simulateLLMReasoning } from "./mock-llm";
import type { ToolRegistry } from "./registry";

export const AgentRuntimeOptionsSchema = z.object({
  maxIterations: z.number().int().positive().max(20).default(5),
  useMockEngine: z.boolean().default(true),
});
export type AgentRuntimeOptions = z.input<typeof AgentRuntimeOptionsSchema>;

/**
 * Application orchestration adapter.
 * Lifecycle/state/execution authority is @flixo/agent-runtime.
 * Mock reasoning remains application-local and deterministic.
 */
export class AgentRuntime {
  private readonly maxIterations: number;
  private readonly useMockEngine: boolean;
  private readonly canonical: CanonicalAgentRuntime;

  constructor(
    private readonly registry: ToolRegistry,
    options: AgentRuntimeOptions = {},
    identity: Readonly<{ taskId?: string; traceId?: string }> = {},
  ) {
    const parsed = AgentRuntimeOptionsSchema.parse(options);
    this.maxIterations = parsed.maxIterations;
    this.useMockEngine = parsed.useMockEngine;
    this.canonical = new CanonicalAgentRuntime(
      registry.toRuntimeRegistry(),
      {
        taskId: identity.taskId ?? crypto.randomUUID(),
        traceId: identity.traceId ?? crypto.randomUUID(),
      },
    );
  }

  async processUserMessage(
    userMessage: string,
    history: readonly ChatMessage[],
    currentProjectState?: ProjectState,
  ): Promise<AgentResponse> {
    const prompt = userMessage.trim();
    if (!prompt) throw new Error("Agent user message must not be empty.");
    if (!this.useMockEngine) {
      throw new Error("REAL_LLM_ENGINE_NOT_CONFIGURED: deterministic mock mode only.");
    }

    let workingProjectState = currentProjectState
      ? ProjectStateSchema.parse(structuredClone(currentProjectState))
      : undefined;
    const requestedCalls: ToolCallRequest[] = [];
    const results: ToolCallResult[] = [];
    let finalAssistantText = "";

    for (let iteration = 1; iteration <= this.maxIterations; iteration += 1) {
      const llmResult = simulateLLMReasoning(prompt, iteration);
      finalAssistantText = llmResult.content;
      if (llmResult.toolCalls.length === 0) break;

      this.canonical.plan();
      this.canonical.requestConfirmation();
      this.canonical.confirm();

      for (const callRequest of llmResult.toolCalls) {
        requestedCalls.push(callRequest);
        const execution = await this.canonical.execute({
          requestId: crypto.randomUUID(),
          taskId: this.canonical.state.taskId,
          traceId: this.canonical.state.traceId,
          toolCall: {
            callId: callRequest.callId,
            toolId: callRequest.toolName,
            parameters: callRequest.parameters,
          },
        });

        const result = execution.result;
        const mapped = result.status === "success"
          ? { callId: result.callId, toolName: result.toolId, status: "success" as const, data: result.data, executionTimeMs: result.durationMs }
          : { callId: result.callId, toolName: result.toolId, status: "error" as const, errorDetails: result.error?.message, executionTimeMs: result.durationMs };
        results.push(mapped);

        if (result.status === "success" && workingProjectState && result.data) {
          workingProjectState = this.applyToolResultToState(
            callRequest.toolName,
            result.data,
            workingProjectState,
          );
        }
      }

      if (results.some((result) => result.status === "error")) {
        finalAssistantText =
          "The requested operation could not be completed because one or more tool contracts rejected the execution request.";
        this.canonical.fail();
      } else {
        this.canonical.beginVerification();
        this.canonical.complete();
      }
      break;
    }

    void history;
    return AgentResponseSchema.parse({
      messageId: crypto.randomUUID(),
      content: finalAssistantText,
      requestedToolCalls: requestedCalls,
      toolResults: results,
      updatedProjectState: workingProjectState,
      requiresUserConfirmation: this.canonical.state.state === "AWAITING_CONFIRMATION",
    });
  }

  private applyToolResultToState(
    toolName: string,
    toolOutput: Record<string, unknown>,
    state: ProjectState,
  ): ProjectState {
    const updatedState = structuredClone(state);
    const now = new Date().toISOString();

    if (toolName === "remove_background" && typeof toolOutput.processedImageUrl === "string") {
      const newLayer: Layer = {
        id: crypto.randomUUID(), name: "Background Removed Layer", type: "image",
        url: toolOutput.processedImageUrl, visible: true, locked: false, opacity: 1,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, zIndex: updatedState.layers.length },
        metadata: { maskUrl: typeof toolOutput.maskUrl === "string" ? toolOutput.maskUrl : "unknown" },
      };
      updatedState.layers.push(newLayer);
      updatedState.timeline.push({
        id: crypto.randomUUID(), timestamp: 0, actionType: "remove_background",
        affectedLayerId: newLayer.id, description: "Created a new layer with background removed.",
      });
    } else if (toolName === "apply_color_lut" && typeof toolOutput.renderedMediaUrl === "string") {
      const target = updatedState.layers.find((layer) => layer.type === "video") ?? updatedState.layers.find((layer) => layer.type === "image");
      if (target) {
        target.url = toolOutput.renderedMediaUrl;
        target.metadata = { ...target.metadata, appliedLut: toolOutput.appliedLut, intensityApplied: toolOutput.intensityApplied };
        updatedState.timeline.push({
          id: crypto.randomUUID(), timestamp: 0, actionType: "apply_color_lut",
          affectedLayerId: target.id, description: "Applied a predefined color LUT to the target layer.",
        });
      }
    } else if (toolName === "trim_video" && typeof toolOutput.trimmedVideoUrl === "string") {
      const target = updatedState.layers.find((layer) => layer.type === "video");
      if (target) {
        target.url = toolOutput.trimmedVideoUrl;
        if (typeof toolOutput.newDurationSec === "number") updatedState.durationSec = toolOutput.newDurationSec;
        updatedState.timeline.push({
          id: crypto.randomUUID(), timestamp: 0, actionType: "trim_video",
          affectedLayerId: target.id, description: "Trimmed the video layer to the requested range.",
        });
      }
    }

    updatedState.updatedAt = now;
    updatedState.version += 1;
    return ProjectStateSchema.parse(updatedState);
  }
}
