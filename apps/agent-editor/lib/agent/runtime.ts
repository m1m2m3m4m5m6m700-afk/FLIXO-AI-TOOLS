import { z } from "zod";
import {
  AgentResponseSchema,
  AgentRuntimeOptionsSchema,
  ChatMessageSchema,
  MockLLMResultSchema,
  ToolCallRequestSchema,
  ToolCallResultSchema,
  type AgentResponse,
  type ChatMessage,
  type MockLLMResult,
  type ToolCallRequest,
  type ToolCallResult,
} from "../schemas/agent";
import {
  LayerSchema,
  ProjectStateSchema,
  type Layer,
  type ProjectState,
} from "../schemas/project";
import { buildSystemPrompt } from "./prompts";
import { ToolRegistry } from "./registry";
import { simulateLLMReasoning } from "./mock-llm";
import { stableToken } from "../tools/mock-utils";

export interface ReasoningEngineInput {
  readonly userMessage: string;
  readonly history: readonly ChatMessage[];
  readonly systemPrompt: string;
  readonly currentProjectState?: ProjectState;
  readonly callIndex: number;
}

export type ReasoningEngine = (
  input: ReasoningEngineInput,
) => Promise<MockLLMResult>;

export interface AgentRuntimeOptions {
  readonly registry: ToolRegistry;
  readonly maxIterations?: number;
  readonly useMockEngine?: boolean;
  readonly reasoningEngine?: ReasoningEngine;
}

const LiveKeySchema = z.string().trim().min(1);

export function hasLiveLlmKey(): boolean {
  return (
    LiveKeySchema.safeParse(process.env.OPENAI_API_KEY).success ||
    LiveKeySchema.safeParse(process.env.FLIXO_LLM_API_KEY).success
  );
}

function stableMessageId(userMessage: string): string {
  return "msg_" + stableToken([userMessage]);
}

export class AgentRuntime {
  private readonly registry: ToolRegistry;
  private readonly maxIterations: number;
  private readonly useMockEngine: boolean;
  private readonly reasoningEngine?: ReasoningEngine;

  constructor(options: AgentRuntimeOptions) {
    const parsedOptions = AgentRuntimeOptionsSchema.parse({
      maxIterations: options.maxIterations ?? 5,
      useMockEngine: options.useMockEngine,
    });

    this.registry = options.registry;
    this.maxIterations = parsedOptions.maxIterations;
    this.reasoningEngine = options.reasoningEngine;

    const shouldUseMock =
      parsedOptions.useMockEngine ?? !hasLiveLlmKey();
    this.useMockEngine = shouldUseMock;

    if (!this.useMockEngine && !this.reasoningEngine) {
      throw new Error("LIVE_LLM_ENGINE_UNCONFIGURED");
    }
  }

  async processUserMessage(
    userMessage: string,
    history: ChatMessage[],
    currentProjectState?: ProjectState,
  ): Promise<AgentResponse> {
    const parsedMessage = z.string().min(1).max(100_000).parse(userMessage);
    const parsedHistory = z
      .array(ChatMessageSchema)
      .max(20_000)
      .parse(history);
    const parsedProjectState = currentProjectState
      ? ProjectStateSchema.parse(currentProjectState)
      : undefined;

    let workingState = parsedProjectState
      ? structuredClone(parsedProjectState)
      : undefined;
    const requestedCalls: ToolCallRequest[] = [];
    const executedResults: ToolCallResult[] = [];
    let assistantText =
      "I have processed your request. How else can I assist?";

    const systemPrompt = buildSystemPrompt(
      this.registry.list(),
      parsedProjectState,
    );

    for (let iteration = 1; iteration <= this.maxIterations; iteration += 1) {
      const rawResult = this.useMockEngine
        ? simulateLLMReasoning(parsedMessage, iteration)
        : await this.reasoningEngine!({
            userMessage: parsedMessage,
            history: parsedHistory,
            systemPrompt,
            currentProjectState: workingState,
            callIndex: iteration,
          });

      const llmResult = MockLLMResultSchema.parse(rawResult);
      assistantText = llmResult.content;

      if (llmResult.toolCalls.length === 0) {
        break;
      }

      for (const rawCall of llmResult.toolCalls) {
        const callReq = ToolCallRequestSchema.parse(rawCall);
        requestedCalls.push(callReq);

        const result = ToolCallResultSchema.parse(
          await this.registry.execute(
            callReq.callId,
            callReq.toolName,
            callReq.parameters,
          ),
        );
        executedResults.push(result);

        if (result.status === "success" && result.data && workingState) {
          workingState = this.applyStateMutation(
            callReq.toolName,
            result.data,
            workingState,
          );
        }

        if (result.status === "error") {
          assistantText =
            "The requested operation was rejected by a runtime contract.";
          break;
        }
      }

      if (executedResults.some((result) => result.status === "error")) {
        break;
      }
    }

    const validatedResults = executedResults.map((result) =>
      ToolCallResultSchema.parse(result),
    );

    void parsedHistory;
    void systemPrompt;

    return Object.freeze(
      AgentResponseSchema.parse({
        messageId: stableMessageId(parsedMessage),
        content: assistantText,
        requestedToolCalls: requestedCalls,
        updatedProjectState: workingState,
        requiresUserConfirmation: false,
      }),
    );
  }

  private applyStateMutation(
    toolName: string,
    data: Record<string, unknown>,
    state: ProjectState,
  ): ProjectState {
    const parsedState = ProjectStateSchema.parse(state);
    const validatedData = this.registry.parseToolOutput(toolName, data);
    const updated = structuredClone(parsedState);
    const nextVersion = parsedState.version + 1;
    const updatedAt = new Date().toISOString();
    const mutationToken = stableToken([
      toolName,
      parsedState.id,
      String(nextVersion),
      JSON.stringify(validatedData),
    ]);

    if (
      toolName === "remove_background" &&
      typeof validatedData.processedImageUrl === "string"
    ) {
      const newLayer: Layer = LayerSchema.parse({
        id: "layer_nobg_" + mutationToken,
        name: "Background Removed Layer",
        type: "image",
        url: validatedData.processedImageUrl,
        visible: true,
        locked: false,
        opacity: 1,
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          zIndex: updated.layers.length + 1,
        },
        metadata: {
          maskUrl: validatedData.maskUrl,
        },
      });

      updated.layers = [...updated.layers, newLayer];
      updated.timeline = [
        ...updated.timeline,
        {
          id: "event_" + mutationToken,
          timestamp: updated.durationSec,
          actionType: toolName,
          affectedLayerId: newLayer.id,
          description: "Created a new layer with background removed.",
        },
      ];
    } else if (
      toolName === "apply_color_lut" &&
      typeof validatedData.renderedMediaUrl === "string"
    ) {
      const targetLayer =
        updated.layers.find(
          (layer) => layer.type === "video" || layer.type === "image",
        );

      if (targetLayer) {
        targetLayer.url = validatedData.renderedMediaUrl;
        targetLayer.metadata = {
          ...targetLayer.metadata,
          appliedLut: validatedData.appliedLut,
          intensityApplied: validatedData.intensityApplied,
        };
        updated.timeline = [
          ...updated.timeline,
          {
            id: "event_" + mutationToken,
            timestamp: 0,
            actionType: toolName,
            affectedLayerId: targetLayer.id,
            description: "Applied a predefined color LUT to the target layer.",
          },
        ];
      }
    } else if (
      toolName === "trim_video" &&
      typeof validatedData.trimmedVideoUrl === "string"
    ) {
      const targetLayer = updated.layers.find(
        (layer) => layer.type === "video",
      );

      if (targetLayer) {
        targetLayer.url = validatedData.trimmedVideoUrl;
      }
      if (typeof validatedData.newDurationSec === "number") {
        updated.durationSec = validatedData.newDurationSec;
      }
      updated.timeline = [
        ...updated.timeline,
        {
          id: "event_" + mutationToken,
          timestamp: 0,
          actionType: toolName,
          affectedLayerId: targetLayer?.id,
          description: "Trimmed the video layer to the requested range.",
        },
      ];
    }

    updated.version = nextVersion;
    updated.updatedAt = updatedAt;
    return ProjectStateSchema.parse(updated);
  }
}