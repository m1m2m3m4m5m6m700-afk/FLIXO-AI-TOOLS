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

test("rejects role policy escalation during agent registration", () => {
  const network = new AgentNetworkControlPlane();
  assert.throws(() => network.register({
    id: "researcher",
    role: "researcher",
    capabilities: ["research"],
    permissions: ["inspect", "network", "execute"],
    autonomous: false,
    canDelegate: false,
  }), /AGENT_POLICY_ESCALATION_FORBIDDEN/);
});

test("rejects unknown production agent identities", () => {
  assert.throws(() => new AgentNetworkControlPlane([{
    id: "rogue",
    role: "rogue",
    capabilities: ["research"],
    permissions: ["inspect"],
    autonomous: false,
    canDelegate: false,
  }]), /AGENT_POLICY_ESCALATION_FORBIDDEN/);
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

test("binds heartbeats and reports to the authorized step agent", () => {
  const network = new AgentNetworkControlPlane();
  network.begin("cmd-binding", "human");
  network.authorize("step-1", "cmd-binding", "tester", ["testing"], ["run-tests"]);
  assert.throws(() => network.heartbeat({
    commandId: "cmd-binding",
    stepId: "step-1",
    agentId: "reviewer",
    status: "running",
    progressPercent: 10,
    phase: "spoof",
    timestamp: new Date().toISOString(),
  }), /AGENT_STEP_ASSIGNMENT_MISMATCH/);
  assert.throws(() => network.report("cmd-binding", "step-1", "reviewer", "completed", "spoofed"), /AGENT_STEP_ASSIGNMENT_MISMATCH/);
  network.report("cmd-binding", "step-1", "tester", "completed", "ok");
  assert.throws(() => network.report("cmd-binding", "step-1", "tester", "completed", "duplicate"), /STEP_ALREADY_REPORTED/);
  network.end("cmd-binding");
});

test("rejects command-id reuse to prevent stale run ownership", () => {
  const network = new AgentNetworkControlPlane();
  network.begin("cmd-reuse", "human");
  network.end("cmd-reuse");
  assert.throws(() => network.begin("cmd-reuse", "human"), /COMMAND_ID_REUSE_FORBIDDEN/);
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


test("rejects tool execution plans without explicit execute permission", async () => {
  const orchestrator = new DirectCommandOrchestrator({
    async plan(command, objective) {
      return {
        commandId: command.commandId,
        objective,
        steps: [{
          stepId: "step-execute",
          role: "implementer",
          objective,
          dependsOn: [],
          constraints: [],
          execution: { toolId: "echo", parameters: {} },
        }],
      };
    },
  });
  await assert.rejects(
    () => orchestrator.dispatch(
      { commandId: "cmd-missing-execute", issuedBy: "human", issuedAt: new Date().toISOString() },
      "execute a tool",
    ),
    /EXECUTION_PERMISSION_REQUIRED/,
  );
});

test("waits for all parallel workers and marks the command failed when one worker throws", async () => {
  const timeline: string[] = [];
  const orchestrator = new DirectCommandOrchestrator(
    {
      async plan(command, objective) {
        return {
          commandId: command.commandId,
          objective,
          steps: [
            { stepId: "step-fail", role: "tester", objective, dependsOn: [], constraints: [] },
            { stepId: "step-slow", role: "performance", objective, dependsOn: [], constraints: [] },
          ],
        };
      },
    },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    {
      async persist() {},
      async finalize(status) { timeline.push("finalize:" + status); },
    },
  );
  orchestrator.registerWorker({
    id: "tester",
    async run() {
      await new Promise((resolve) => setTimeout(resolve, 10));
      throw new Error("WORKER_FAILURE");
    },
  });
  orchestrator.registerWorker({
    id: "performance",
    async run(instruction) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      timeline.push("slow-finished");
      return {
        stepId: instruction.stepId,
        commandId: instruction.commandId,
        status: "completed",
        summary: "ok",
        evidence: { testsPassed: 1, testsFailed: 0, evidenceVerified: true, outOfScopeActions: 0, delegatedTasks: 0 },
      };
    },
  });

  const reports = await orchestrator.dispatch(
    { commandId: "cmd-parallel-failure", issuedBy: "human", issuedAt: new Date().toISOString() },
    "exercise failure containment",
  );

  assert.equal(reports.find((report) => report.stepId === "step-fail")?.status, "failed");
  assert.equal(reports.find((report) => report.stepId === "step-slow")?.status, "completed");
  assert.deepEqual(timeline, ["slow-finished", "finalize:failed"]);
});

test("does not finalize the command when a completed report is unverified", async () => {
  const finalized: string[] = [];
  const orchestrator = new DirectCommandOrchestrator(
    {
      async plan(command, objective) {
        return {
          commandId: command.commandId,
          objective,
          steps: [{ stepId: "step-unverified", role: "tester", objective, dependsOn: [], constraints: [] }],
        };
      },
    },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    {
      async persist() {},
      async finalize(status) { finalized.push(status); },
    },
  );
  orchestrator.registerWorker({
    id: "tester",
    async run(instruction) {
      return {
        stepId: instruction.stepId,
        commandId: instruction.commandId,
        status: "completed",
        summary: "model claims success",
        evidence: { testsPassed: 1, testsFailed: 0, evidenceVerified: false },
      };
    },
  });

  const reports = await orchestrator.dispatch(
    { commandId: "cmd-unverified", issuedBy: "human", issuedAt: new Date().toISOString() },
    "reject unverified completion",
  );

  assert.equal(reports[0]?.status, "completed");
  assert.equal(reports[0]?.verification?.status, "unresolved");
  assert.deepEqual(finalized, ["failed"]);
});

test("audit failure does not strand the active command", async () => {
  let persistCalls = 0;
  const orchestrator = new DirectCommandOrchestrator(
    {
      async plan(command, objective) {
        return {
          commandId: command.commandId,
          objective,
          steps: [{ stepId: "step-audit-fail", role: "tester", objective, dependsOn: [], constraints: [] }],
        };
      },
    },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    {
      async persist() {
        persistCalls += 1;
        if (persistCalls === 1) throw new Error("AUDIT_WRITE_FAILED");
      },
      async finalize() {},
    },
  );
  orchestrator.registerWorker({
    id: "tester",
    async run(instruction) {
      return { stepId: instruction.stepId, commandId: instruction.commandId, status: "completed", summary: "ok", evidence: {} };
    },
  });

  await assert.rejects(
    () => orchestrator.dispatch({ commandId: "cmd-audit-fail", issuedBy: "human", issuedAt: new Date().toISOString() }, "test cleanup"),
    /AUDIT_WRITE_FAILED/,
  );

  const reports = await orchestrator.dispatch(
    { commandId: "cmd-audit-retry", issuedBy: "human", issuedAt: new Date().toISOString() },
    "second command after audit failure",
  );
  assert.equal(reports.length, 1);
});
