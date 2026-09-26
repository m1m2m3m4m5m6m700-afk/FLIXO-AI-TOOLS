import { z } from "zod";
import { ProjectStateSchema } from "./project";

export const ChatMessageSchema = z
  .object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().min(1).max(100_000),
  })
  .strict();

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ToolCallRequestSchema = z
  .object({
    callId: z.string().min(1).max(128),
    toolName: z.string().min(1).max(128),
    parameters: z
      .record(
        z.string(),
        z.union([z.string(), z.number().finite(), z.boolean()]),
      )
      .default({}),
  })
  .strict();

export type ToolCallRequest = z.infer<typeof ToolCallRequestSchema>;

export const ToolCallResultSchema = z
  .object({
    callId: z.string().min(1).max(128),
    toolName: z.string().min(1).max(128),
    status: z.enum(["success", "error"]),
    data: z.record(z.string(), z.unknown()).optional(),
    error: z.string().min(1).optional(),
    errorDetails: z.string().min(1).optional(),
    executionTimeMs: z.number().finite().nonnegative().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "success" && !value.data) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data"],
        message: "Successful tool calls must contain validated data.",
      });
    }
    if (value.status === "error" && !value.error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["error"],
        message: "Failed tool calls must contain an error.",
      });
    }
  });

export type ToolCallResult = z.infer<typeof ToolCallResultSchema>;

export const AgentResponseSchema = z
  .object({
    messageId: z.string().min(1).max(128),
    content: z.string(),
    requestedToolCalls: z.array(ToolCallRequestSchema),
    updatedProjectState: ProjectStateSchema.optional(),
    requiresUserConfirmation: z.boolean(),
  })
  .strict();

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export const MockLLMResultSchema = z
  .object({
    content: z.string(),
    toolCalls: z.array(ToolCallRequestSchema),
  })
  .strict();

export type MockLLMResult = z.infer<typeof MockLLMResultSchema>;

export const AgentRuntimeOptionsSchema = z
  .object({
    maxIterations: z.number().int().min(1).max(5).default(5),
    useMockEngine: z.boolean().optional(),
  })
  .strict();

export type AgentRuntimeOptionsInput = z.input<typeof AgentRuntimeOptionsSchema>;