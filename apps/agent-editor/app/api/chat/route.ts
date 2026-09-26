import { NextResponse } from "next/server";
import { z } from "zod";
import { AgentRuntime, hasLiveLlmKey } from "@/lib/agent/runtime";
import { createDefaultToolRegistry } from "@/lib/tools";
import {
  AgentResponseSchema,
  ChatMessageSchema,
} from "@/lib/schemas/agent";
import { ProjectStateSchema } from "@/lib/schemas/project";

export const runtime = "nodejs";

const RequestBodySchema = z
  .object({
    message: z.string().min(1).max(100_000),
    history: z.array(ChatMessageSchema).max(20_000).default([]),
    projectState: ProjectStateSchema.optional(),
  })
  .strict();

const ErrorBodySchema = z
  .object({
    error: z.string().min(1),
    details: z.unknown().optional(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const rawBody: unknown = await request.json();
    const parsed = RequestBodySchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        ErrorBodySchema.parse({
          error: "Invalid Schema",
          details: parsed.error.flatten(),
        }),
        { status: 400 },
      );
    }

    const runtime = new AgentRuntime({
      registry: createDefaultToolRegistry(),
      maxIterations: 5,
      useMockEngine: hasLiveLlmKey() ? true : undefined,
    });

    const response = AgentResponseSchema.parse(
      await runtime.processUserMessage(
        parsed.data.message,
        parsed.data.history,
        parsed.data.projectState,
      ),
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      ErrorBodySchema.parse({
        error: error instanceof Error ? error.message : "Internal Error",
      }),
      { status: 500 },
    );
  }
}