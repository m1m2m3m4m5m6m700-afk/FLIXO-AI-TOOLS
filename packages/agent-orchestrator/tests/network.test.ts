import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_AGENT_NETWORK,
  AgentNetworkControlPlane,
  SupervisedAgentRegistry,
} from "../src/network.ts";

test("registers exactly ten non-autonomous agents", () => {
  assert.equal(DEFAULT_AGENT_NETWORK.length, 10);
  assert.ok(DEFAULT_AGENT_NETWORK.every((agent) => agent.autonomous === false && agent.canDelegate === false));
});

test("rejects system-issued commands", () => {
  const network = new AgentNetworkControlPlane();
  assert.throws(() => network.begin("cmd-1", "system"), /DIRECT_HUMAN_COMMAND_REQUIRED/);
});

test("requires active human command before authorization", () => {
  const network = new AgentNetworkControlPlane();
  assert.throws(() => network.authorize("step-1", "cmd-1", "implementer"), /COMMAND_NOT_ACTIVE/);
});

test("enforces capabilities", () => {
  const network = new AgentNetworkControlPlane();
  network.begin("cmd-1", "human");
  assert.throws(
    () => network.authorize("step-1", "cmd-1", "reviewer", ["implementation"]),
    /AGENT_CAPABILITY_DENIED/,
  );
  network.end("cmd-1");
});

test("records supervised heartbeat and report events", () => {
  const network = new AgentNetworkControlPlane();
  network.begin("cmd-1", "human");
  network.authorize("step-1", "cmd-1", "tester", ["testing"]);
  network.heartbeat({
    commandId: "cmd-1",
    stepId: "step-1",
    agentId: "tester",
    status: "running",
    progressPercent: 50,
    phase: "verification",
    timestamp: new Date().toISOString(),
  });
  network.report("cmd-1", "step-1", "tester", "completed", "tests passed");
  const snapshot = network.snapshot();
  assert.equal(snapshot.heartbeats.length, 1);
  assert.equal(snapshot.events.filter((event) => event.type === "report").length, 1);
  network.end("cmd-1");
});

test("registry rejects autonomous adapters", () => {
  const registry = new SupervisedAgentRegistry();
  assert.throws(() => registry.register({
    descriptor: {
      ...DEFAULT_AGENT_NETWORK[0],
      autonomous: true,
    },
    execute: async () => ({ status: "completed", summary: "x" }),
  }), /AUTONOMOUS_AGENT_FORBIDDEN/);
});
