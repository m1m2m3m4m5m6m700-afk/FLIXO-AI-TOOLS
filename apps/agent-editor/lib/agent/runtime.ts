import { z } from "zod";
import { ToolRegistry } from "./registry";
import { buildSystemPrompt } from "./prompts";
import type {
  AgentResponse,
  ChatMessage,
  ToolCallRequest,
  ToolCallResult,
} from "../schemas/agent";
import { AgentResponseSchema } from "../schemas/agent";
import {
  ProjectStateSchema,
  type Layer,
  type ProjectState,
} from "../schemas/project";
import { simulateLLMReasoning } from "./mock-llm";

export const AgentRuntimeOptionsSchema = z.object({
  maxIterations: z.number().int().positive().max(20).default(5),
  useMockEngine: z.boolean().default(true),
});
export type AgentRuntimeOptions = z.input<typeof AgentRuntimeOptionsSchema>;

export class AgentRuntime {
  private readonly maxIterations: number;
  private readonly useMockEngine: boolean;

  constructor(
    private readonly registry: ToolRegistry,
    options: AgentRuntimeOptions = {},
  ) {
    const parsed = AgentRuntimeOptionsSchema.parse(options);
    this.maxIterations = parsed.maxIterations;
    this.useMockEngine = parsed.useMockEngine;
  }

  async processUserMessage(
    userMessage: string,
    history: readonly ChatMessage[],
    currentProjectState?: ProjectState,
  ): Promise<AgentResponse> {
    const prompt = userMessage.trim();
    if (!prompt) {
      throw new Error("Agent user message must not be empty.");
    }

    if (!this.useMockEngine) {
      throw new Error(
        "REAL_LLM_ENGINE_NOT_CONFIGURED: the isolated MVP runtime currently supports deterministic mock mode only.",
      );
    }

    const systemPrompt = buildSystemPrompt(
      this.registry.list(),
      currentProjectState,
    );

    let workingProjectState = currentProjectState
      ? ProjectStateSchema.parse(structuredClone(currentProjectState))
      : undefined;
    const requestedCalls: ToolCallRequest[] = [];
    const results: ToolCallResult[] = [];
    let finalAssistantText = "";
    let currentPrompt = prompt;

    for (let iteration = 1; iteration <= this.maxIterations; iteration += 1) {
      const llmResult = simulateLLMReasoning(currentPrompt, iteration);
      finalAssistantText = llmResult.content;

      if (llmResult.toolCalls.length === 0) {
        break;
      }

      for (const callRequest of llmResult.toolCalls) {
        requestedCalls.push(callRequest);
        const result = await this.registry.execute(
          callRequest.callId,
          callRequest.toolName,
          callRequest.parameters,
        );
        results.push(result);

        if (result.status === "success" && workingProjectState && result.data) {
          workingProjectState = this.applyToolResultToState(
            callRequest.toolName,
            result.data,
            workingProjectState,
          );
        }
      }

      const failed = results.some((result) => result.status === "error");
      if (failed) {
        finalAssistantText =
          "The requested operation could not be completed because one or more tool contracts rejected the execution request.";
        break;
      }

      currentPrompt =
        "Continue only if another distinct registered operation is explicitly required. Otherwise finish the response.";
      break;
    }

    const response = AgentResponseSchema.parse({
      messageId: crypto.randomUUID(),
      content: finalAssistantText,
      requestedToolCalls: requestedCalls,
      toolResults: results,
      updatedProjectState: workingProjectState,
      requiresUserConfirmation: false,
    });

    void history;
    void systemPrompt;
    return response;
  }

  private applyToolResultToState(
    toolName: string,
    toolOutput: Record<string, unknown>,
    state: ProjectState,
  ): ProjectState {
    const updatedState = structuredClone(state);
    const now = new Date().toISOString();

    if (
      toolName === "remove_background" &&
      typeof toolOutput.processedImageUrl === "string"
    ) {
      const newLayer: Layer = {
        id: crypto.randomUUID(),
        name: "Background Removed Layer",
        type: "image",
        url: toolOutput.processedImageUrl,
        visible: true,
        locked: false,
        opacity: 1,
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          zIndex: updatedState.layers.length,
        },
        metadata: {
          maskUrl:
            typeof toolOutput.maskUrl === "string"
              ? toolOutput.maskUrl
              : "unknown",
        },
      };
      updatedState.layers.push(newLayer);
      updatedState.timeline.push({
        id: crypto.randomUUID(),
        timestamp: 0,
        actionType: "remove_background",
        affectedLayerId: newLayer.id,
        description: "Created a new layer with background removed.",
      });
    } else if (
      toolName === "apply_color_lut" &&
      typeof toolOutput.renderedMediaUrl === "string"
    ) {
      const target =
        updatedState.layers.find((layer) => layer.type === "video") ??
        updatedState.layers.find((layer) => layer.type === "image");

      if (target) {
        target.url = toolOutput.renderedMediaUrl;
        target.metadata = {
          ...target.metadata,
          appliedLut: toolOutput.appliedLut,
          intensityApplied: toolOutput.intensityApplied,
        };
        updatedState.timeline.push({
          id: crypto.randomUUID(),
          timestamp: 0,
          actionType: "apply_color_lut",
          affectedLayerId: target.id,
          description: "Applied a predefined color LUT to the target layer.",
        });
      }
    } else if (
      toolName === "trim_video" &&
      typeof toolOutput.trimmedVideoUrl === "string"
    ) {
      const target = updatedState.layers.find((layer) => layer.type === "video");

      if (target) {
        target.url = toolOutput.trimmedVideoUrl;
        if (typeof toolOutput.newDurationSec === "number") {
          updatedState.durationSec = toolOutput.newDurationSec;
        }
        updatedState.timeline.push({
          id: crypto.randomUUID(),
          timestamp: 0,
          actionType: "trim_video",
          affectedLayerId: target.id,
          description: "Trimmed the video layer to the requested range.",
        });
      }
    }

    updatedState.updatedAt = now;
    updatedState.version += 1;
    return ProjectStateSchema.parse(updatedState);
  }
}
