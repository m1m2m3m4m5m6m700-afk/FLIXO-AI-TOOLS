import { describe, expect, it } from "vitest";
import { FlixoRoutedModelInvoker } from "../lib/agent/flixo-model-invoker";

describe("FlixoRoutedModelInvoker", () => {
  it("uses the canonical task model router", async () => {
    const calls: string[] = [];
    const invoker = new FlixoRoutedModelInvoker({
      provider: "openrouter",
      timeoutMs: 1000,
      maxTokens: 256,
      env: { OPENROUTER_MODEL: "router/review-model" },
      callProvider: async (provider, _messages, _timeout, _tokens, model) => {
        calls.push(`${provider}:${model}`);
        return "ok";
      },
    });

    const response = await invoker.invoke({
      instruction: {
        commandId: "cmd",
        stepId: "step",
        role: "reviewer",
        objective: "review the security boundary",
        constraints: [],
        context: {},
      },
      profile: {
        id: "reviewer",
        role: "reviewer",
        objective: "review",
        systemPrompt: "review",
        capabilities: ["code-review"],
        permissions: ["inspect", "review"],
        maxTurns: 1,
        qualityThreshold: 0.8,
      },
      messages: [{ role: "user", content: "review" }],
      turn: 1,
    });

    expect(response.content).toBe("ok");
    expect(calls).toEqual(["openrouter:router/review-model"]);
    expect(response.evidence?.task).toBe("REVIEW");
  });

  it("uses the configured fallback provider after primary failure", async () => {
    const calls: string[] = [];
    const invoker = new FlixoRoutedModelInvoker({
      provider: "openai",
      fallbackProvider: "gemini",
      timeoutMs: 1000,
      maxTokens: 256,
      env: { OPENAI_MODEL: "gpt-primary", GEMINI_MODEL: "gemini-fallback" },
      callProvider: async (provider, _messages, _timeout, _tokens, model) => {
        calls.push(`${provider}:${model}`);
        if (provider === "openai") throw new Error("primary down");
        return "fallback";
      },
    });

    const response = await invoker.invoke({
      instruction: {
        commandId: "cmd-fallback",
        stepId: "step",
        role: "planner",
        objective: "plan the execution workflow",
        constraints: [],
        context: {},
      },
      profile: {
        id: "planner",
        role: "planner",
        objective: "plan",
        systemPrompt: "plan",
        capabilities: ["planning"],
        permissions: ["inspect", "propose"],
        maxTurns: 1,
        qualityThreshold: 0.8,
      },
      messages: [{ role: "user", content: "plan" }],
      turn: 1,
    });

    expect(response.content).toBe("fallback");
    expect(calls).toEqual(["openai:gpt-primary", "gemini:gemini-fallback"]);
    expect(response.evidence?.fallback).toBe(true);
  });
});
