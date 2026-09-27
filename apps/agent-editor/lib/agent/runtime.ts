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
import {
  LLMUnavailableError,
  toLLMTools,
  type LLMMessage,
  type LLMRouter,
  type LLMToolCall,
} from "../llm";

export const AgentRuntimeOptionsSchema = z.object({
  maxIterations: z.number().int().positive().max(8).default(5),
  useMockEngine: z.boolean().default(false),
});

export type AgentRuntimeOptions = z.input<typeof AgentRuntimeOptionsSchema>;

export type AgentRuntimeStreamEvent =
  | { type: "token"; text: string }
  | { type: "tool_call_start"; callId: string; toolName: string }
  | { type: "tool_call_end"; result: ToolCallResult }
  | { type: "state_update"; projectState: ProjectState }
  | { type: "final"; response: AgentResponse };

export class AgentRuntime {
  private readonly maxIterations: number;
  private readonly useMockEngine: boolean;
  private readonly llmRouter?: LLMRouter;

  constructor(
    private readonly registry: ToolRegistry,
    options: AgentRuntimeOptions = {},
    llmRouter?: LLMRouter,
  ) {
    const parsed = AgentRuntimeOptionsSchema.parse(options);
    this.maxIterations = parsed.maxIterations;
    this.useMockEngine = parsed.useMockEngine;
    this.llmRouter = llmRouter;
  }

  async processUserMessage(
    userMessage: string,
    history: readonly ChatMessage[],
    currentProjectState?: ProjectState,
  ): Promise<AgentResponse> {
    let finalResponse: AgentResponse | undefined;

    for await (const event of this.streamUserMessage(
      userMessage,
      history,
      currentProjectState,
    )) {
      if (event.type === "final") finalResponse = event.response;
    }

    if (!finalResponse) {
      throw new Error("Agent runtime ended without a final response.");
    }

    return finalResponse;
  }

  async *streamUserMessage(
    userMessage: string,
    history: readonly ChatMessage[],
    currentProjectState?: ProjectState,
  ): AsyncGenerator<AgentRuntimeStreamEvent> {
    const prompt = userMessage.trim();
    if (!prompt) {
      throw new Error("Agent user message must not be empty.");
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

    if (this.useMockEngine) {
      const mockResult = simulateLLMReasoning(prompt, 1);
      if (mockResult.toolCalls.length === 0) {
        const response = this.buildResponse(
          mockResult.content,
          requestedCalls,
          results,
          workingProjectState,
        );
        yield { type: "final", response };
        return;
      }

      const turnToolCalls = mockResult.toolCalls;
      for (const call of turnToolCalls) {
        requestedCalls.push(call);
        yield { type: "tool_call_start", callId: call.callId, toolName: call.toolName };

        const result = await this.registry.execute(
          call.callId,
          call.toolName,
          call.parameters,
        );
        results.push(result);
        yield { type: "tool_call_end", result };

        if (result.status === "error") {
          const response = this.buildResponse(
            "The requested operation could not be completed.",
            requestedCalls,
            results,
            workingProjectState,
          );
          yield { type: "final", response };
          return;
        }

        if (workingProjectState && result.data) {
          workingProjectState = this.applyToolResultToState(
            call.toolName,
            result.data,
            workingProjectState,
          );
          yield { type: "state_update", projectState: workingProjectState };
        }
      }

      const response = this.buildResponse(
        mockResult.content,
        requestedCalls,
        results,
        workingProjectState,
      );
      yield { type: "final", response };
      return;
    }

    if (!this.llmRouter) {
      throw new LLMUnavailableError("REAL_LLM_ENGINE_NOT_CONFIGURED");
    }

    const messages: LLMMessage[] = history
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "tool" ? "tool" : message.role,
        content: message.content,
        toolCalls: message.toolCalls?.map((call) => ({
          callId: call.callId,
          toolName: call.toolName,
          arguments: call.parameters,
        })),
        toolResults: message.toolResults?.map((result) => ({
          callId: result.callId,
          toolName: result.toolName,
          result: result.data ?? { error: "tool_execution_failed" },
          isError: result.status === "error",
        })),
      }));

    messages.push({
      role: "user",
      content: prompt,
    });

    const llmTools = toLLMTools(this.registry.list());
    let latestAssistantText = "";

    for (let iteration = 1; iteration <= this.maxIterations; iteration += 1) {
      latestAssistantText = "";
      let turnToolCalls: readonly LLMToolCall[] = [];

      for await (const event of this.llmRouter.stream({
        model: "",
        systemPrompt,
        messages,
        tools: llmTools,
        resumePrefix: latestAssistantText.slice(-2048),
      })) {
        if (event.type === "text_delta") {
          latestAssistantText += event.text;
          yield { type: "token", text: event.text };
          continue;
        }

        if (event.type === "turn_end") {
          turnToolCalls = event.toolCalls;
        }
      }

      if (turnToolCalls.length === 0) {
        const response = this.buildResponse(
          latestAssistantText || "I completed the requested operation.",
          requestedCalls,
          results,
          workingProjectState,
        );
        yield { type: "final", response };
        return;
      }

      messages.push({
        role: "assistant",
        content: latestAssistantText,
        toolCalls: turnToolCalls,
      });

      for (const call of turnToolCalls) {
        const request: ToolCallRequest = {
          callId: call.callId,
          toolName: call.toolName,
          parameters: call.arguments,
        };
        requestedCalls.push(request);
        yield {
          type: "tool_call_start",
          callId: call.callId,
          toolName: call.toolName,
        };

        const result = await this.registry.execute(
          call.callId,
          call.toolName,
          call.arguments,
        );
        results.push(result);
        yield { type: "tool_call_end", result };

        const toolResult = {
          callId: call.callId,
          toolName: call.toolName,
          result: result.data ?? { error: "tool_execution_failed" },
          isError: result.status === "error",
        };

        messages.push({
          role: "tool",
          content: "",
          toolResults: [toolResult],
        });

        if (result.status === "error") {
          const response = this.buildResponse(
            "The requested operation could not be completed.",
            requestedCalls,
            results,
            workingProjectState,
          );
          yield { type: "final", response };
          return;
        }

        if (workingProjectState && result.data) {
          workingProjectState = this.applyToolResultToState(
            call.toolName,
            result.data,
            workingProjectState,
          );
          yield { type: "state_update", projectState: workingProjectState };
        }
      }

      if (iteration === this.maxIterations) {
        const response = this.buildResponse(
          "The operation reached the safety iteration limit before a verified final response was produced.",
          requestedCalls,
          results,
          workingProjectState,
        );
        yield { type: "final", response };
        return;
      }
    }

    throw new Error("Agent runtime exhausted without a terminal state.");
  }

  private buildResponse(
    content: string,
    requestedToolCalls: readonly ToolCallRequest[],
    toolResults: readonly ToolCallResult[],
    updatedProjectState?: ProjectState,
  ): AgentResponse {
    return AgentResponseSchema.parse({
      messageId: crypto.randomUUID(),
      content,
      requestedToolCalls,
      toolResults,
      updatedProjectState,
      requiresUserConfirmation: false,
    });
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
