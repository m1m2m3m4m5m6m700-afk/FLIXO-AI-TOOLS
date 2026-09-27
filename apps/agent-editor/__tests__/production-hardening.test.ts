import { describe, expect, it, vi } from "vitest";
import { getProviderApiKey } from "../lib/llm/credentials";
import { AnthropicProvider } from "../lib/llm/providers/anthropic";
import { OpenAIProvider } from "../lib/llm/providers/openai";
import type { LLMStreamRequest } from "../lib/llm/types";
import { sanitizeChatRequest } from "../lib/security/request";

const request: LLMStreamRequest = {
  model: "test-model",
  systemPrompt: "test",
  messages: [{ role: "user", content: "hello" }],
  tools: [],
};

function sseResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  });
}

const validProject = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Test",
  dimensions: { width: 1920, height: 1080, fps: 30 },
  durationSec: 0,
  layers: [],
  timeline: [],
  createdAt: "2026-09-27T00:00:00.000Z",
  updatedAt: "2026-09-27T00:00:00.000Z",
  version: 1,
};

describe("production hardening", () => {
  it("fails closed for plaintext provider credentials in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENAI_API_KEY", "plaintext-test-key");
    vi.stubEnv("FLIXO_LLM_KEYS_ENCRYPTED", "");
    vi.stubEnv("FLIXO_LLM_KEY_ENCRYPTION_KEY", "");

    try {
      expect(() => getProviderApiKey("openai")).toThrow(
        "PLAINTEXT_LLM_CREDENTIAL_DISABLED",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("fails closed for malformed OpenAI tool-call arguments", async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      sseResponse(
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","function":{"name":"remove_background","arguments":"{"}}]}}]}\n\ndata: [DONE]\n\n',
      )) as typeof fetch;

    try {
      const provider = new OpenAIProvider("test-model", "test-key");
      const consume = async () => {
        for await (const event of provider.stream(request)) void event;
      };
      await expect(consume()).rejects.toThrow("malformed tool arguments");
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it("fails closed for malformed Anthropic tool-call arguments", async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      sseResponse(
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"call-1","name":"remove_background"}}\n\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{"}}\n\ndata: {"type":"message_stop"}\n\n',
      )) as typeof fetch;

    try {
      const provider = new AnthropicProvider("test-model", "test-key");
      const consume = async () => {
        for await (const event of provider.stream(request)) void event;
      };
      await expect(consume()).rejects.toThrow("malformed tool arguments");
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it("bounds the serialized project state accepted by the agent API", () => {
    const oversizedProject = {
      ...validProject,
      layers: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Large metadata",
          type: "image",
          visible: true,
          locked: false,
          opacity: 1,
          transform: {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            zIndex: 0,
          },
          metadata: { payload: "x".repeat(140 * 1024) },
        },
      ],
    };

    expect(() =>
      sanitizeChatRequest({
        message: "hello",
        history: [],
        projectState: oversizedProject,
      }),
    ).toThrow("PROJECT_STATE_TOO_LARGE");
  });
});
