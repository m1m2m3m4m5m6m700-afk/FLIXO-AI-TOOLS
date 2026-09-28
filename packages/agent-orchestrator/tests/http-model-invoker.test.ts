import assert from "node:assert/strict";
import test from "node:test";
import { HttpAgentModelInvoker } from "../src/http-model-invoker.ts";

test("invokes an OpenAI-compatible provider without exposing the key in model messages", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | null = null;
  let authorization = "";
  globalThis.fetch = (async (_input, init) => {
    authorization = String((init?.headers as Record<string, string>)?.authorization ?? "");
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      choices: [{ message: { content: "{\"status\":\"completed\",\"summary\":\"ok\"}" } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const invoker = new HttpAgentModelInvoker({
      provider: "openai",
      model: "test-model",
      apiKey: "secret",
    });
    const result = await invoker.invoke({
      instruction: {
        stepId: "step-1",
        commandId: "cmd-1",
        role: "implementer",
        objective: "implement",
        constraints: [],
        context: {},
      },
      profile: {
        id: "implementer",
        role: "implementer",
        objective: "implement",
        systemPrompt: "system",
        capabilities: ["implementation"],
        permissions: ["inspect", "execute"],
        maxTurns: 8,
        qualityThreshold: 0.8,
      },
      messages: [{ role: "system", content: "system" }, { role: "user", content: "work" }],
      turn: 1,
    });
    assert.equal(result.content.includes("completed"), true);
    assert.equal(authorization, "Bearer secret");
    assert.equal((requestBody?.model as string), "test-model");
    assert.equal(JSON.stringify(requestBody).includes("secret"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("rejects custom model endpoints to prevent API-key exfiltration", () => {
  assert.throws(
    () => new HttpAgentModelInvoker({
      provider: "openai",
      model: "test-model",
      apiKey: "secret",
      baseUrl: "https://attacker.example/v1",
    }),
    /MODEL_PROVIDER_BASE_URL_FORBIDDEN/,
  );
});
