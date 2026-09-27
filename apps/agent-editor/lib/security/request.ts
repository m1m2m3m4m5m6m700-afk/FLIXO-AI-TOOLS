import { z } from "zod";
import { ChatMessageSchema } from "../schemas/agent";
import { ProjectStateSchema } from "../schemas/project";

const MAX_MESSAGE_CHARS = 8_000;
const MAX_HISTORY_MESSAGES = 24;
const MAX_HISTORY_CHARS = 4_000;
const MAX_TOTAL_HISTORY_CHARS = 32_000;

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  history: z.array(ChatMessageSchema).max(MAX_HISTORY_MESSAGES).default([]),
  projectState: ProjectStateSchema.optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export function sanitizeText(value: string, maxLength: number): string {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeChatRequest(raw: unknown): ChatRequest {
  const parsed = ChatRequestSchema.parse(raw);
  let totalHistoryChars = 0;

  const history = parsed.history.map((message) => {
    const content = sanitizeText(message.content, MAX_HISTORY_CHARS);
    totalHistoryChars += content.length;
    if (totalHistoryChars > MAX_TOTAL_HISTORY_CHARS) {
      throw new Error("HISTORY_TOO_LARGE");
    }

    return {
      ...message,
      content,
      toolCalls: message.toolCalls?.slice(0, 8),
      toolResults: message.toolResults?.slice(0, 8).map((result) => ({
        ...result,
        errorDetails: undefined,
      })),
    };
  });

  return {
    message: sanitizeText(parsed.message, MAX_MESSAGE_CHARS),
    history,
    projectState: parsed.projectState,
  };
}
