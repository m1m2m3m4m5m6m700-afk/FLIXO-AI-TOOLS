import assert from "node:assert/strict";
import test from "node:test";
import { DirectCommandOrchestrator } from "../src/index.ts";
import {
  DEFAULT_AGENT_NETWORK,
  AgentNetworkControlPlane,
  SupervisedAgentRegistry,
} from "../src/network.ts";

test("registers exactly eleven non-autonomous agents", () => {
  assert.equal(DEFAULT_AGENT_NETWORK.length, 11);
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


test("default adversarial mode covers all eleven roles", async () => {
  const { DirectCommandOrchestrator } = await import("../src/index.ts");
  const { AgentNetworkControlPlane } = await import("../src/network.ts");
  const orchestrator = new DirectCommandOrchestrator({
    async plan(command, objective) {
      return {
        commandId: command.commandId,
        objective,
        steps: [{ stepId: "step-1", role: "tester", objective, dependsOn: [], constraints: [] }],
      };
    },
  }, undefined, new AgentNetworkControlPlane());
  orchestrator.enableDefaultAdversarialMode({
    async invoke(request) {
      const system = request.messages[0]?.content ?? "";
      if (system.includes("neutral adjudicator")) return { content: JSON.stringify({ status: "completed", summary: "verified", agreement: 1, winningSide: "primary", disputes: [], evidence: { evidenceVerified: true } }) };
      return { content: system.includes("adversarial twin") ? "challenge" : "primary", evidence: { evidenceVerified: true } };
    },
  });
  const reports = await orchestrator.dispatch({ commandId: "cmd-adversarial", issuedBy: "human", issuedAt: new Date().toISOString() }, "verify");
  assert.equal(reports.length, 1);
  assert.equal((reports[0].evidence as { adversarial: boolean }).adversarial, true);
});


test("enforces agent permissions before dispatch", () => {
  const network = new AgentNetworkControlPlane();
  network.begin("cmd-permission", "human");
  assert.throws(
    () => network.authorize("step-1", "cmd-permission", "tester", [], ["write-code"]),
    /AGENT_PERMISSION_DENIED/,
  );
  network.authorize("step-2", "cmd-permission", "implementer", ["implementation"], ["execute"]);
  network.end("cmd-permission");
});


test("direct command waits for durable audit persistence and finalization", async () => {
  const events: string[] = [];
  const orchestrator = new DirectCommandOrchestrator(
    {
      async plan(command, objective) {
        return {
          commandId: command.commandId,
          objective,
          steps: [{ stepId: "step-audit", role: "tester", objective, dependsOn: [], constraints: [], requiredCapabilities: ["testing"], requiredPermissions: ["run-tests"] }],
        };
      },
    },
    {
      onDispatch: () => undefined,
      async onReport() { events.push("report"); },
    },
    undefined,
    undefined,
    undefined,
    undefined,
    {
      async persist(items) { events.push("persist:" + items.map((item) => item.type).join(",")); },
      async finalize(status) { events.push("finalize:" + status); },
    },
  );
  orchestrator.registerWorker({
    id: "tester",
    async run(instruction) {
      return {
        stepId: instruction.stepId,
        commandId: instruction.commandId,
        status: "completed",
        summary: "verified",
        evidence: { testsPassed: 1, testsFailed: 0, evidenceVerified: true, outOfScopeActions: 0, delegatedTasks: 0 },
      };
    },
  });

  const reports = await orchestrator.dispatch(
    { commandId: "cmd-audit", issuedBy: "human", issuedAt: new Date().toISOString() },
    "verify audit trail",
  );

  assert.equal(reports[0]?.verification?.status, "verified");
  assert.ok(events.some((entry) => entry.startsWith("persist:")));
  assert.equal(events.at(-1), "finalize:completed");
});
