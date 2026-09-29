"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { interpretConfirmation, type ConfirmationDecision } from "@flixo/agent-runtime";
import { z } from "zod";
import {
  AgentResponseSchema,
  ChatMessageSchema,
  type ChatMessage,
} from "@/lib/schemas/agent";
import { ProjectStateSchema, type ProjectState } from "@/lib/schemas/project";
import { prepareAgentLocalExecution, type PendingAgentExecution } from "@/lib/agent/confirmation-gate";
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
  const [confirmationPending, setConfirmationPending] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const pendingExecutionRef = useRef<PendingAgentExecution | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const executePendingExecution = useCallback(
    async (pending: PendingAgentExecution, assistantMessageId: string) => {
      setIsStreaming(true);
      setActiveTool(null);
      setManualFallbackPath(null);
      let working: ProjectState;
      let failedToolName: string | null = null;
      try {
        if (!projectState) throw new Error("AGENT_PROJECT_STATE_REQUIRED");
        working = ProjectStateSchema.parse(projectState);
        for (const call of pending.requestedToolCalls) {
          const plan = pending.localExecutionPlans.find(
            (candidate) => candidate.callId === call.callId,
          );
          if (!plan) throw new Error("AGENT_EXECUTION_PLAN_MISSING");
          failedToolName = call.toolName;
          setActiveTool(call.toolName);
          working = await executeAgentToolLocally(
            working,
            call,
            plan,
            "CONFIRM",
          );
          setProjectState(working);
          failedToolName = null;
        }
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: "Confirmed. Local execution completed.",
                }
              : message,
          ),
        );
      } catch (error) {
        if (failedToolName) {
          setManualFallbackPath(
            "/en/tools/" + encodeURIComponent(failedToolName),
          );
        }
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content:
                    error instanceof Error
                      ? error.message
                      : "Local execution failed.",
                }
              : message,
          ),
        );
      } finally {
        setActiveTool(null);
        setIsStreaming(false);
      }
    },
    [projectState, setProjectState],
  );

  const confirmPendingExecution = useCallback(async () => {
    const pending = pendingExecutionRef.current;
    if (!pending || isStreaming) return;
    pendingExecutionRef.current = null;
    setConfirmationPending(false);
    const now = new Date().toISOString();
    const userMessage = ChatMessageSchema.parse({
      id: crypto.randomUUID(),
      role: "user",
      content: "Confirm",
      timestamp: now,
    });
    const assistantMessageId = crypto.randomUUID();
    const assistantMessage = ChatMessageSchema.parse({
      id: assistantMessageId,
      role: "assistant",
      content: "Confirmed. Executing the approved local edit.",
      timestamp: now,
    });
    setMessages((previous) => [...previous, userMessage, assistantMessage]);
    await executePendingExecution(pending, assistantMessageId);
  }, [executePendingExecution, isStreaming]);

  const cancelPendingExecution = useCallback(() => {
    if (!pendingExecutionRef.current) return;
    pendingExecutionRef.current = null;
    setConfirmationPending(false);
    setActiveTool(null);
    setManualFallbackPath(null);
    const now = new Date().toISOString();
    setMessages((previous) => [
      ...previous,
      ChatMessageSchema.parse({
        id: crypto.randomUUID(),
        role: "user",
        content: "Cancel",
        timestamp: now,
      }),
      ChatMessageSchema.parse({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Cancelled. No local tool was executed.",
        timestamp: now,
      }),
    ]);
  }, []);

  const handleAgentResponse = useCallback(
    (response: z.infer<typeof AgentResponseSchema>, assistantMessageId: string) => {
      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantMessageId
            ? { ...message, content: response.content }
            : message,
        ),
      );
      const pending = prepareAgentLocalExecution(response);
      if (pending) {
        pendingExecutionRef.current = pending;
        setConfirmationPending(true);
        setActiveTool(null);
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content:
                    response.content +
                    "

Review the requested edit, then Confirm or Cancel.",
                }
              : message,
          ),
        );
        return;
      }
      if (response.requiresUserConfirmation) {
        throw new Error("AGENT_EXECUTION_CONFIRMATION_REQUIRED");
      }
      if (response.updatedProjectState) {
        const parsed = ProjectStateSchema.safeParse(response.updatedProjectState);
        if (parsed.success) setProjectState(parsed.data);
      }
    },
    [setProjectState],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const normalizedContent = content.trim();
      if (!normalizedContent) return;

      if (pendingExecutionRef.current) {
        if (isStreaming) return;
        const decision: ConfirmationDecision = interpretConfirmation(
          normalizedContent,
        );
        if (decision === "CONFIRM") {
          await confirmPendingExecution();
          return;
        }
        if (decision === "CANCEL") {
          cancelPendingExecution();
          return;
        }
        const now = new Date().toISOString();
        setMessages((previous) => [
          ...previous,
          ChatMessageSchema.parse({
            id: crypto.randomUUID(),
            role: "user",
            content: normalizedContent,
            timestamp: now,
          }),
          ChatMessageSchema.parse({
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Confirmation required before the pending edit can run. Reply Confirm or Cancel.",
            timestamp: now,
          }),
        ]);
        return;
      }

      if (isStreaming) return;

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
          z
            .object({
              callId: z.string().min(1),
              toolName: z.string().min(1),
            })
            .parse(JSON.parse(event.data));
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
          handleAgentResponse(response, assistantMessageId);
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
          handleAgentResponse(result, assistantMessageId);
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
    [
      cancelPendingExecution,
      confirmPendingExecution,
      handleAgentResponse,
      isStreaming,
      projectState,
    ],
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
    confirmationPending,
    sendMessage,
    confirmPendingExecution,
    cancelPendingExecution,
    stopStreaming,
    setProjectState,
  };
}
