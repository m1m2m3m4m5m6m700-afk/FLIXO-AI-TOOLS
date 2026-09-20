import { z } from 'zod';
import { getCapability } from '@/lib/agent/capability-registry';
import { buildQuickFlowPlan, type QuickFlowPlan } from '@/lib/quickflow';
import { resolveIntent, type IntentMatch } from '@/lib/intent/resolver';
import { extractParameters, type ExtractedOperation, type ExtractionResult } from '@/lib/agent/intent/parameter-extractor';
import { TOOLS_REGISTRY } from '@/config/tools';

export const INTENT_PLAN_VERSION = 1 as const;
export const INTENT_PLAN_MAX_STEPS = 4;

export const MissingRequirementSchema = z.object({
  id: z.string().trim().min(1),
  capability: z.string().trim().min(1),
  kind: z.enum(['format', 'crop-geometry', 'operation', 'clarification']),
  question: z.string().trim().min(1),
  examples: z.array(z.string().trim().min(1)).max(6),
}).strict();

export type MissingRequirement = z.infer<typeof MissingRequirementSchema>;

export const IntentPlanStatusSchema = z.enum(['READY', 'NEEDS_INPUT', 'UNSUPPORTED', 'UNSAFE']);
export type IntentPlanStatus = z.infer<typeof IntentPlanStatusSchema>;

export type IntentExecutionStep = Readonly<{
  toolId: string;
  params?: Record<string, string | number | boolean | undefined>;
}>;

export const IntentPlanSchema = z.object({
  version: z.literal(INTENT_PLAN_VERSION),
  status: IntentPlanStatusSchema,
  input: z.string().trim().min(1).max(4000),
  intent: z.object({
    kind: z.enum(['tool', 'workflow', 'none']),
    id: z.string().nullable(),
    confidence: z.number().finite().min(0).max(1),
    matchedTerms: z.array(z.string()),
  }).strict(),
  operations: z.array(z.object({
    capability: z.string().trim().min(1),
    params: z.record(z.union([z.string(), z.number().finite(), z.boolean()])),
  }).strict()).max(INTENT_PLAN_MAX_STEPS),
  steps: z.array(z.object({
    toolId: z.string().trim().min(1),
    params: z.record(z.union([z.string(), z.number().finite(), z.boolean()])).optional(),
  }).strict()).max(INTENT_PLAN_MAX_STEPS),
  missing: z.array(MissingRequirementSchema).max(6),
  confirmationRequired: z.boolean(),
  strategy: z.enum(['quickflow', 'registry-fallback', 'none']),
  explanation: z.string().trim().min(1),
  taskId: z.string().nullable(),
  traceId: z.string().nullable(),
}).strict();

export type IntentPlan = z.infer<typeof IntentPlanSchema>;

const hasArabic = (value: string): boolean => /[\u0600-\u06FF]/u.test(value);

function inputFormatMissing(input: string, extraction: ExtractionResult): boolean {
  if (!/(?:convert|conversion|تحويل|حول|حوّل|غير\s+الصيغة)/i.test(input)) return false;
  return !extraction.payload?.operations.some(
    (operation) => operation.capability === 'image-converter' && typeof operation.params.format === 'string',
  );
}

function cropGeometryMissing(input: string, extraction: ExtractionResult): boolean {
  if (!/(?:crop|قص|اقتطع|قص\s+الصورة|قص\s+الصور)/i.test(input)) return false;
  return !extraction.payload?.operations.some((operation) => {
    if (operation.capability !== 'image-cropper') return false;
    return typeof operation.params.aspectRatio === 'string'
      || (typeof operation.params.width === 'number' && typeof operation.params.height === 'number');
  });
}

function buildMissingRequirements(
  input: string,
  extraction: ExtractionResult,
  intent: IntentMatch,
): MissingRequirement[] {
  const arabic = hasArabic(input);
  const missing: MissingRequirement[] = [];

  if (inputFormatMissing(input, extraction)) {
    missing.push({
      id: 'output-format',
      capability: 'image-converter',
      kind: 'format',
      question: arabic
        ? 'ما صيغة الإخراج المطلوبة؟ مثل WebP أو PNG أو JPG.'
        : 'What output format do you want? For example WebP, PNG, or JPG.',
      examples: ['WebP', 'PNG', 'JPG'],
    });
  }

  if (cropGeometryMissing(input, extraction)) {
    missing.push({
      id: 'crop-geometry',
      capability: 'image-cropper',
      kind: 'crop-geometry',
      question: arabic
        ? 'ما النسبة أو الأبعاد المطلوبة للقص؟ مثل 1:1 أو 1200×800.'
        : 'What crop ratio or dimensions do you want? For example 1:1 or 1200×800.',
      examples: ['1:1', '1200×800', '1920×1080'],
    });
  }

  if (
    missing.length === 0
    && intent.kind === 'none'
    && extraction.payload?.operations.length === 0
    && extraction.errors.length === 0
  ) {
    missing.push({
      id: 'operation',
      capability: 'intent',
      kind: 'operation',
      question: arabic
        ? 'ما العملية التي تريد تنفيذها على الصورة؟'
        : 'What operation do you want to perform on the image?',
      examples: arabic ? ['ضغط', 'إزالة الخلفية', 'تحويل إلى WebP'] : ['compress', 'remove background', 'convert to WebP'],
    });
  }

  return missing;
}

function candidateFromQuickFlow(quickFlow: QuickFlowPlan, intent: IntentMatch) {
  return {
    workflowName: quickFlow.steps.length > 1 ? 'FLIXO QuickFlow' : 'FLIXO Direct Tool',
    confidence: quickFlow.steps.length > 1 ? 0.95 : Math.max(intent.confidence, 0.8),
    steps: quickFlow.steps.map((step) => ({ toolId: step.toolId, params: step.params })),
  };
}

function validateExecutionCandidate(candidate: {
  workflowName: string;
  confidence: number;
  steps: readonly IntentExecutionStep[];
}): { ok: true } | { ok: false; reason: string } {
  if (!candidate.workflowName.trim()) return { ok: false, reason: 'PLAN_WORKFLOW_NAME_REQUIRED' };
  if (candidate.steps.length === 0 || candidate.steps.length > INTENT_PLAN_MAX_STEPS) {
    return { ok: false, reason: 'PLAN_STEP_COUNT_INVALID' };
  }

  const ids = new Set<string>();
  for (const step of candidate.steps) {
    if (ids.has(step.toolId)) return { ok: false, reason: 'PLAN_DUPLICATE_CAPABILITY:' + step.toolId };
    ids.add(step.toolId);

    const capability = getCapability(step.toolId);
    if (!capability || capability.state !== 'EXECUTABLE') {
      return { ok: false, reason: 'PLAN_CAPABILITY_NOT_EXECUTABLE:' + step.toolId };
    }

    try {
      capability.parameterSchema.parse(step.params ?? {});
    } catch {
      return { ok: false, reason: 'PLAN_PARAMETERS_INVALID:' + step.toolId };
    }
  }

  if (!Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) {
    return { ok: false, reason: 'PLAN_CONFIDENCE_INVALID' };
  }

  return { ok: true };
}

function buildBasePlan(
  input: string,
  status: IntentPlanStatus,
  intent: IntentMatch,
  operations: readonly ExtractedOperation[],
  missing: readonly MissingRequirement[],
  steps: readonly IntentExecutionStep[],
  strategy: IntentPlan['strategy'],
  explanation: string,
  identity?: { taskId?: string | null; traceId?: string | null },
): IntentPlan {
  return IntentPlanSchema.parse({
    version: INTENT_PLAN_VERSION,
    status,
    input,
    intent: {
      kind: intent.kind,
      id: intent.id,
      confidence: intent.confidence,
      matchedTerms: [...intent.matchedTerms],
    },
    operations: operations.map((operation) => ({
      capability: operation.capability,
      params: { ...operation.params },
    })),
    steps: steps.map((step) => ({
      toolId: step.toolId,
      params: step.params ? { ...step.params } : undefined,
    })),
    missing: [...missing],
    confirmationRequired: status === 'READY',
    strategy,
    explanation,
    taskId: identity?.taskId ?? null,
    traceId: identity?.traceId ?? null,
  });
}

export function buildIntentPlan(
  input: string,
  identity?: { taskId?: string | null; traceId?: string | null },
): IntentPlan {
  const normalizedInput = input.trim();
  if (!normalizedInput) {
    return buildBasePlan(
      'empty intent',
      'NEEDS_INPUT',
      { kind: 'none', id: null, confidence: 0, matchedTerms: [] },
      [],
      [{
        id: 'operation',
        capability: 'intent',
        kind: 'operation',
        question: 'Describe the image result you want.',
        examples: ['Compress the image', 'Remove the background', 'Convert to WebP'],
      }],
      [],
      'none',
      'No executable intent was supplied.',
      identity,
    );
  }

  const intent = resolveIntent(normalizedInput);
  const extraction = extractParameters(normalizedInput);
  const operations = extraction.payload?.operations ?? [];
  const missing = buildMissingRequirements(normalizedInput, extraction, intent);

  if (missing.length > 0) {
    return buildBasePlan(
      normalizedInput,
      'NEEDS_INPUT',
      intent,
      operations,
      missing,
      [],
      'none',
      'Required information is missing before a safe plan can be built.',
      identity,
    );
  }

  if (!extraction.success && extraction.errors.length > 0) {
    return buildBasePlan(
      normalizedInput,
      extraction.errors.some((error) => /unrecognized instruction content/i.test(error)) ? 'UNSAFE' : 'UNSUPPORTED',
      intent,
      operations,
      [],
      [],
      'none',
      extraction.errors.join(' '),
      identity,
    );
  }

  const quickFlow = buildQuickFlowPlan(normalizedInput, TOOLS_REGISTRY);
  if (!quickFlow) {
    return buildBasePlan(
      normalizedInput,
      'UNSUPPORTED',
      intent,
      operations,
      [],
      [],
      'none',
      'No safe executable QuickFlow could be constructed from the current capability registry.',
      identity,
    );
  }

  const candidate = candidateFromQuickFlow(quickFlow, intent);
  const guard = validateExecutionCandidate(candidate);
  if (!guard.ok) {
    return buildBasePlan(
      normalizedInput,
      'UNSAFE',
      intent,
      operations,
      [],
      [],
      'none',
      guard.reason,
      identity,
    );
  }

  return buildBasePlan(
    normalizedInput,
    'READY',
    intent,
    operations,
    [],
    candidate.steps,
    'quickflow',
    'Plan validated against the canonical capability registry and is waiting for explicit confirmation.',
    identity,
  );
}
