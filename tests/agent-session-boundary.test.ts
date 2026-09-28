import assert from "node:assert/strict";
import test from "node:test";
import {
  createAgentSessionId,
  deriveAgentSessionIdentity,
  parseAgentSessionCookie,
} from "../src/lib/server/security/agent-session.ts";

test("session-derived persistence identities are isolated between anonymous sessions", () => {
  const sessionA = createAgentSessionId();
  const sessionB = createAgentSessionId();
  const a = deriveAgentSessionIdentity({
    sessionId: sessionA,
    conversationId: "shared-visible-id",
    taskId: "shared-visible-task",
    idempotencyKey: "shared-event",
    messageCount: 2,
  });
  const b = deriveAgentSessionIdentity({
    sessionId: sessionB,
    conversationId: "shared-visible-id",
    taskId: "shared-visible-task",
    idempotencyKey: "shared-event",
    messageCount: 2,
  });

  assert.notEqual(a.conversationId, b.conversationId);
  assert.notEqual(a.taskId, b.taskId);
  assert.notEqual(a.idempotencyKey, b.idempotencyKey);
});

test("session cookies reject malformed values", () => {
  assert.equal(parseAgentSessionCookie(undefined), null);
  assert.equal(parseAgentSessionCookie("flixo_agent_session=not-a-uuid"), null);
  const id = createAgentSessionId();
  assert.equal(parseAgentSessionCookie("foo=bar; flixo_agent_session=" + id), id);
});

test("caller-controlled ids remain bounded within the session namespace", () => {
  const sessionId = createAgentSessionId();
  const a = deriveAgentSessionIdentity({ sessionId, conversationId: "victim", taskId: "task", messageCount: 1 });
  const b = deriveAgentSessionIdentity({ sessionId, conversationId: "victim", taskId: "task", messageCount: 1 });
  assert.deepEqual(a, b);
  assert.match(a.conversationId, /^ANON-conversation:[a-f0-9]{64}$/u);
  assert.match(a.taskId, /^ANON-task:[a-f0-9]{64}$/u);
});
