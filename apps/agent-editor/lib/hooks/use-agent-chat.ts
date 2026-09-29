"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  AgentResponseSchema,
  ChatMessageSchema,
  type ChatMessage,
} from "@/lib/schemas/agent";
import { ProjectStateSchema, type ProjectState } from "@/lib/schemas/project";
import { executeAgentToolLocally } from "@/lib/tools/local-executor";

export interface UseAgentChatOptions {
  initialProjectState?: ProjectState;
}

type SseEvent = { id: number | null; event: string; data: string };

function parseSseBlock(block: string): SseEvent | null {
  let event = "message";
  let id: number | null = null;
  const dataLines: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("id:")) {
      const parsed = Number(line.slice(3).trim());
      if (Number.isSafeInteger(parsed) && parsed >= 0) id = parsed;
    }
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }

  return dataLines.length ? { id, event, data: dataLines.join("\n") } : null;
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

const CONNECTION_INTERRUPTED_MESSAGE =
  "The agent connection was interrupted. Please retry the request.";

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
  const [manualFallbackPath, setManualFallbackPath] = useState<string | null>(null);
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
      setManualFallbackPath(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;
      let lastEventId = 0;
      let sawAgentResponse = false;
      let sawDone = false;
      let localExecutionPromise = Promise.resolve();

      const applyEvent = (event: SseEvent) => {
        if (event.id !== null && event.id <= lastEventId) return;
        if (event.id !== null) lastEventId = event.id;

        if (event.event === "token") {
          const payload = z
            .object({ text: z.string().min(1) })
            .parse(JSON.parse(event.data));
          appendAssistantText(setMessages, assistantMessageId, payload.text);
          return;
        }

        if (event.event === "tool_call_start") {
          const payload = z
            .object({
              callId: z.string().min(1),
              toolName: z.string().min(1),
            })
            .parse(JSON.parse(event.data));
          setActiveTool(payload.toolName);
          return;
        }

        if (event.event === "error") {
          z
            .object({ error: z.literal("AGENT_STREAM_ERROR") })
            .parse(JSON.parse(event.data));
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: CONNECTION_INTERRUPTED_MESSAGE }
                : message,
            ),
          );
          return;
        }

        if (event.event === "agent_response") {
          const response = AgentResponseSchema.parse(JSON.parse(event.data));
          sawAgentResponse = true;
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: response.content }
                : message,
            ),
          );
          if (response.requestedToolCalls.length > 0) {
            localExecutionPromise = localExecutionPromise.then(async () => {
              let working = ProjectStateSchema.parse(projectState);
              let failedToolName: string | null = null;
              try {
                if (response.localExecutionPlans.length !== response.requestedToolCalls.length) {
                  throw new Error("AGENT_EXECUTION_PLAN_SET_MISMATCH");
                }
                for (const call of response.requestedToolCalls) {
                  const plan = response.localExecutionPlans.find((candidate) => candidate.callId === call.callId);
                  if (!plan) throw new Error("AGENT_EXECUTION_PLAN_MISSING");
                  failedToolName = call.toolName;
                  setActiveTool(call.toolName);
                  working = await executeAgentToolLocally(working, call, plan);
                  setProjectState(working);
                  failedToolName = null;
                }
              } catch (error) {
                if (failedToolName) {
                  const locale = typeof window !== "undefined" && window.location.pathname.startsWith("/ar/") ? "ar" : "en";
                  setManualFallbackPath("/" + locale + "/tools/" + encodeURIComponent(failedToolName));
                }
                setMessages((previous) =>
                  previous.map((message) =>
                    message.id === assistantMessageId
                      ? { ...message, content: error instanceof Error ? error.message : "Local execution failed." }
                      : message,
                  ),
                );
              } finally {
                setActiveTool(null);
              }
            });
          }
          return;
        }

        if (event.event === "done") {
          const payload = z
            .object({
              requestId: z.string().uuid(),
              interrupted: z.boolean().optional(),
            })
            .parse(JSON.parse(event.data));
          sawDone = true;
          if (payload.interrupted && !sawAgentResponse) {
            setMessages((previous) =>
              previous.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: CONNECTION_INTERRUPTED_MESSAGE }
                  : message,
              ),
            );
          }
        }
      };

      const agentProjectState = projectState
        ? ProjectStateSchema.parse({
            ...projectState,
            layers: projectState.layers.map(({ url: _url, content: _content, metadata: _metadata, ...layer }) => layer),
            timeline: [],
          })
        : undefined;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            message: normalizedContent,
            history: requestHistory,
            projectState: agentProjectState,
          }),
        });

        if (!response.ok) {
          throw new Error("CHAT_REQUEST_FAILED");
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const result = AgentResponseSchema.parse(await response.json());
          sawAgentResponse = true;
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: result.content }
                : message,
            ),
          );
          if (result.updatedProjectState) {
            const parsed = ProjectStateSchema.safeParse(result.updatedProjectState);
            if (parsed.success) setProjectState(parsed.data);
          }
          return;
        }

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          const flush = (final: boolean) => {
            while (true) {
              const separatorMatch = buffer.match(/\r?\n\r?\n/);
              if (!separatorMatch || separatorMatch.index === undefined) break;
              const block = buffer.slice(0, separatorMatch.index);
              buffer = buffer.slice(
                separatorMatch.index + separatorMatch[0].length,
              );
              const parsed = parseSseBlock(block);
              if (parsed) applyEvent(parsed);
            }

            if (final) {
              buffer += decoder.decode();
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

        await localExecutionPromise;

        if (!sawDone && !sawAgentResponse) {
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: CONNECTION_INTERRUPTED_MESSAGE }
                : message,
            ),
          );
        }
      } catch {
        if (controller.signal.aborted) return;
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: CONNECTION_INTERRUPTED_MESSAGE }
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
    manualFallbackPath,
    sendMessage,
    stopStreaming,
    setProjectState,
  };
}
