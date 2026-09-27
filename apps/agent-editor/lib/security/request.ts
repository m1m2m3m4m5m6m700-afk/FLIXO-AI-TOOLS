import { z } from "zod";
import { ChatMessageSchema } from "../schemas/agent";
import { ProjectStateSchema } from "../schemas/project";

const MAX_MESSAGE_CHARS = 8_000;
const MAX_HISTORY_MESSAGES = 24;
const MAX_HISTORY_CHARS = 4_000;
const MAX_TOTAL_HISTORY_CHARS = 32_000;
const MAX_PROJECT_STATE_BYTES = 128 * 1024;

const MetadataOnlyProjectStateSchema = ProjectStateSchema.superRefine((projectState, ctx) => {
  projectState.layers.forEach((layer, index) => {
    const source = layer as unknown as Record<string, unknown>;
    if ("url" in source) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["layers", index, "url"],
        message: "Raw media URLs are not accepted by the agent gateway.",
      });
    }
    if ("content" in source) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["layers", index, "content"],
        message: "Layer content is not accepted by the agent gateway.",
      });
    }
    if ("metadata" in source && Object.keys(layer.metadata).length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["layers", index, "metadata"],
        message: "Layer metadata is not accepted by the agent gateway.",
      });
    }
  });

  if (projectState.timeline.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["timeline"],
      message: "Timeline snapshots are not accepted by the agent gateway.",
    });
  }
});

export const ChatRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
    history: z.array(ChatMessageSchema).max(MAX_HISTORY_MESSAGES).default([]),
    projectState: MetadataOnlyProjectStateSchema.optional(),
  })
  .strict();

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export function sanitizeText(value: string, maxLength: number): string {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeChatRequest(raw: unknown): ChatRequest {
  if (
    raw !== null &&
    typeof raw === "object" &&
    "projectState" in raw &&
    (raw as { projectState?: unknown }).projectState !== undefined
  ) {
    const serializedProjectState = JSON.stringify(
      (raw as { projectState: unknown }).projectState,
    );
    const projectStateBytes = new TextEncoder().encode(serializedProjectState).byteLength;
    if (projectStateBytes > MAX_PROJECT_STATE_BYTES) {
      throw new Error("PROJECT_STATE_TOO_LARGE");
    }
  }

  const parsed = ChatRequestSchema.parse(raw);
  let totalHistoryChars = 0;

  const history = parsed.history.map((message) => {
    const content = sanitizeText(message.content, MAX_HISTORY_CHARS);
    totalHistoryChars += content.length;
    if (totalHistoryChars > MAX_TOTAL_HISTORY_CHARS) {
      throw new Error("HISTORY_TOO_LARGE");
    }

    if (message.role !== "user" && message.role !== "assistant") {
      return null;
    }

    return {
      id: message.id,
      role: message.role,
      content,
      timestamp: message.timestamp,
    };
  });

  return {
    message: sanitizeText(parsed.message, MAX_MESSAGE_CHARS),
    history: history.filter(
      (message): message is NonNullable<typeof message> => message !== null,
    ),
    projectState: parsed.projectState
      ? ProjectStateSchema.parse({
          ...parsed.projectState,
          layers: parsed.projectState.layers.map(({ metadata: _metadata, ...layer }) => ({
            ...layer,
            metadata: {},
          })),
          timeline: [],
        })
      : undefined,
  };
}
