import { z } from "zod";
import { ChatMessageSchema } from "./schemas/agent";
import { ProjectStateSchema, TimelineEventSchema } from "./schemas/project";

export const ChatInterfacePropsSchema = z.object({
  messages: z.array(ChatMessageSchema),
  isStreaming: z.boolean(),
  activeTool: z.string().nullable(),
  onSendMessage: z.function().args(z.string()).returns(z.unknown()),
  onStop: z.function().args().returns(z.unknown()),
});

export const MediaCanvasPropsSchema = z.object({
  projectState: ProjectStateSchema.optional(),
  onToggleVisibility: z.function().args(z.string()).returns(z.void()),
});

export const TimelineBarPropsSchema = z.object({
  events: z.array(TimelineEventSchema),
});

export type ChatInterfaceProps = z.infer<typeof ChatInterfacePropsSchema>;
export type MediaCanvasProps = z.infer<typeof MediaCanvasPropsSchema>;
export type TimelineBarProps = z.infer<typeof TimelineBarPropsSchema>;
