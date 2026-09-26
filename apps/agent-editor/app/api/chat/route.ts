import { NextResponse } from "next/server";
import { z } from "zod";
import { AgentRuntime } from "@/lib/agent/runtime";
import { createDefaultToolRegistry } from "@/lib/tools";
import {
  AgentResponseSchema,
  ChatMessageSchema,
} from "@/lib/schemas/agent";
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

function eventStream(response: z.infer<typeof AgentResponseSchema>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`event: agent_response\ndata: ${JSON.stringify(response)}\n\n`),
      );
      controller.enqueue(encoder.encode("event: done\ndata: [DONE]\n\n"));
      controller.close();
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
      const body = ErrorResponseSchema.parse({
        error: "Invalid Request Schema",
        details: parsed.error.format(),
      });
      return NextResponse.json(body, { status: 400 });
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

    return eventStream(agentResponse);
  } catch (error) {
    const body = ErrorResponseSchema.parse({
      error: error instanceof Error ? error.message : "Internal Agent Error",
    });
    return NextResponse.json(body, { status: 500 });
  }
}
