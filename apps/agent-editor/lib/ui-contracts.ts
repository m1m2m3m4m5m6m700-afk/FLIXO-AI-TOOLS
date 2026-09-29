import { z } from "zod";
import { ChatMessageSchema } from "./schemas/agent";
import { ProjectStateSchema, TimelineEventSchema } from "./schemas/project";

export const ChatInterfacePropsSchema = z.object({
  messages: z.array(ChatMessageSchema),
  isStreaming: z.boolean(),
  activeTool: z.string().nullable(),
  manualFallbackPath: z.string().regex(/^\/en\/tools\/[a-z0-9-]+$/).nullable(),
  confirmationPending: z.boolean(),
  confirmationPreview: z.array(z.object({
    callId: z.string().min(1).max(128),
    toolName: z.string().min(1).max(128),
    parameters: z.record(z.string(), z.unknown()),
  }).strict()),
  onSendMessage: z.function().args(z.string()).returns(z.unknown()),
  onConfirm: z.function().args().returns(z.unknown()),
  onCancel: z.function().args().returns(z.unknown()),
  onStop: z.function().args().returns(z.unknown()),
});

export const MediaCanvasPropsSchema = z.object({
  projectState: ProjectStateSchema.optional(),
  onToggleVisibility: z.function().args(z.string()).returns(z.void()),
});

export const TimelineBarPropsSchema = z.object({
  events: z.array(TimelineEventSchema),
  durationSec: z.number().min(0),
  fps: z.number().int().positive(),
  currentTimeSec: z.number().min(0),
  onSeek: z.function().args(z.number()).returns(z.void()),
});

export type ChatInterfaceProps = z.infer<typeof ChatInterfacePropsSchema>;
export type MediaCanvasProps = z.infer<typeof MediaCanvasPropsSchema>;
export type TimelineBarProps = z.infer<typeof TimelineBarPropsSchema>;