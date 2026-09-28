import {
  CAPABILITY_DEFINITIONS,
  getCanonicalCapabilityDefinition,
  MVP_EXECUTABLE_TOOL_IDS,
  type CanonicalCapabilityLimits,
  type CanonicalCapabilityParameters,
  type CanonicalCapabilityState,
  type CanonicalCapabilityVerifier,
  type CanonicalExecutionMode,
} from "./canonical-capability-definition";
import { z, type ZodType } from "zod";

export type CapabilityState = CanonicalCapabilityState;
export type ExecutionMode = CanonicalExecutionMode;
export type CapabilityParameters = CanonicalCapabilityParameters;
export type CapabilityVerifier = CanonicalCapabilityVerifier;
export type CapabilityLimits = CanonicalCapabilityLimits;

export type CapabilityContract = Readonly<{
  id: string;
  title: string;
  description: string;
  category: "Images" | "Video" | "AI" | "Editor";
  family: "image" | "video" | "ai" | "editor";
  state: CapabilityState;
  executionMode: ExecutionMode;
  execution: "browser-local" | "browser-worker" | "remote";
  intents: readonly string[];
  parameterSchema: ZodType;
  safetyLimits: CapabilityLimits;
  verifier: CapabilityVerifier;
  requirements: Readonly<{ browser: true; network: boolean }>;
  recovery: Readonly<{ maxAttempts: number; replanOnFailure: boolean }>;
  operational: Readonly<{
    lifecycle: "ready" | "experimental";
    execution: "browser-local" | "browser-worker" | "remote";
    contracts: readonly ("structural" | "runtime" | "artifact")[];
    executorId: string | null;
    outputContractId: string | null;
  }>;
}>;

const GENERIC_PARAMETERS: ZodType = z.record(
  z.string().max(64),
  z.union([z.string(), z.number().finite(), z.boolean()]),
);
const READ_ONLY_VERIFIER: CapabilityVerifier = async (
  _input,
  output,
  _parameters,
  signal,
) => !signal?.aborted && output.size > 0;
const DEFAULT_LIMITS: CapabilityLimits = Object.freeze({
  maxPixels: 16_000_000,
  maxFileSizeBytes: 64 * 1024 * 1024,
  timeoutMs: 30_000,
});
const CLOUD_LIMITS: CapabilityLimits = Object.freeze({
  maxPixels: 0,
  maxFileSizeBytes: 1,
  timeoutMs: 30_000,
});

type ReadOnlyCapabilitySeed = Readonly<{
  id: string;
  title: string;
  category: "Images" | "Video" | "AI" | "Editor";
  family: "image" | "video" | "ai" | "editor";
  state: CapabilityState;
  executionMode: ExecutionMode;
  execution: "browser-local" | "browser-worker" | "remote";
}>;

const READ_ONLY_CAPABILITIES: readonly ReadOnlyCapabilitySeed[] = Object.freeze([
  ["filter-mask", "Filter Mask", "Images", "image", "PLANNABLE", "LOCAL", "browser-local"],
  ["object-remover", "Object Remover", "Images", "image", "PLANNABLE", "LOCAL", "browser-local"],
  ["watermark-remover", "Watermark Remover", "Images", "image", "PLANNABLE", "LOCAL", "browser-local"],
  ["image-to-svg", "Image to SVG", "Images", "image", "PLANNABLE", "LOCAL", "browser-local"],
  ["image-ocr", "Image OCR", "Images", "image", "PLANNABLE", "LOCAL", "browser-local"],
  ["background-blur", "Background Blur", "Images", "image", "PLANNABLE", "LOCAL", "browser-local"],
  ["passport-photo-maker", "Passport Photo Maker", "Images", "image", "PLANNABLE", "LOCAL", "browser-local"],
  ["watermark-adder", "Watermark Adder", "Images", "image", "PLANNABLE", "LOCAL", "browser-local"],
  ["meme-generator", "Meme Generator", "Images", "image", "PLANNABLE", "LOCAL", "browser-local"],
  ["collage-maker", "Collage Maker", "Images", "image", "PLANNABLE", "LOCAL", "browser-local"],
  ["exif-cleaner", "EXIF Cleaner", "Images", "image", "PLANNABLE", "LOCAL", "browser-local"],
  ["svg-optimizer", "SVG Optimizer", "Images", "image", "PLANNABLE", "LOCAL", "browser-local"],
  ["mockup-generator", "Mockup Generator", "Images", "image", "PLANNABLE", "LOCAL", "browser-local"],
  ["seed", "Seed", "Images", "image", "PLANNABLE", "LOCAL", "browser-local"],
  ["pix", "Pix Studio", "Images", "image", "PLANNABLE", "LOCAL", "browser-local"],
  ["ai-image-generator", "AI Image Generator", "AI", "ai", "PLANNABLE", "CLOUD", "remote"],
  ["photo-colorizer", "Photo Colorizer", "AI", "ai", "UNAVAILABLE", "CLOUD", "remote"],
].map(([id,title,category,family,state,executionMode,execution])=>({
  id,title,category:category as ReadOnlyCapabilitySeed["category"],family:family as ReadOnlyCapabilitySeed["family"],
  state:state as CapabilityState,executionMode:executionMode as ExecutionMode,
  execution:execution as ReadOnlyCapabilitySeed["execution"],
})));

function toReadOnlyCapability(seed: ReadOnlyCapabilitySeed): CapabilityContract {
  const cloud = seed.executionMode === "CLOUD";
  return Object.freeze({
    ...seed,
    description: `Capability contract for ${seed.title}.`,
    intents: Object.freeze([]),
    parameterSchema: GENERIC_PARAMETERS,
    safetyLimits: cloud ? CLOUD_LIMITS : DEFAULT_LIMITS,
    verifier: READ_ONLY_VERIFIER,
    requirements: Object.freeze({ browser: true as const, network: cloud }),
    recovery: Object.freeze({ maxAttempts: 0, replanOnFailure: false }),
    operational: Object.freeze({
      lifecycle: seed.state === "UNAVAILABLE" ? "experimental" as const : "ready" as const,
      execution: seed.execution,
      contracts: ["structural", "runtime", "artifact"] as const,
      executorId: null,
      outputContractId: null,
    }),
  });
}

const READ_ONLY_CONTRACTS: readonly CapabilityContract[] = Object.freeze(
  READ_ONLY_CAPABILITIES.map(toReadOnlyCapability),
);

export const CAPABILITY_REGISTRY: readonly CapabilityContract[] = Object.freeze(
  [...CAPABILITY_DEFINITIONS, ...READ_ONLY_CONTRACTS],
);

const byId = new Map(
  CAPABILITY_REGISTRY.map((capability) => [capability.id, capability]),
);

export function getCapability(id: string): CapabilityContract | undefined {
  return byId.get(id);
}

export function getCapabilitiesByState(
  state: CapabilityState,
): readonly CapabilityContract[] {
  return CAPABILITY_REGISTRY.filter((capability) => capability.state === state);
}

export function getExecutableCapabilityIds(): readonly string[] {
  return [...MVP_EXECUTABLE_TOOL_IDS];
}

export function validateCapabilityParameters(
  id: string,
  parameters: unknown = {},
): CapabilityParameters {
  const capability = getCapability(id);
  if (!capability) throw new Error(`Unknown capability: ${id}`);
  if (capability.state !== "EXECUTABLE") {
    throw new Error(`Capability '${id}' is not executable.`);
  }

  const parsed = capability.parameterSchema.safeParse(parameters);
  if (!parsed.success) {
    throw new Error(
      `Capability '${id}' parameters failed canonical schema validation.`,
    );
  }

  if (
    parameters !== null &&
    typeof parameters === "object" &&
    !Array.isArray(parameters) &&
    parsed.data !== null &&
    typeof parsed.data === "object" &&
    !Array.isArray(parsed.data)
  ) {
    const accepted = new Set(
      Object.keys(parsed.data as Record<string, unknown>),
    );
    const unknown = Object.keys(
      parameters as Record<string, unknown>,
    ).filter((key) => !accepted.has(key));
    if (unknown.length) {
      throw new Error(`Capability '${id}' received unsupported parameters.`);
    }
  }

  return parsed.data as CapabilityParameters;
}

export function assertExecutionResourceBudget(
  id: string,
  inputBlob: Blob,
  requestedPixels?: number,
): void {
  const capability = getCapability(id);
  if (!capability) throw new Error(`Unknown capability: ${id}`);
  if (capability.state !== "EXECUTABLE") {
    throw new Error(`Capability '${id}' is not executable.`);
  }
  if (inputBlob.size > capability.safetyLimits.maxFileSizeBytes) {
    throw new Error(`Capability '${id}' input exceeds the safe file-size limit.`);
  }
  if (
    requestedPixels !== undefined &&
    requestedPixels > capability.safetyLimits.maxPixels
  ) {
    throw new Error(`Capability '${id}' request exceeds the safe pixel limit.`);
  }
}

export { CAPABILITY_DEFINITIONS, getCanonicalCapabilityDefinition };
