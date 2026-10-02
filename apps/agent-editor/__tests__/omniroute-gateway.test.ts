import { describe, expect, it, vi } from "vitest";
import { createDefaultLLMRouter } from "../lib/llm";

describe("OmniRoute gateway integration", () => {
  it("registers local auto routing as an OpenAI-compatible provider", () => {
    vi.stubEnv("FLIXO_OMNIROUTE_ENABLED", "true");
    vi.stubEnv("FLIXO_LLM_OMNIROUTE_MODEL", "auto");
    vi.stubEnv("FLIXO_OMNIROUTE_BASE_URL", "http://127.0.0.1:20128/v1");
    vi.stubEnv("FLIXO_OMNIROUTE_API_KEY", "");

    const router = createDefaultLLMRouter();
    const provider = router.configuredProviders().find((item) => item.name === "omniroute");

    expect(provider?.name).toBe("omniroute");
    expect(provider?.model).toBe("auto");
  });

  it("does not admit auto routing in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FLIXO_OMNIROUTE_ENABLED", "true");
    vi.stubEnv("FLIXO_LLM_OMNIROUTE_MODEL", "auto");

    const router = createDefaultLLMRouter();

    expect(router.configuredProviders().some((item) => item.name === "omniroute")).toBe(false);
  });
});
