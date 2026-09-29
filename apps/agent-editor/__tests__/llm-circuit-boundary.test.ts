import { describe, expect, it } from "vitest";
import { LLMRouter } from "../lib/llm/router";
import type { LLMProvider, LLMStreamEvent, LLMStreamRequest } from "../lib/llm/types";

function failing(name: LLMProvider["name"], model: string): LLMProvider {
  return {
    name,
    model,
    isConfigured: () => true,
    stream: async function* (_request: LLMStreamRequest): AsyncGenerator<LLMStreamEvent> {
      throw new Error("provider-down");
    },
  };
}

describe("LLMRouter circuit and attempt budget", () => {
  it("does not invoke a cooling provider again until cooldown expires", async () => {
    let calls = 0;
    const provider: LLMProvider = {
      name: "openai",
      model: "model-a",
      isConfigured: () => true,
      stream: async function* (_request: LLMStreamRequest): AsyncGenerator<LLMStreamEvent> {
        calls += 1;
        throw new Error("provider-down");
      },
    };
    const router = new LLMRouter([provider]);

    await expect((async () => {
      for await (const _event of router.stream({
        model: "",
        systemPrompt: "test",
        messages: [{ role: "user", content: "hello" }],
        tools: [],
      })) {}
    })()).rejects.toThrow();

    await expect((async () => {
      for await (const _event of router.stream({
        model: "",
        systemPrompt: "test",
        messages: [{ role: "user", content: "hello" }],
        tools: [],
      })) {}
    })()).rejects.toThrow("currently cooling down");

    expect(calls).toBe(2);
  });

  it("caps a failing provider set at three provider attempts", async () => {
    const calls: string[] = [];
    const providers = ([
      ["openai", "model-a"],
      ["anthropic", "model-b"],
      ["gemini", "model-c"],
    ] as const).map(([name, model]) => {
      const provider = failing(name, model);
      const original = provider.stream;
      provider.stream = async function* (request: LLMStreamRequest) {
        calls.push(name);
        yield* original(request);
      };
      return provider;
    });

    const router = new LLMRouter(providers);
    await expect((async () => {
      for await (const _event of router.stream({
        model: "",
        systemPrompt: "test",
        messages: [{ role: "user", content: "hello" }],
        tools: [],
      })) {}
    })()).rejects.toThrow();

    expect(calls).toHaveLength(3);
    expect(new Set(calls).size).toBe(3);
  });
});
