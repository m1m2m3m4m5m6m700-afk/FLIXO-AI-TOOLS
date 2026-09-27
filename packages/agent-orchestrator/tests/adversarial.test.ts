import assert from "node:assert/strict";
import test from "node:test";
import { AdversarialTwinWorker } from "../src/adversarial.ts";

test("adversarial twin keeps primary and adversary independent, then adjudicates", async () => {
  const calls: string[] = [];
  const worker = new AdversarialTwinWorker(
    { id: "reviewer", role: "reviewer" },
    {
      maxRounds: 1,
      invoker: {
        async invoke(request) {
          const system = request.messages[0]?.content ?? "";
          if (system.includes("neutral adjudicator")) {
            calls.push("judge");
            return {
              content: JSON.stringify({
                status: "completed",
                summary: "The adversary identified a missing verification step.",
                agreement: 0.7,
                winningSide: "adversary",
                disputes: ["verification"],
                evidence: { testsPassed: 2, evidenceVerified: true },
              }),
            };
          }
          if (system.includes("adversarial twin")) {
            calls.push("adversary");
            return { content: "I found a missing verification step.", evidence: { reviewFindings: 1 } };
          }
          calls.push("primary");
          return { content: "The change is correct.", evidence: { reviewFindings: 0 } };
        },
      },
    },
  );

  const report = await worker.run({
    stepId: "step-1",
    commandId: "cmd-1",
    role: "reviewer",
    objective: "review change",
    constraints: ["direct-command-only"],
    context: {},
  });

  assert.deepEqual(calls, ["primary", "adversary", "judge"]);
  assert.equal(report.status, "completed");
  assert.equal((report.evidence as { winningSide: string }).winningSide, "adversary");
  assert.equal((report.evidence as { agreement: number }).agreement, 0.7);
});
