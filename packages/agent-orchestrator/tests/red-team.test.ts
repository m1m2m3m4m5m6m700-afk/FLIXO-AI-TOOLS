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
