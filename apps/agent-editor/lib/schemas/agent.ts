import { z } from "zod";
import { ProjectStateSchema } from "./project";

export const MessageRoleSchema = z.enum(["system", "user", "assistant", "tool"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const ToolCallRequestSchema = z.object({
  callId: z.string().min(1),
  toolName: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()),
});
export type ToolCallRequest = z.infer<typeof ToolCallRequestSchema>;

export const ToolCallResultSchema = z.object({
  callId: z.string().min(1),
  toolName: z.string().min(1),
  status: z.enum(["success", "error"]),
  data: z.record(z.string(), z.unknown()).optional(),
  errorDetails: z.string().optional(),
  executionTimeMs: z.number().nonnegative().optional(),
});
export type ToolCallResult = z.infer<typeof ToolCallResultSchema>;

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  toolCalls: z.array(ToolCallRequestSchema).optional(),
  toolResults: z.array(ToolCallResultSchema).optional(),
  timestamp: z.string().datetime(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const AgentResponseSchema = z.object({
  messageId: z.string().uuid(),
  content: z.string(),
  requestedToolCalls: z.array(ToolCallRequestSchema).default([]),
  updatedProjectState: ProjectStateSchema.partial().optional(),
  requiresUserConfirmation: z.boolean().default(false),
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;
