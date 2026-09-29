import { afterEach, describe, expect, it, vi } from "vitest";
import { listExternalAgentLearning } from "../src/server/agent/learning-persistence";

describe("external agent learning security boundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
  });

  it("loads only verified canonical-green learning into agent context", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "x".repeat(40);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    await listExternalAgentLearning("a".repeat(40), 48);

    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(requestUrl).toContain("status=eq.VERIFIED");
    expect(requestUrl).toContain("canonical_green=eq.true");
    expect(requestUrl).not.toContain("status=neq.BLOCKED");
  });
});
