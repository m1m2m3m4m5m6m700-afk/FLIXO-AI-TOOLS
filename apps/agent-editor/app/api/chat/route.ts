import { NextResponse } from "next/server";
import { z } from "zod";
import { AgentRuntime } from "@/lib/agent/runtime";
import { createDefaultToolRegistry } from "@/lib/tools";
import { AgentResponseSchema, ChatMessageSchema } from "@/lib/schemas/agent";
import { ProjectStateSchema } from "@/lib/schemas/project";

const RequestBodySchema = z.object({
  message: z.string().trim().min(1),
  history: z.array(ChatMessageSchema).default([]),
  projectState: ProjectStateSchema.optional(),
});

const ErrorResponseSchema = z.object({
  error: z.string().min(1),
  details: z.unknown().optional(),
});

function encodeEvent(event: string, data: unknown): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(
    "event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n",
  );
}

function createAgentStream(response: z.infer<typeof AgentResponseSchema>, signal: AbortSignal): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const call of response.requestedToolCalls) {
          if (signal.aborted) {
            controller.close();
            return;
          }
          controller.enqueue(
            encodeEvent("tool_call_start", {
              callId: call.callId,
              toolName: call.toolName,
              parameters: call.parameters,
            }),
          );
        }

        for (const result of response.toolResults) {
          if (signal.aborted) {
            controller.close();
            return;
          }
          controller.enqueue(encodeEvent("tool_call_end", result));
        }

        if (response.updatedProjectState) {
          controller.enqueue(
            encodeEvent("state_update", {
              projectState: response.updatedProjectState,
            }),
          );
        }

        for (const token of response.content.split(/(?=\s)|(?<=\s)/).filter(Boolean)) {
          if (signal.aborted) {
            controller.close();
            return;
          }
          controller.enqueue(encodeEvent("token", { text: token }));
          await new Promise((resolve) => setTimeout(resolve, 5));
        }

        controller.enqueue(encodeEvent("agent_response", response));
        controller.enqueue(encodeEvent("done", { messageId: response.messageId }));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const rawBody: unknown = await request.json();
    const parsed = RequestBodySchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "Invalid Request Schema",
          details: parsed.error.format(),
        }),
        { status: 400 },
      );
    }

    const runtime = new AgentRuntime(createDefaultToolRegistry(), {
      useMockEngine: true,
    });

    const agentResponse = AgentResponseSchema.parse(
      await runtime.processUserMessage(
        parsed.data.message,
        parsed.data.history,
        parsed.data.projectState,
      ),
    );

    return createAgentStream(agentResponse, request.signal);
  } catch (error) {
    return NextResponse.json(
      ErrorResponseSchema.parse({
        error: error instanceof Error ? error.message : "Internal Agent Error",
      }),
      { status: 500 },
    );
  }
}
