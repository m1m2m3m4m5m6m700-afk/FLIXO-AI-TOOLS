import { describe, expect, it } from "vitest";
import { ToolRegistry } from "../lib/agent/registry";
import { createDefaultToolRegistry } from "../lib/tools";
import { LLMRouter } from "../lib/llm/router";
import { sanitizeChatRequest } from "../lib/security/request";
import type { LLMProvider, LLMStreamEvent, LLMStreamRequest } from "../lib/llm";

function fakeProvider(name: "openai" | "anthropic" | "gemini", model: string, events: AsyncIterable<LLMStreamEvent>): LLMProvider {
  return {
    name, model, isConfigured: () => true,
    stream: async function* (_request: LLMStreamRequest) { yield* events; },
  };
}

async function* failingProvider(): AsyncGenerator<LLMStreamEvent> {
  yield { type: "text_delta", text: "hello " };
  throw new Error("network dropped");
}

async function* recoveringProvider(): AsyncGenerator<LLMStreamEvent> {
  yield { type: "text_delta", text: "hello world" };
  yield { type: "turn_end", toolCalls: [] };
}

describe("production orchestration contracts", () => {
  it("publishes real JSON Schema from the canonical ToolRegistry", () => {
    const registry = createDefaultToolRegistry();
    const tool = registry.list().find((entry) => entry.name === "remove_background");
    expect(tool?.jsonSchemaInput.type).toBe("object");
    expect((tool?.jsonSchemaInput.properties as Record<string, unknown>)?.imageUrl).toBeDefined();
    expect((tool?.jsonSchemaInput.properties as Record<string, unknown>)?.threshold).toBeDefined();
  });

  it("fails over after a provider stream drops without duplicating committed text", async () => {
    const router = new LLMRouter([
      fakeProvider("openai", "test-openai", failingProvider()),
      fakeProvider("anthropic", "test-anthropic", recoveringProvider()),
    ]);
    const events: LLMStreamEvent[] = [];
    for await (const event of router.stream({
      model: "", systemPrompt: "test", messages: [{ role: "user", content: "hello" }], tools: [],
    })) events.push(event);
    expect(events.filter((event) => event.type === "text_delta").map((event) => event.text).join("")).toBe("hello world");
    expect(events.at(-1)).toEqual({ type: "turn_end", toolCalls: [] });
  });

  it("sanitizes control characters and rejects oversized history", () => {
    expect(sanitizeChatRequest({ message: "  Hello\u0000 FLIXO  ", history: [] }).message).toBe("Hello FLIXO");
    expect(() => sanitizeChatRequest({
      message: "hello",
      history: Array.from({ length: 25 }, (_, index) => ({
        id: crypto.randomUUID(), role: "user", content: String(index), timestamp: "2026-09-27T00:00:00.000Z"
      })),
    })).toThrow();
  });

  it("removes client-supplied tool traces from provider history", () => {
    const sanitized = sanitizeChatRequest({
      message: "continue",
      history: [{
        id: crypto.randomUUID(),
        role: "tool",
        content: "secret",
        timestamp: "2026-09-27T00:00:00.000Z",
        toolResults: [{
          callId: "call-1",
          toolName: "remove_background",
          status: "success",
          data: { processedImageUrl: "https://private.example/result.png" },
        }],
      }],
    });

    expect(sanitized.history).toHaveLength(0);
  });

  it("keeps the execution path fail-closed for unknown tools", async () => {
    const registry: ToolRegistry = createDefaultToolRegistry();
    const result = await registry.execute("security-test", "non_existent_tool", {});
    expect(result.status).toBe("error");
  });
});
