import { describe, expect, it } from "vitest";
import { CANONICAL_AGENT_TOOLS, validateCanonicalAgentParameters } from "../lib/tools/canonical";
import { toLLMTools } from "../lib/llm";
import { LLMRouter } from "../lib/llm/router";
import { sanitizeChatRequest } from "../lib/security/request";
import type { LLMProvider, LLMStreamEvent, LLMStreamRequest } from "../lib/llm";

function fakeProvider(name: "openai" | "anthropic", model: string, events: AsyncIterable<LLMStreamEvent>): LLMProvider {
  return {
    name,
    model,
    isConfigured: () => true,
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

describe("canonical production orchestration contracts", () => {
  it("publishes exactly the 10 canonical MVP tools", () => {
    const tools = toLLMTools(CANONICAL_AGENT_TOOLS);
    expect(tools).toHaveLength(10);
    expect(tools.map((tool) => tool.name)).toEqual([
      "background-remover","image-upscaler","image-cropper","image-compressor","image-converter",
      "image-effects","video-trimmer","video-cropper","video-resizer","video-compressor",
    ]);
    expect(JSON.stringify(tools)).not.toContain("example.com");
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

  it("opens a provider circuit after failure and skips it during cooldown", async () => {
    const router = new LLMRouter([
      fakeProvider("openai", "test-openai", failingProvider()),
    ]);

    await expect((async () => {
      for await (const _event of router.stream({
        model: "", systemPrompt: "test", messages: [{ role: "user", content: "hello" }], tools: [],
      })) {
        // consume until provider failure
      }
    })()).rejects.toThrow();

    await expect((async () => {
      for await (const _event of router.stream({
        model: "", systemPrompt: "test", messages: [{ role: "user", content: "hello" }], tools: [],
      })) {
        // a cooling provider must not be invoked again
      }
    })()).rejects.toThrow("currently cooling down");
  });

  it("sanitizes control characters and rejects oversized history", () => {
    expect(sanitizeChatRequest({ message: "  Hello\u0000 FLIXO  ", history: [] }).message).toBe("Hello FLIXO");
    expect(() => sanitizeChatRequest({
      message: "hello",
      history: Array.from({ length: 25 }, (_, index) => ({
        id: crypto.randomUUID(), role: "user", content: String(index), timestamp: "2026-09-27T00:00:00.000Z",
      })),
    })).toThrow();
  });

  it("rejects unknown and non-canonical parameters", () => {
    expect(validateCanonicalAgentParameters("image-effects", { contrast: 110 })).toEqual({ contrast: 110 });
    expect(() => validateCanonicalAgentParameters("image-effects", {
      contrast: 110, imageUrl: "https://private.example/file.png",
    })).toThrow();
    expect(() => validateCanonicalAgentParameters("non-existent", {})).toThrow();
  });
});
