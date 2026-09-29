import { describe, expect, it } from "vitest";
import { RequestBodyTooLargeError, readRequestBodyWithLimit } from "../lib/security/raw-body";

describe("streaming request byte guard", () => {
  it("accepts a body at or below the configured limit", async () => {
    const request = new Request("https://flixo.test/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "ok" }),
    });
    await expect(readRequestBodyWithLimit(request, 1024)).resolves.toContain('"message":"ok"');
  });

  it("rejects chunked bodies that exceed the hard byte limit", async () => {
    const request = new Request("https://flixo.test/api/chat", {
      method: "POST",
      body: "x".repeat(4096),
    });
    await expect(readRequestBodyWithLimit(request, 128)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });
});
