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
                evidence: { testsPassed: 2, evidenceVerified: true, verifiedFindings: 1, falsePositiveFindings: 0, resolvedDisputes: 1, unresolvedDisputes: 0 },
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
  assert.ok(((report.evidence as { adversarialReward: { score: number } }).adversarialReward).score > 0);
});


test("later adversarial rounds receive adjudication feedback without raw opponent output", async () => {
  const positionMessages: string[] = [];
  const worker = new AdversarialTwinWorker(
    { id: "reviewer", role: "reviewer" },
    {
      maxRounds: 2,
      invoker: {
        async invoke(request) {
          const system = request.messages[0]?.content ?? "";
          const user = request.messages[1]?.content ?? "";
          if (system.includes("neutral adjudicator")) {
            const round = request.turn;
            return {
              content: JSON.stringify({
                status: "completed",
                summary: round === 1 ? "recheck the artifact boundary" : "boundary resolved",
                agreement: round === 1 ? 0.2 : 0.9,
                winningSide: "undetermined",
                disputes: round === 1 ? ["artifact-boundary"] : [],
                evidence: {
                  verifiedFindings: round === 1 ? 0 : 1,
                  falsePositiveFindings: 0,
                  resolvedDisputes: round === 1 ? 0 : 1,
                  unresolvedDisputes: round === 1 ? 1 : 0,
                },
              }),
            };
          }
          positionMessages.push(user);
          return system.includes("adversarial twin")
            ? { content: "ADVERSARY_RAW_POSITION", evidence: {} }
            : { content: "PRIMARY_RAW_POSITION", evidence: {} };
        },
      },
    },
  );

  await worker.run({
    stepId: "step-rounds",
    commandId: "cmd-rounds",
    role: "reviewer",
    objective: "review artifact boundary",
    constraints: [],
    context: {},
  });

  const secondRoundPrimary = positionMessages[2] ?? "";
  const secondRoundAdversary = positionMessages[3] ?? "";
  assert.match(secondRoundPrimary, /recheck the artifact boundary/);
  assert.match(secondRoundAdversary, /artifact-boundary/);
  assert.doesNotMatch(secondRoundPrimary, /ADVERSARY_RAW_POSITION/);
  assert.doesNotMatch(secondRoundAdversary, /PRIMARY_RAW_POSITION/);
});
