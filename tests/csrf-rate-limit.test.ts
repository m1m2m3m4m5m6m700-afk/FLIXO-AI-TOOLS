import assert from "node:assert/strict";
import test from "node:test";
import { rateLimit, RATE_PRESETS } from "../src/lib/server/security/csrf.ts";

test("rate limiter fails closed after burst capacity", () => {
  const key = "red-team-v2-" + crypto.randomUUID();
  for (let index = 0; index < RATE_PRESETS.toolRequest.capacity; index += 1) {
    assert.equal(rateLimit(key, RATE_PRESETS.toolRequest).allowed, true);
  }
  assert.equal(rateLimit(key, RATE_PRESETS.toolRequest).allowed, false);
});

test("rate limiter rejects invalid configuration", () => {
  assert.throws(
    () => rateLimit("red-team-invalid", { capacity: 0, refillPerSecond: 1 }),
    /INVALID_RATE_LIMIT_CONFIGURATION/,
  );
  assert.throws(
    () => rateLimit("red-team-invalid-2", { capacity: 1, refillPerSecond: 0 }),
    /INVALID_RATE_LIMIT_CONFIGURATION/,
  );
});
