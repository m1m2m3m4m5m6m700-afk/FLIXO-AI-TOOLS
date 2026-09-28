import assert from "node:assert/strict";
import test from "node:test";
import { ModelProviderClient } from "@flixo/agent-runtime";

test("Gemini API keys are sent in headers, never query parameters", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let headers: Record<string, string> = {};
  globalThis.fetch = (async (input, init) => {
    requestUrl = String(input);
    headers = Object.fromEntries(new Headers(init?.headers).entries());
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"status":"completed"}' }] } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    await new ModelProviderClient({
      provider: "gemini",
      model: "gemini-test",
      apiKey: "secret-gemini-key",
    }).complete([{ role: "user", content: "test" }]);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requestUrl.includes("secret-gemini-key"), false);
  assert.equal(new URL(requestUrl).search, "");
  assert.equal(headers["x-goog-api-key"], "secret-gemini-key");
});
