"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  AgentResponseSchema,
  ChatMessageSchema,
  type ChatMessage,
} from "@/lib/schemas/agent";
import { ProjectStateSchema, type ProjectState } from "@/lib/schemas/project";

export interface UseAgentChatOptions {
  initialProjectState?: ProjectState;
}

type SseEvent = { event: string; data: string };

function parseSseBlock(block: string): SseEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  return dataLines.length ? { event, data: dataLines.join("\n") } : null;
}

function appendAssistantText(
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  assistantMessageId: string,
  text: string,
) {
  setMessages((previous) =>
    previous.map((message) =>
      message.id === assistantMessageId
        ? { ...message, content: message.content + text }
        : message,
    ),
  );
}

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [projectState, setProjectState] = useState<ProjectState | undefined>(
    () =>
      options.initialProjectState
        ? ProjectStateSchema.parse(options.initialProjectState)
        : undefined,
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const sendMessage = useCallback(
    async (content: string) => {
      const normalizedContent = content.trim();
      if (!normalizedContent || isStreaming) return;

      const now = new Date().toISOString();
      const userMessage = ChatMessageSchema.parse({
        id: crypto.randomUUID(),
        role: "user",
        content: normalizedContent,
        timestamp: now,
      });
      const assistantMessageId = crypto.randomUUID();
      const assistantMessage = ChatMessageSchema.parse({
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: now,
      });
      const requestHistory = messagesRef.current.filter(
        (message) => message.content.trim().length > 0,
      );

      setMessages((previous) => [...previous, userMessage, assistantMessage]);
      setIsStreaming(true);
      setActiveTool(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const applyEvent = (event: SseEvent) => {
        if (event.event === "token") {
          const payload = z.object({ text: z.string().min(1) }).parse(JSON.parse(event.data));
          appendAssistantText(setMessages, assistantMessageId, payload.text);
          return;
        }
        if (event.event === "tool_call_start") {
          const payload = z.object({
            callId: z.string().min(1),
            toolName: z.string().min(1),
          }).parse(JSON.parse(event.data));
          setActiveTool(payload.toolName);
          return;
        }
        if (event.event === "tool_call_end") {
          setActiveTool(null);
          return;
        }
        if (event.event === "state_update") {
          const payload = z.object({ projectState: z.unknown() }).parse(JSON.parse(event.data));
          const parsed = ProjectStateSchema.safeParse(payload.projectState);
          if (parsed.success) setProjectState(parsed.data);
          return;
        }
        if (event.event === "error") {
          const payload = z.object({
            error: z.literal("AGENT_STREAM_ERROR"),
          }).parse(JSON.parse(event.data));
          void payload;
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: "The agent connection was interrupted. Please retry the request." }
                : message,
            ),
          );
          return;
        }
        if (event.event === "agent_response") {
          const response = AgentResponseSchema.parse(JSON.parse(event.data));
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: response.content }
                : message,
            ),
          );
          if (response.updatedProjectState) {
            const parsed = ProjectStateSchema.safeParse(response.updatedProjectState);
            if (parsed.success) setProjectState(parsed.data);
          }
        }
      };

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            message: normalizedContent,
            history: requestHistory,
            projectState,
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || "Chat request failed with HTTP " + response.status);
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const result = AgentResponseSchema.parse(await response.json());
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantMessageId ? { ...message, content: result.content } : message,
            ),
          );
          if (result.updatedProjectState) {
            const parsed = ProjectStateSchema.safeParse(result.updatedProjectState);
            if (parsed.success) setProjectState(parsed.data);
          }
        } else if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          const flush = (final: boolean) => {
            while (true) {
              const separatorIndex = buffer.indexOf("\n\n");
              if (separatorIndex === -1) break;
              const block = buffer.slice(0, separatorIndex);
              buffer = buffer.slice(separatorIndex + 2);
              const parsed = parseSseBlock(block);
              if (parsed) applyEvent(parsed);
            }
            if (final && buffer.trim()) {
              const parsed = parseSseBlock(buffer);
              if (parsed) applyEvent(parsed);
              buffer = "";
            }
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              flush(true);
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            flush(false);
          }
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") return;
        const errorMessage =
          error instanceof Error ? error.message : "Stream connection failed";
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: "Error: " + errorMessage }
              : message,
          ),
        );
      } finally {
        setIsStreaming(false);
        setActiveTool(null);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, projectState],
  );

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    messages,
    projectState,
    isStreaming,
    activeTool,
    sendMessage,
    stopStreaming,
    setProjectState,
  };
}
