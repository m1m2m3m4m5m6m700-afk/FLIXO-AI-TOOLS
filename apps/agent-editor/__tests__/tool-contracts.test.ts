import { describe, expect, it } from "vitest";
import { CANONICAL_AGENT_TOOLS, validateCanonicalAgentParameters } from "../lib/tools/canonical";

describe("canonical tool contracts", () => {
  it("contains exactly the canonical executable MVP set", () => {
    expect(CANONICAL_AGENT_TOOLS).toHaveLength(10);
    for (const tool of CANONICAL_AGENT_TOOLS) {
      expect(tool.executorId).toBe(tool.id);
      expect(tool.outputContractId).toBe(tool.id);
      expect(tool.executionMode).toBe("LOCAL");
    }
  });

  it("validates image and video parameters against the canonical schema", () => {
    expect(validateCanonicalAgentParameters("image-effects", {
      brightness: 105, contrast: 120, saturate: 95, grayscale: 0,
    })).toEqual({ brightness: 105, contrast: 120, saturate: 95, grayscale: 0 });

    expect(validateCanonicalAgentParameters("video-trimmer", {
      startSec: 2, endSec: 7,
    })).toEqual({ startSec: 2, endSec: 7 });
  });
});
