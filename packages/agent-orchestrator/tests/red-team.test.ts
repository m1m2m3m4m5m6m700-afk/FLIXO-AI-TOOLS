import { describe, expect, it } from "vitest";
import { RedTeamWorker } from "../src/red-team.ts";
import type { AgentModelInvoker } from "../src/model-adapter.ts";

describe("RedTeamWorker", () => {
  it("rewards verified findings and exposes false-positive penalties", async () => {
    const invoker: AgentModelInvoker = {
      async invoke(request) {
        if (request.turn === 1) {
          return { content: JSON.stringify({ findings: [{ content: "missing verification", evidence: { test: "none" }, verified: true }] }) };
        }
        return {
          content: JSON.stringify({
            status: "completed",
            summary: "Verified one concrete weakness.",
            findings: [{
              category: "security",
              content: "missing verification",
              evidence: { test: "none" },
              verified: true,
            }],
            agreement: 0.95,
            disputes: [],
          }),
        };
      },
    };

    const report = await new RedTeamWorker(invoker).run({
      stepId: "red-1",
      commandId: "cmd-red",
      role: "red-team",
      objective: "Audit a proposed change.",
      constraints: ["direct-command-only"],
      context: {},
    });

    expect(report.status).toBe("completed");
    expect(report.evidence?.redTeam).toBe(true);
    expect((report.evidence?.redTeamReward as { score: number }).score).toBeGreaterThanOrEqual(80);
    expect(report.evidence?.verifiedFindings).toBe(1);
  });
});


test("red team reward exposes false-positive penalty", async () => {
  const worker = new RedTeamWorker({
    async invoke(request) {
      const system = request.messages[0]?.content ?? "";
      if (system.includes("neutral RED TEAM adjudicator")) {
        return {
          content: JSON.stringify({
            status: "completed",
            summary: "one supported defect and one false positive",
            agreement: 0.8,
            disputes: ["false-positive"],
            findings: [
              { category: "security", content: "supported defect", evidence: { test: "x" }, verified: true },
              { category: "evidence", content: "unsupported claim", evidence: {}, verified: false },
            ],
          }),
        };
      }
      return { content: JSON.stringify({ findings: [] }), evidence: {} };
    },
  });

  const report = await worker.run({
    stepId: "step-red-penalty",
    commandId: "cmd-red-penalty",
    role: "red-team",
    objective: "attack the proposal",
    constraints: [],
    context: {},
  });
  const evidence = report.evidence as { verifiedFindings: number; falsePositiveFindings: number; redTeamReward: { score: number; reasons: readonly string[] } };
  assert.equal(evidence.verifiedFindings, 1);
  assert.equal(evidence.falsePositiveFindings, 1);
  assert.ok(evidence.redTeamReward.reasons.includes("false-positive-adversarial-finding"));
});
