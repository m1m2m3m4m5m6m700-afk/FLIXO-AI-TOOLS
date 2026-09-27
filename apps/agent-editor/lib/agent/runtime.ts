import { z } from "zod";
import { ToolRegistry } from "./registry";
import { buildSystemPrompt } from "./prompts";
import { simulateLLMReasoning } from "./mock-llm";
import {
  AgentResponseSchema,
  AgentRuntimeOptionsSchema,
  ChatMessageSchema,
  MockLLMResultSchema,
  ToolCallRequestSchema,
  ToolCallResultSchema,
  type AgentRuntimeOptions,
  type AgentResponse,
  type ChatMessage,
  type ToolCallRequest,
  type ToolCallResult,
} from "../schemas/agent";
import {
  ProjectStateSchema,
  type Layer,
  type ProjectState,
} from "../schemas/project";
import {
  LLMUnavailableError,
  toLLMTools,
  type LLMMessage,
  type LLMRouter,
  type LLMToolCall,
} from "../llm";

export type { AgentRuntimeOptions } from "../schemas/agent";

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
    this.llmRouter = llmRouter;

    const hasConfiguredLiveProvider =
      (llmRouter?.configuredProviders().length ?? 0) > 0;
    this.useMockEngine =
      parsed.useMockEngine ??
      (!hasConfiguredLiveProvider && process.env.NODE_ENV !== "production");
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
      if (event.type === "final") {
        finalResponse = event.response;
      }
    }

    if (!finalResponse) {
      throw new Error("Agent runtime ended without a final response.");
    }

    return AgentResponseSchema.parse(finalResponse);
  }

  async *streamUserMessage(
    userMessage: string,
    history: readonly ChatMessage[],
    currentProjectState?: ProjectState,
  ): AsyncGenerator<AgentRuntimeStreamEvent> {
    const prompt = z.string().trim().min(1).max(100_000).parse(userMessage);
    const parsedHistory = z
      .array(ChatMessageSchema)
      .max(24)
      .parse(history);
    const parsedProjectState = currentProjectState
      ? ProjectStateSchema.parse(structuredClone(currentProjectState))
      : undefined;

    const systemPrompt = buildSystemPrompt(
      this.registry.list(),
      parsedProjectState,
    );

    let workingProjectState = parsedProjectState
      ? structuredClone(parsedProjectState)
      : undefined;
    const requestedCalls: ToolCallRequest[] = [];
    const results: ToolCallResult[] = [];

    if (this.useMockEngine) {
      const mockResult = MockLLMResultSchema.parse(
        simulateLLMReasoning(prompt, 1),
      );

      if (mockResult.toolCalls.length === 0) {
        yield* this.emitContentTokens(mockResult.content);
        yield {
          type: "final",
          response: this.buildResponse(
            mockResult.content,
            requestedCalls,
            results,
            workingProjectState,
          ),
        };
        return;
      }

      for (const rawCall of mockResult.toolCalls) {
        const call = ToolCallRequestSchema.parse(rawCall);
        requestedCalls.push(call);
        yield {
          type: "tool_call_start",
          callId: call.callId,
          toolName: call.toolName,
        };

        const result = ToolCallResultSchema.parse(
          await this.registry.execute(
            call.callId,
            call.toolName,
            call.parameters,
          ),
        );
        results.push(result);
        yield { type: "tool_call_end", result };

        if (result.status === "error") {
          yield {
            type: "final",
            response: this.buildResponse(
              "The requested operation could not be completed.",
              requestedCalls,
              results,
              workingProjectState,
            ),
          };
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

      yield* this.emitContentTokens(mockResult.content);
      yield {
        type: "final",
        response: this.buildResponse(
          mockResult.content,
          requestedCalls,
          results,
          workingProjectState,
        ),
      };
      return;
    }

    if (!this.llmRouter) {
      throw new LLMUnavailableError("REAL_LLM_ENGINE_NOT_CONFIGURED");
    }

    const messages: LLMMessage[] = parsedHistory
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role,
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
        yield {
          type: "final",
          response: this.buildResponse(
            latestAssistantText || "I completed the requested operation.",
            requestedCalls,
            results,
            workingProjectState,
          ),
        };
        return;
      }

      const validatedTurnToolCalls = turnToolCalls.map((call) =>
        ToolCallRequestSchema.parse({
          callId: call.callId,
          toolName: call.toolName,
          parameters: call.arguments,
        }),
      );

      messages.push({
        role: "assistant",
        content: latestAssistantText,
        toolCalls: validatedTurnToolCalls.map((call) => ({
          callId: call.callId,
          toolName: call.toolName,
          arguments: call.parameters,
        })),
      });

      for (const call of validatedTurnToolCalls) {
        requestedCalls.push(call);
        yield {
          type: "tool_call_start",
          callId: call.callId,
          toolName: call.toolName,
        };

        const result = ToolCallResultSchema.parse(
          await this.registry.execute(
            call.callId,
            call.toolName,
            call.parameters,
          ),
        );
        results.push(result);
        yield { type: "tool_call_end", result };

        messages.push({
          role: "tool",
          content: "",
          toolResults: [
            {
              callId: call.callId,
              toolName: call.toolName,
              result: result.data ?? { error: "tool_execution_failed" },
              isError: result.status === "error",
            },
          ],
        });

        if (result.status === "error") {
          yield {
            type: "final",
            response: this.buildResponse(
              "The requested operation could not be completed.",
              requestedCalls,
              results,
              workingProjectState,
            ),
          };
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
        yield {
          type: "final",
          response: this.buildResponse(
            "The operation reached the safety iteration limit before a verified final response was produced.",
            requestedCalls,
            results,
            workingProjectState,
          ),
        };
        return;
      }
    }

    throw new Error("Agent runtime exhausted without a terminal state.");
  }

  private *emitContentTokens(content: string): Generator<
    Extract<AgentRuntimeStreamEvent, { type: "token" }>
  > {
    for (const token of content.split(/(?=\\s)|(?<=\\s)/).filter(Boolean)) {
      yield { type: "token", text: token };
    }
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
    const parsedState = ProjectStateSchema.parse(state);
    const validatedOutput = this.registry.parseToolOutput(toolName, toolOutput);
    const updatedState = structuredClone(parsedState);

    if (
      toolName === "remove_background" &&
      typeof validatedOutput.processedImageUrl === "string"
    ) {
      const newLayer: Layer = {
        id: crypto.randomUUID(),
        name: "Background Removed Layer",
        type: "image",
        url: validatedOutput.processedImageUrl,
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
            typeof validatedOutput.maskUrl === "string"
              ? validatedOutput.maskUrl
              : "unknown",
        },
      };
      updatedState.layers = [...updatedState.layers, newLayer];
      updatedState.timeline = [
        ...updatedState.timeline,
        {
          id: crypto.randomUUID(),
          timestamp: 0,
          actionType: "remove_background",
          affectedLayerId: newLayer.id,
          description: "Created a new layer with background removed.",
        },
      ];
    } else if (
      toolName === "apply_color_lut" &&
      typeof validatedOutput.renderedMediaUrl === "string"
    ) {
      const target =
        updatedState.layers.find((layer) => layer.type === "video") ??
        updatedState.layers.find((layer) => layer.type === "image");

      if (target) {
        updatedState.layers = updatedState.layers.map((layer) =>
          layer.id === target.id
            ? {
                ...layer,
                url: validatedOutput.renderedMediaUrl,
                metadata: {
                  ...layer.metadata,
                  appliedLut: validatedOutput.appliedLut,
                  intensityApplied: validatedOutput.intensityApplied,
                },
              }
            : layer,
        );
        updatedState.timeline = [
          ...updatedState.timeline,
          {
            id: crypto.randomUUID(),
            timestamp: 0,
            actionType: "apply_color_lut",
            affectedLayerId: target.id,
            description: "Applied a predefined color LUT to the target layer.",
          },
        ];
      }
    } else if (
      toolName === "trim_video" &&
      typeof validatedOutput.trimmedVideoUrl === "string"
    ) {
      const target = updatedState.layers.find((layer) => layer.type === "video");
      updatedState.layers = updatedState.layers.map((layer) =>
        target && layer.id === target.id
          ? { ...layer, url: validatedOutput.trimmedVideoUrl }
          : layer,
      );
      if (target && typeof validatedOutput.newDurationSec === "number") {
        updatedState.durationSec = validatedOutput.newDurationSec;
      }
      if (target) {
        updatedState.timeline = [
          ...updatedState.timeline,
          {
            id: crypto.randomUUID(),
            timestamp: 0,
            actionType: "trim_video",
            affectedLayerId: target.id,
            description: "Trimmed the video layer to the requested range.",
          },
        ];
      }
    }

    const nextState = {
      ...updatedState,
      updatedAt: new Date().toISOString(),
      version: parsedState.version + 1,
    };

    return ProjectStateSchema.parse(nextState);
  }
}
