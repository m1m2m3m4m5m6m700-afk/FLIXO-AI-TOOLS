import { getCapability } from "../agent/capability-registry";
import {
  assertExecutionResourceBudget,
  validateCapabilityParameters,
} from "../agent/capability-registry";
import {
  assertToolOutputContract,
  type ToolOutputResult,
} from "../contracts/tool-output";
import { getToolOutputContract } from "../contracts/tool-output-contracts";
import { getToolExecutor } from "./executor-registry";

export type CanonicalLocalExecutionBinding = Readonly<{
  toolId: string;
  executorId: string;
  maxPixels: number;
  maxFileSizeBytes: number;
  outputContractId: string;
}>;

function extensionForMime(mimeType: string): string {
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/svg+xml") return "svg";
  return "bin";
}

async function dimensionsFor(
  blob: Blob,
): Promise<{ width: number; height: number } | undefined> {
  if (!blob.type.startsWith("image/") || typeof createImageBitmap !== "function") {
    return undefined;
  }

  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

export async function executeCanonicalLocalTool(
  binding: CanonicalLocalExecutionBinding,
  inputBlob: Blob,
  rawParameters: unknown,
): Promise<{ toolId: string; blob: Blob }> {
  const capability = getCapability(binding.toolId);

  if (!capability) {
    throw new Error(`CANONICAL_TOOL_NOT_FOUND:${binding.toolId}`);
  }

  if (capability.state !== "EXECUTABLE") {
    throw new Error(`CANONICAL_TOOL_NOT_EXECUTABLE:${binding.toolId}`);
  }

  if (capability.executionMode !== "LOCAL" || capability.requirements.network) {
    throw new Error(`CANONICAL_TOOL_NOT_LOCAL:${binding.toolId}`);
  }

  if (binding.executorId !== capability.operational.executorId) {
    throw new Error(`CANONICAL_EXECUTOR_ID_MISMATCH:${binding.toolId}`);
  }

  if (binding.maxPixels !== capability.safetyLimits.maxPixels) {
    throw new Error(`CANONICAL_PIXEL_LIMIT_MISMATCH:${binding.toolId}`);
  }

  if (binding.maxFileSizeBytes !== capability.safetyLimits.maxFileSizeBytes) {
    throw new Error(`CANONICAL_FILE_LIMIT_MISMATCH:${binding.toolId}`);
  }

  if (binding.outputContractId !== capability.operational.outputContractId) {
    throw new Error(`CANONICAL_OUTPUT_CONTRACT_ID_MISMATCH:${binding.toolId}`);
  }

  if (!(inputBlob instanceof Blob) || inputBlob.size <= 0) {
    throw new Error(`CANONICAL_INPUT_INVALID:${binding.toolId}`);
  }

  const parameters = validateCapabilityParameters(binding.toolId, rawParameters);
  assertExecutionResourceBudget(binding.toolId, inputBlob);

  const outputBlob = await getToolExecutor(tool)({
    tool,
    inputBlob,
    parameters,
  });

  if (!(outputBlob instanceof Blob) || outputBlob.size <= 0) {
    throw new Error(`CANONICAL_TOOL_EMPTY_OUTPUT:${binding.toolId}`);
  }

  const verifiedByCanonicalVerifier = await tool.verifier(
    inputBlob,
    outputBlob,
    parameters,
  );
  if (!verifiedByCanonicalVerifier) {
    throw new Error(`CANONICAL_TOOL_VERIFICATION_FAILED:${binding.toolId}`);
  }

  const contractId = tool.operational.outputContractId;
  if (!contractId) {
    throw new Error(`CANONICAL_OUTPUT_CONTRACT_NOT_BOUND:${binding.toolId}`);
  }

  const contract = getToolOutputContract(contractId);
  if (!contract || contract.toolId !== binding.toolId) {
    throw new Error(`CANONICAL_OUTPUT_CONTRACT_NOT_FOUND:${binding.toolId}`);
  }

  const result: ToolOutputResult = {
    mimeType: outputBlob.type,
    byteLength: outputBlob.size,
    bytes: new Uint8Array(await outputBlob.arrayBuffer()),
    filename: `flixo-${binding.toolId}.${extensionForMime(outputBlob.type)}`,
    dimensions: await dimensionsFor(outputBlob),
  };

  assertToolOutputContract(contract, result);

  if (
    binding.toolId === "image-compressor" &&
    typeof parameters.targetSizeKB === "number" &&
    outputBlob.size > parameters.targetSizeKB * 1024
  ) {
    throw new Error("CANONICAL_TARGET_SIZE_NOT_MET:image-compressor");
  }

  return { toolId: binding.toolId, blob: outputBlob };
}
