import { NextResponse } from "next/server";
import { z } from "zod";
import { AgentRuntime, type AgentRuntimeStreamEvent } from "@/lib/agent/runtime";
import { createDefaultToolRegistry } from "@/lib/tools";
import { AgentResponseSchema } from "@/lib/schemas/agent";
import { createDefaultLLMRouter } from "@/lib/llm";
import { ChatRequestSchema, sanitizeChatRequest } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ErrorResponseSchema = z.object({
  error: z.string().min(1),
  requestId: z.string().uuid(),
});

const MAX_BODY_BYTES = 256 * 1024;

function encodeSseEvent(
  id: number,
  event: string,
  data: unknown,
): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(
    `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

function encodeHeartbeat(): Uint8Array {
  return new TextEncoder().encode(": ping\n\n");
}

function toPublicResponse(
  response: z.infer<typeof AgentResponseSchema>,
): z.infer<typeof AgentResponseSchema> {
  return AgentResponseSchema.parse({
    ...response,
    requestedToolCalls: response.requestedToolCalls.map((call) => ({
      callId: call.callId,
      toolName: call.toolName,
      parameters: {},
    })),
    toolResults: response.toolResults.map((result) => ({
      callId: result.callId,
      toolName: result.toolName,
      status: result.status,
      executionTimeMs: result.executionTimeMs,
    })),
  });
}

function createAgentStream(
  runtime: AgentRuntime,
  body: ReturnType<typeof sanitizeChatRequest>,
  requestId: string,
  signal: AbortSignal,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let eventId = 0;
      let heartbeat: ReturnType<typeof setInterval> | undefined;

      const enqueue = (event: string, data: unknown) => {
        if (signal.aborted) return false;
        eventId += 1;
        controller.enqueue(encodeSseEvent(eventId, event, data));
        return true;
      };

      try {
        controller.enqueue(new TextEncoder().encode("retry: 3000\n\n"));
        heartbeat = setInterval(() => {
          if (signal.aborted) {
            if (heartbeat) clearInterval(heartbeat);
            return;
          }
          controller.enqueue(encodeHeartbeat());
        }, 15_000);

        for await (const event of runtime.streamUserMessage(
          body.message,
          body.history,
          body.projectState,
        )) {
          if (signal.aborted) break;

          switch (event.type) {
            case "token":
              enqueue("token", { text: event.text });
              break;
            case "tool_call_start":
              enqueue("tool_call_start", {
                callId: event.callId,
                toolName: event.toolName,
              });
              break;
            case "tool_call_end":
              enqueue("tool_call_end", {
                callId: event.result.callId,
                toolName: event.result.toolName,
                status: event.result.status,
                executionTimeMs: event.result.executionTimeMs,
              });
              break;
            case "state_update":
              enqueue("state_update", { projectState: event.projectState });
              break;
            case "final":
              enqueue("agent_response", toPublicResponse(event.response));
              break;
          }
        }

        if (!signal.aborted) {
          enqueue("done", { requestId });
          controller.close();
        } else {
          controller.close();
        }
      } catch (error) {
        if (signal.aborted) {
          controller.close();
          return;
        }

        console.error(
          `[FLIXO_AGENT_STREAM_ERROR] requestId=${requestId} ${error instanceof Error ? error.name : "UnknownError"}`,
        );
        enqueue("error", { error: "AGENT_STREAM_ERROR", requestId });
        enqueue("done", { requestId, interrupted: true });
        controller.close();
      } finally {
        if (heartbeat) clearInterval(heartbeat);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
      "X-Request-ID": requestId,
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "UNSUPPORTED_MEDIA_TYPE",
          requestId,
        }),
        { status: 415 },
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "REQUEST_TOO_LARGE",
          requestId,
        }),
        { status: 413 },
      );
    }

    const rawBody: unknown = await request.json();
    const schemaCheck = ChatRequestSchema.safeParse(rawBody);
    if (!schemaCheck.success) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "INVALID_REQUEST_SCHEMA",
          requestId,
        }),
        { status: 400 },
      );
    }

    const body = sanitizeChatRequest(schemaCheck.data);
    const useMockEngine =
      process.env.NODE_ENV !== "production" &&
      process.env.FLIXO_ENABLE_MOCK_LLM === "true";
    const llmRouter = createDefaultLLMRouter();

    if (!useMockEngine && llmRouter.configuredProviders().length === 0) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "LLM_PROVIDER_UNAVAILABLE",
          requestId,
        }),
        { status: 503 },
      );
    }

    const runtime = new AgentRuntime(
      createDefaultToolRegistry(),
      { useMockEngine },
      llmRouter,
    );

    return createAgentStream(runtime, body, requestId, request.signal);
  } catch (error) {
    const isExpected =
      error instanceof Error &&
      /^(HISTORY_TOO_LARGE|Invalid|Request body|Unexpected end|JSON)/.test(error.message);

    console.error(
      `[FLIXO_AGENT_REQUEST_ERROR] requestId=${requestId} ${error instanceof Error ? error.name : "UnknownError"}`,
    );

    return NextResponse.json(
      ErrorResponseSchema.parse({
        error: isExpected ? "INVALID_REQUEST" : "INTERNAL_AGENT_ERROR",
        requestId,
      }),
      { status: isExpected ? 400 : 500 },
    );
  }
}
