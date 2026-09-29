import { describe, expect, it, vi } from "vitest";
import { prepareAgentLocalExecution } from "../lib/agent/confirmation-gate";
import { executeAgentToolLocally, pickTargetLayer } from "../lib/tools/local-executor";
import { AgentResponseSchema, type ToolCallRequest } from "../lib/schemas/agent";
import { ProjectStateSchema, type ProjectState } from "../lib/schemas/project";
import { CANONICAL_AGENT_TOOLS } from "../lib/tools/canonical";

const ISO = "2026-09-29T00:00:00.000Z";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const LOCKED_ID = "22222222-2222-4222-8222-222222222222";
const OPEN_ID = "33333333-3333-4333-8333-333333333333";

function buildState(layers: ProjectState["layers"]): ProjectState {
  return ProjectStateSchema.parse({
    id: PROJECT_ID,
    title: "Security Test",
    dimensions: { width: 1920, height: 1080, fps: 30 },
    durationSec: 10,
    layers,
    timeline: [],
    createdAt: ISO,
    updatedAt: ISO,
    version: 1,
  });
}

function imageLayer(id: string, locked: boolean) {
  return {
    id,
    name: locked ? "Locked" : "Open",
    type: "image" as const,
    url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
    visible: true,
    locked,
    opacity: 1,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, zIndex: 0 },
    metadata: {},
  };
}

function buildResponse(requiresUserConfirmation: boolean) {
  const call: ToolCallRequest = {
    callId: "call-1",
    toolName: "image-effects",
    parameters: { contrast: 10 },
  };
  const tool = CANONICAL_AGENT_TOOLS.find((candidate) => candidate.id === call.toolName)!;
  return AgentResponseSchema.parse({
    messageId: "44444444-4444-4444-8444-444444444444",
    content: "Prepared an image edit.",
    requestedToolCalls: [call],
    localExecutionPlans: [{
      callId: call.callId,
      toolName: call.toolName,
      executorId: tool.executorId,
      maxPixels: tool.maxPixels,
      maxFileSizeBytes: tool.maxFileSizeBytes,
      outputContractId: tool.outputContractId,
    }],
    toolResults: [],
    requiresUserConfirmation,
  });
}

describe("Agent execution security", () => {
  it("rejects a planned local mutation whose response omits confirmation", () => {
    expect(() => buildResponse(false))
      .toThrow("Local execution plans require explicit user confirmation.");
  });

  it("fails closed at the execution-preparation boundary if confirmation is tampered", () => {
    const response = buildResponse(true);
    const tampered = { ...response, requiresUserConfirmation: false } as never;
    expect(() => prepareAgentLocalExecution(tampered))
      .toThrow("AGENT_EXECUTION_CONFIRMATION_REQUIRED");
  });

  it("queues local execution only when explicit confirmation is required", () => {
    const pending = prepareAgentLocalExecution(buildResponse(true));
    expect(pending?.requestedToolCalls).toHaveLength(1);
    expect(pending?.localExecutionPlans).toHaveLength(1);
    expect(pending?.preview).toEqual([{
      callId: "call-1",
      toolName: "image-effects",
      parameters: { contrast: 10 },
    }]);
  });

  it("never selects a locked media layer", () => {
    const state = buildState([imageLayer(LOCKED_ID, true)]);
    expect(pickTargetLayer(state, "image-effects")).toBeUndefined();
  });

  it("skips a locked first layer and selects the next editable layer", () => {
    const state = buildState([
      imageLayer(LOCKED_ID, true),
      imageLayer(OPEN_ID, false),
    ]);
    expect(pickTargetLayer(state, "image-effects")?.id).toBe(OPEN_ID);
  });

  it("rejects executor calls without the confirmation decision before reading media", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(
      executeAgentToolLocally({} as ProjectState, {} as ToolCallRequest, {} as never, "CANCEL" as never),
    ).rejects.toThrow("AGENT_EXECUTION_CONFIRMATION_REQUIRED");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("fails closed when every eligible media layer is locked", async () => {
    const state = buildState([imageLayer(LOCKED_ID, true)]);
    const call = buildResponse(true).requestedToolCalls[0]!;
    const plan = buildResponse(true).localExecutionPlans[0]!;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(
      executeAgentToolLocally(state, call, plan, "CONFIRM"),
    ).rejects.toThrow("AGENT_TARGET_LAYER_NOT_FOUND:image-effects");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
