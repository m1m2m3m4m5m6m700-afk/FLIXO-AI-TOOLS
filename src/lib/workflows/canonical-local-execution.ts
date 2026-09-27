import {
  assertExecutionResourceBudget,
  getCapability,
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

async function decodedDimensions(blob:Blob):Promise<{width:number;height:number}|undefined>{
  if(blob.type.startsWith("image/")&&typeof createImageBitmap==="function"){
    const bitmap=await createImageBitmap(blob);
    try{return {width:bitmap.width,height:bitmap.height};}finally{bitmap.close();}
  }
  if(blob.type.startsWith("video/")&&typeof document!=="undefined"){
    const url=URL.createObjectURL(blob); const video=document.createElement("video"); video.preload="metadata"; video.src=url;
    try{await new Promise<void>((resolve,reject)=>{video.onloadedmetadata=()=>resolve();video.onerror=()=>reject(new Error("CANONICAL_VIDEO_METADATA_INVALID"));});return {width:video.videoWidth,height:video.videoHeight};}
    finally{URL.revokeObjectURL(url);video.removeAttribute("src");video.load();}
  }
  return undefined;
}
async function assertDecodedInputWithinBudget(toolId:string,blob:Blob,maxPixels:number):Promise<void>{
  const dimensions=await decodedDimensions(blob);
  if(dimensions&& (dimensions.width<1||dimensions.height<1||dimensions.width*dimensions.height>maxPixels)) throw new Error("CANONICAL_INPUT_PIXEL_LIMIT_EXCEEDED:"+toolId);
}
function timeoutError(toolId:string):Error{const error=new Error("CANONICAL_TOOL_TIMEOUT:"+toolId);error.name="TimeoutError";return error;}
async function runWithTimeout<T>(toolId:string,timeoutMs:number,operation:(signal:AbortSignal)=>Promise<T>,externalSignal?:AbortSignal):Promise<T>{
  const controller=new AbortController(); const onExternalAbort=()=>controller.abort(); externalSignal?.addEventListener("abort",onExternalAbort,{once:true});
  let timer:ReturnType<typeof setTimeout>|undefined;
  const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(timeoutError(toolId));},timeoutMs);});
  try{if(externalSignal?.aborted)throw new DOMException("Execution aborted.","AbortError");return await Promise.race([operation(controller.signal),timeout]);}
  finally{if(timer)clearTimeout(timer);externalSignal?.removeEventListener("abort",onExternalAbort);}
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
  signal?: AbortSignal,
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

  if (!(inputBlob instanceof Blob) || inputBlob.size <= 0) throw new Error(`CANONICAL_INPUT_INVALID:${binding.toolId}`);
  if (inputBlob.size > capability.safetyLimits.maxFileSizeBytes) throw new Error(`CANONICAL_INPUT_FILE_LIMIT_EXCEEDED:${binding.toolId}`);
  if (signal?.aborted) throw new DOMException("Execution aborted.","AbortError");

  const parameters = validateCapabilityParameters(binding.toolId, rawParameters);
  assertExecutionResourceBudget(binding.toolId, inputBlob);
  await runWithTimeout(
    binding.toolId,
    capability.safetyLimits.timeoutMs,
    async () => assertDecodedInputWithinBudget(binding.toolId, inputBlob, capability.safetyLimits.maxPixels),
    signal,
  );

  const outputBlob = await runWithTimeout(binding.toolId, capability.safetyLimits.timeoutMs,
    (executionSignal)=>getToolExecutor(capability)({ tool: capability, inputBlob, parameters, signal: executionSignal }), signal);

  if (!(outputBlob instanceof Blob) || outputBlob.size <= 0) {
    throw new Error(`CANONICAL_TOOL_EMPTY_OUTPUT:${binding.toolId}`);
  }

  const verifiedByCanonicalVerifier = await runWithTimeout(binding.toolId, capability.safetyLimits.timeoutMs,
    (verificationSignal)=>capability.verifier(inputBlob, outputBlob, parameters, verificationSignal), signal);
  if (!verifiedByCanonicalVerifier) {
    throw new Error(`CANONICAL_TOOL_VERIFICATION_FAILED:${binding.toolId}`);
  }

  const contractId = capability.operational.outputContractId;
  if (!contractId) {
    throw new Error(`CANONICAL_OUTPUT_CONTRACT_NOT_BOUND:${binding.toolId}`);
  }

  const contract = getToolOutputContract(contractId);
  if (!contract || contract.toolId !== binding.toolId) {
    throw new Error(`CANONICAL_OUTPUT_CONTRACT_NOT_FOUND:${binding.toolId}`);
  }

  const maxContractBytes = Math.max(
    ...contract.variants.map((variant) => variant.maxOutputBytes ?? Number.POSITIVE_INFINITY),
  );
  if (Number.isFinite(maxContractBytes) && outputBlob.size > maxContractBytes) {
    throw new Error("CANONICAL_OUTPUT_SIZE_LIMIT_EXCEEDED:"+binding.toolId);
  }

  const dimensions = await runWithTimeout(
    binding.toolId,
    capability.safetyLimits.timeoutMs,
    async () => dimensionsFor(outputBlob),
    signal,
  );
  const outputBytes = await runWithTimeout(
    binding.toolId,
    capability.safetyLimits.timeoutMs,
    async () => new Uint8Array(await outputBlob.arrayBuffer()),
    signal,
  );
  const result: ToolOutputResult = {
    mimeType: outputBlob.type,
    byteLength: outputBlob.size,
    bytes: outputBytes,
    filename: "flixo-"+binding.toolId+"."+extensionForMime(outputBlob.type),
    dimensions,
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
