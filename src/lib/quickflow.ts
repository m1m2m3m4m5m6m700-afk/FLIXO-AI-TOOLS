import type { ToolConfig } from '../config/tools';
import { getBestToolIntent } from './intent-router.ts';
import { extractParameters, type ExtractedOperation } from './agent/intent/parameter-extractor.ts';
import { getCapability, validateCapabilityParameters } from './agent/capability-registry.ts';

export type QuickFlowStep = Readonly<{ toolId: string; path: string; params?: Record<string, string | number | boolean> }>;
export type QuickFlowPlan = Readonly<{ version: 2; intent: string; steps: readonly QuickFlowStep[] }>;
const MAX_STEPS = 4;
const PRODUCT_PREP = /(?:product\s+(?:image|photo)|e-?commerce|catalog|marketplace|store|shop|product\s+listing|صورة\s+المنتج|المنتج\s+للمتجر|للمتجر|كتالوج|متجر)/i;
const STEP_ORDER = ['background-remover', 'image-upscaler', 'image-cropper', 'image-effects', 'image-converter', 'image-compressor'];

function pathFor(toolId: string, tools: readonly ToolConfig[]): string | undefined { return tools.find((tool) => tool.id === toolId)?.path; }
function productPreparationOperations(): ExtractedOperation[] { return [{ capability: 'background-remover', params: {} }, { capability: 'image-cropper', params: { aspectRatio: '1:1' } }]; }
function orderedOperations(operations: readonly ExtractedOperation[]): ExtractedOperation[] {
  return [...operations].sort((a, b) => {
    const ai = STEP_ORDER.indexOf(a.capability); const bi = STEP_ORDER.indexOf(b.capability);
    return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
  });
}
function semanticGate(operations: readonly ExtractedOperation[]): ExtractedOperation[] | null {
  if (operations.length === 0 || operations.length > MAX_STEPS) return null;
  try {
    const validated = operations.map((operation) => {
      const capability = getCapability(operation.capability);
      if (!capability || capability.state !== 'EXECUTABLE') throw new Error(`Capability '${operation.capability}' is not executable.`);
      return { capability: operation.capability, params: validateCapabilityParameters(operation.capability, operation.params) };
    });
    const ids = new Set(validated.map((operation) => operation.capability));
    return ids.size === validated.length ? validated : null;
  } catch { return null; }
}

export const buildQuickFlowPlan = (intent: string, tools: readonly ToolConfig[]): QuickFlowPlan | null => {
  const normalizedIntent = intent.trim();
  if (!normalizedIntent) return null;
  const extracted = extractParameters(normalizedIntent);
  const isProductPreparation = PRODUCT_PREP.test(normalizedIntent);
  const hasBlockingExtractionError = !extracted.success && extracted.errors.some((error) => /required|invalid|exceeds/i.test(error));
  if (hasBlockingExtractionError) return null;
  const extractedOperations: readonly ExtractedOperation[] = extracted.success && extracted.payload ? extracted.payload.operations : [];
  const operations = [...(isProductPreparation ? productPreparationOperations() : []), ...extractedOperations];

  if (operations.length > 0) {
    const unique = new Map<string, ExtractedOperation>();
    for (const operation of operations) unique.set(operation.capability, operation);
    const gated = semanticGate(orderedOperations([...unique.values()]));
    if (!gated) return null;
    const steps = gated.map((operation) => {
      const path = pathFor(operation.capability, tools);
      if (!path || !tools.some((tool) => tool.id === operation.capability && tool.isReady)) return null;
      return { toolId: operation.capability, path, params: operation.params };
    });
    if (steps.some((step) => step === null)) return null;
    return { version: 2, intent: normalizedIntent, steps: steps as QuickFlowStep[] };
  }

  const match = getBestToolIntent(normalizedIntent, tools);
  if (!match || match.score < 60 || !match.tool.isReady) return null;
  return { version: 2, intent: normalizedIntent, steps: [{ toolId: match.tool.id, path: match.tool.path }] };
};
