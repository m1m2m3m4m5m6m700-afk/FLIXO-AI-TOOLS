import type { ToolDefinition } from '@/config/canonical-tool-definition.ts';

export const FLIXO_MVP_SCOPE = Object.freeze({
  workflow: Object.freeze({
    agentGuided: true,
    manualStandalone: true,
    deterministicStandardIntents: true,
    gracefulManualFallback: true,
  }),
  processing: Object.freeze({
    executionLocation: 'BROWSER_ONLY',
    allowedEngines: Object.freeze(['HTML5_CANVAS', 'WEB_WORKER', 'WASM']),
    userFileBytesMayCrossNetwork: false,
    backendRequiredForFileExecution: false,
  }),
  hosting: Object.freeze({
    staticCdnOnly: true,
  }),
  offline: Object.freeze({
    executableAfterAssetsLoaded: true,
  }),
} as const);

export type MvpStandardIntentCase = Readonly<{
  id: string;
  request: string;
  expectedToolIds: readonly string[];
}>;

export const MVP_STANDARD_INTENT_SUITE_VERSION = 1 as const;

/**
 * Versioned deterministic acceptance corpus. Every case must resolve to the exact
 * canonical executable tool chain without a provider/network dependency.
 */
export const MVP_STANDARD_INTENT_SUITE: readonly MvpStandardIntentCase[] = Object.freeze([
  { id: 'compress-en', request: 'compress my image', expectedToolIds: ['image-compressor'] },
  { id: 'compress-ar', request: 'ضغط الصور', expectedToolIds: ['image-compressor'] },
  { id: 'convert-webp-en', request: 'convert this image to webp', expectedToolIds: ['image-converter'] },
  { id: 'convert-webp-ar', request: 'تحويل الصورة إلى webp', expectedToolIds: ['image-converter'] },
  { id: 'upscale-en', request: 'upscale this image 2x', expectedToolIds: ['image-upscaler'] },
  { id: 'upscale-ar', request: 'زيادة الدقة', expectedToolIds: ['image-upscaler'] },
  { id: 'crop-en', request: 'crop this image to square', expectedToolIds: ['image-cropper'] },
  { id: 'crop-ar', request: 'قص الصورة مربع', expectedToolIds: ['image-cropper'] },
  { id: 'effects-en', request: 'increase contrast by 10%', expectedToolIds: ['image-effects'] },
  { id: 'effects-ar', request: 'ارفع التباين 10%', expectedToolIds: ['image-effects'] },
  { id: 'brightness-ar', request: 'ارفع السطوع 10%', expectedToolIds: ['image-effects'] },
  { id: 'saturation-ar', request: 'ارفع التشبع 10%', expectedToolIds: ['image-effects'] },
  { id: 'grayscale-ar', request: 'اجعل الصورة أبيض وأسود', expectedToolIds: ['image-effects'] },
  { id: 'effects-negative-ar', request: 'خفض التباين 10%', expectedToolIds: ['image-effects'] },
  { id: 'effects-en-brightness', request: 'increase brightness by 10%', expectedToolIds: ['image-effects'] },
  { id: 'effects-en-saturation', request: 'increase saturation by 10%', expectedToolIds: ['image-effects'] },
  { id: 'effects-en-grayscale', request: 'make it black and white', expectedToolIds: ['image-effects'] },
  { id: 'effects-compound-ar', request: 'ارفع التباين 10% وارفع التشبع 20%', expectedToolIds: ['image-effects'] },
  { id: 'trim-video-en', request: 'trim video', expectedToolIds: ['video-trimmer'] },
  { id: 'crop-video-en', request: 'crop video to 720x720', expectedToolIds: ['video-cropper'] },
  { id: 'crop-video-ar', request: 'قص الفيديو إلى 720×720', expectedToolIds: ['video-cropper'] },
  { id: 'resize-video-en', request: 'resize video to 1280x720', expectedToolIds: ['video-resizer'] },
  { id: 'resize-video-ar', request: 'غيّر حجم الفيديو إلى 1280×720', expectedToolIds: ['video-resizer'] },
  { id: 'trim-video-ar', request: 'اقتطع أول 5 ثواني من الفيديو', expectedToolIds: ['video-trimmer'] },
  { id: 'compress-video-ar', request: 'ضغط الفيديو', expectedToolIds: ['video-compressor'] },
  { id: 'compound-webp', request: 'compress this image under 200KB and convert to WebP', expectedToolIds: ['image-converter', 'image-compressor'] },
  { id: 'product-square', request: 'prepare a product image for a shop, square', expectedToolIds: ['background-remover', 'image-cropper'] },
] as const);

type MVPScopedTool = Pick<
  ToolDefinition,
  'id' | 'isReady' | 'path' | 'capability' | 'executionMode' |
    'requirements' | 'operational' | 'parameterSchema' | 'verifier'
>;

export function assertMvpLocalExecutionBoundary(tool: MVPScopedTool): void {
  if (tool.capability.state !== 'EXECUTABLE') {
    throw new Error(`MVP execution denied for non-executable capability: ${tool.id}`);
  }
  if (!tool.isReady) throw new Error(`MVP executable capability is not ready: ${tool.id}`);
  if (!tool.path.startsWith('/en/')) throw new Error(`MVP manual route is missing: ${tool.id}`);
  if (tool.capability.intents.length === 0) {
    throw new Error(`MVP agent intent registration is missing: ${tool.id}`);
  }
  if (tool.executionMode !== 'LOCAL' || tool.requirements.network) {
    throw new Error(`MVP capability is not client-only: ${tool.id}`);
  }
  if (tool.operational.execution !== 'browser-local' && tool.operational.execution !== 'browser-worker') {
    throw new Error(`MVP capability has a non-browser execution adapter: ${tool.id}`);
  }
  if (!tool.operational.executorId) throw new Error(`MVP executor binding is missing: ${tool.id}`);
  if (!tool.operational.outputContractId) throw new Error(`MVP output contract binding is missing: ${tool.id}`);
  if (!tool.parameterSchema || !tool.verifier) {
    throw new Error(`MVP capability contract is incomplete: ${tool.id}`);
  }
}

export function assertMvpManualAgentCoverage(tools: readonly MVPScopedTool[]): void {
  const ready = tools.filter((tool) => tool.isReady);
  for (const tool of ready) {
    if (!tool.path.startsWith('/en/')) throw new Error(`Ready tool has no manual route: ${tool.id}`);
    if (tool.capability.intents.length === 0) throw new Error(`Ready tool has no Agent intent registration: ${tool.id}`);
    if (!tool.parameterSchema || !tool.verifier) throw new Error(`Ready tool has an incomplete programmatic interface: ${tool.id}`);
    if (!tool.operational.outputContractId) throw new Error(`Ready tool has no output contract interface: ${tool.id}`);
  }
}
export function assertMvpScope(
  tools: readonly MVPScopedTool[],
  executableIds: readonly string[],
): void {
  const executableSet = new Set(executableIds);
  const registeredExecutable = tools.filter((tool) => tool.capability.state === 'EXECUTABLE');
  const registeredIds = registeredExecutable.map((tool) => tool.id);

  if (registeredIds.length !== executableIds.length) {
    throw new Error(
      `MVP executable registry cardinality mismatch: expected ${executableIds.length}, got ${registeredIds.length}`,
    );
  }

  for (const id of executableIds) {
    const tool = tools.find((candidate) => candidate.id === id);
    if (!tool) throw new Error(`MVP executable capability is missing from registry: ${id}`);
    assertMvpLocalExecutionBoundary(tool);
  }

  const unexpected = registeredExecutable.filter((tool) => !executableSet.has(tool.id)).map((tool) => tool.id);
  if (unexpected.length) {
    throw new Error(`Unexpected executable capabilities outside MVP scope: ${unexpected.join(',')}`);
  }
}

export type FlixoAgentFileMetadata = Readonly<{
  name: string;
  type: string;
  size: number;
}>;

/**
 * MVP promotion is recorded only after canonical gates pass on the exact execution head.
 * Only non-content file metadata may be sent to an optional agent gateway.
 * Raw File/Blob bytes are never part of the agent request contract.
 */
export function toAgentFileMetadata(file: File | null | undefined): FlixoAgentFileMetadata | null {
  if (!file) return null;
  return Object.freeze({ name: file.name, type: file.type, size: file.size });
}
