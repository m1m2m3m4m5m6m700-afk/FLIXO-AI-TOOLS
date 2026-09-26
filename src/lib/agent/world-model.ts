import { z } from 'zod';

export const WORLD_MODEL_VERSION = 1 as const;

export const FACT_SOURCES = ['USER', 'TOOL', 'SYSTEM', 'MEMORY', 'MODEL'] as const;
export const FACT_STATES = ['VERIFIED', 'PROBABLE', 'INFERRED', 'UNKNOWN', 'CONFLICTED'] as const;
export const REQUIREMENT_CLASSES = ['HARD', 'SOFT', 'INFERRED', 'UNCERTAIN'] as const;
export const CHANGE_ACTIONS = ['PRESERVE', 'REMOVE', 'ADD', 'MODIFY', 'TRANSFORM', 'OUTPUT'] as const;

export const FactSchema = z.object({
  key: z.string().trim().min(1).max(200),
  value: z.string().trim().max(2_000),
  source: z.enum(FACT_SOURCES),
  state: z.enum(FACT_STATES),
  confidence: z.number().finite().min(0).max(1),
}).strict();

export const RequirementSchema = z.object({
  text: z.string().trim().min(1).max(1_000),
  class: z.enum(REQUIREMENT_CLASSES),
  source: z.enum(FACT_SOURCES),
  confidence: z.number().finite().min(0).max(1),
}).strict();

export const TasteSignalSchema = z.object({
  value: z.string().trim().min(1).max(500),
  liked: z.boolean(),
  source: z.enum(['USER', 'MEMORY', 'MODEL']),
  confidence: z.number().finite().min(0).max(1),
}).strict();

export const ConfidenceVectorSchema = z.object({
  intent: z.number().finite().min(0).max(1),
  visual: z.number().finite().min(0).max(1),
  constraints: z.number().finite().min(0).max(1),
  taste: z.number().finite().min(0).max(1),
  tool: z.number().finite().min(0).max(1),
  execution: z.number().finite().min(0).max(1),
}).strict();

export const ChangeMapSchema = z.object({
  preserve: z.array(z.string().trim().min(1).max(500)).max(32),
  remove: z.array(z.string().trim().min(1).max(500)).max(32),
  add: z.array(z.string().trim().min(1).max(500)).max(32),
  modify: z.array(z.string().trim().min(1).max(500)).max(32),
  transform: z.array(z.string().trim().min(1).max(500)).max(32),
  output: z.array(z.string().trim().min(1).max(500)).max(32),
}).strict();

export const WorldModelSchema = z.object({
  version: z.literal(WORLD_MODEL_VERSION),
  request: z.string().trim().min(1).max(4_000),
  goal: z.string().nullable(),
  desiredResult: z.string().nullable(),
  constraints: z.array(RequirementSchema).max(32),
  negativeRequirements: z.array(z.string().trim().min(1).max(1_000)).max(32),
  knownFacts: z.array(FactSchema).max(32),
  assumptions: z.array(FactSchema).max(32),
  inferredFacts: z.array(FactSchema).max(32),
  uncertainties: z.array(z.string().trim().min(1).max(500)).max(32),
  userTaste: z.array(TasteSignalSchema).max(32),
  activeContext: z.object({
    activeCommand: z.string().nullable(),
    hasActivePlan: z.boolean(),
  }).strict(),
  activePlan: z.unknown().nullable(),
  verificationCriteria: z.array(z.string().trim().min(1).max(500)).max(32),
  changeMap: ChangeMapSchema,
  confidence: ConfidenceVectorSchema,
  ambiguityScore: z.number().finite().min(0).max(1),
}).strict();

export type WorldModel = z.infer<typeof WorldModelSchema>;

type IntentProjection = Readonly<{
  kind: 'tool' | 'workflow' | 'none';
  id: string | null;
  confidence: number;
}>;

type OperationProjection = Readonly<{
  capability: string;
  params: Readonly<Record<string, string | number | boolean>>;
}>;

type MissingProjection = Readonly<{
  id: string;
  capability: string;
  kind: 'format' | 'crop-geometry' | 'operation' | 'clarification';
  question: string;
}>;

type WorldModelContext = Readonly<{
  activeCommand?: string | null;
  activePlan?: unknown | null;
  hasImage?: boolean;
  userTaste?: readonly z.infer<typeof TasteSignalSchema>[];
}>;

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

function extractNegativeRequirements(input: string): string[] {
  const matches = input.match(/(?:^|[.!؟،,;])\s*(?:لا\s+[^.!؟،,;]+|مات(?:عمل|غير|لمس)[^.!؟،,;]+|مت(?:غير|لمس)[^.!؟،,;]+|بدون\s+[^.!؟،,;]+|من\s+غير\s+[^.!؟،,;]+|(?:do\s+not|don't|without|no)\s+[^.!?,;]+)/giu) ?? [];
  return [...new Set(matches.map((value) => value.trim()))].slice(0, 32);
}

function buildChangeMap(input: string, negativeRequirements: readonly string[]): z.infer<typeof ChangeMapSchema> {
  const change = {
    preserve: [...negativeRequirements, 'face identity when present', 'important text and brand marks when present'],
    remove: [],
    add: [],
    modify: [],
    transform: [],
    output: [],
  } as z.infer<typeof ChangeMapSchema>;

  if (/(?:إزالة|ازالة|شيل|remove|delete)\s+(?:ال)?خلف(?:ية|يه)/iu.test(input) || /(?:remove|delete)\s+(?:the\s+)?background/iu.test(input)) change.remove.push('background');
  if (/(?:قص|crop|مربع|square|نسبة\s*(?:الأبعاد|ابعاد))/iu.test(input)) change.transform.push('crop');
  if (/(?:تحسين|enhance|سطوع|brightness|تباين|contrast|حدة|sharpness|ألوان|الوان|color)/iu.test(input)) change.modify.push('image appearance');
  if (/(?:إضافة|اضف|أضف|add|ضع|put)\s+/iu.test(input)) change.add.push('requested additions');
  if (/(?:تحويل|convert|صيغة|format|resize|تغيير\s+الحجم|غير\s+الحجم)/iu.test(input)) change.output.push('requested output format or dimensions');

  return change;
}

function buildVerificationCriteria(input: string, negativeRequirements: readonly string[]): string[] {
  const criteria = ['output artifact exists', 'output decodes successfully', 'output contract is satisfied'];
  if (/(?:وجه|face)/iu.test(input) || negativeRequirements.some((item) => /(?:وجه|face)/iu.test(item))) criteria.push('face identity is preserved');
  if (negativeRequirements.length > 0) criteria.push('negative requirements are preserved');
  if (/(?:خلف(?:ية|يه)|background)/iu.test(input)) criteria.push('requested background change is reflected');
  return [...new Set(criteria)];
}

export function buildWorldModel(
  input: string,
  intent: IntentProjection,
  operations: readonly OperationProjection[],
  missing: readonly MissingProjection[],
  context: WorldModelContext = {},
): WorldModel {
  const request = input.trim();
  const negativeRequirements = extractNegativeRequirements(request);
  const hasImage = context.hasImage === true;
  const constraints = [
    ...(missing.length > 0 ? missing.map((item) => ({
      text: item.question,
      class: 'UNCERTAIN' as const,
      source: 'USER' as const,
      confidence: 0.95,
    })) : []),
    ...negativeRequirements.map((text) => ({
      text,
      class: 'HARD' as const,
      source: 'USER' as const,
      confidence: 0.95,
    })),
  ];

  const knownFacts = [{
    key: 'user-request',
    value: request,
    source: 'USER' as const,
    state: 'VERIFIED' as const,
    confidence: 1,
  }];

  const assumptions = !hasImage ? [{
    key: 'image-context',
    value: 'No image evidence was supplied to the conversation model.',
    source: 'MODEL' as const,
    state: 'UNKNOWN' as const,
    confidence: 0.2,
  }] : [];

  const inferredFacts = intent.id ? [{
    key: 'intent',
    value: intent.id,
    source: 'MODEL' as const,
    state: 'INFERRED' as const,
    confidence: clamp(intent.confidence),
  }] : [];

  const uncertainties = missing.map((item) => item.id);
  const taste = [...(context.userTaste ?? [])].map((item) => TasteSignalSchema.parse(item));
  const operationsPresent = operations.length > 0;
  const intentConfidence = clamp(intent.confidence);
  const visualConfidence = hasImage ? 0.8 : 0.2;
  const constraintsConfidence = missing.length > 0 ? 0.45 : negativeRequirements.length > 0 ? 0.9 : 0.75;
  const tasteConfidence = taste.length > 0 ? Math.max(...taste.map((item) => item.confidence)) : 0.3;
  const toolConfidence = operationsPresent ? 0.85 : 0.2;
  const ambiguityScore = clamp(
    (missing.length > 0 ? 0.35 : 0)
    + (1 - intentConfidence) * 0.45
    + (!operationsPresent ? 0.10 : 0)
    + (negativeRequirements.length === 0 ? 0.05 : 0),
  );

  return WorldModelSchema.parse({
    version: WORLD_MODEL_VERSION,
    request,
    goal: intent.id,
    desiredResult: request || null,
    constraints,
    negativeRequirements,
    knownFacts,
    assumptions,
    inferredFacts,
    uncertainties,
    userTaste: taste,
    activeContext: {
      activeCommand: context.activeCommand ?? null,
      hasActivePlan: context.activePlan != null,
    },
    activePlan: context.activePlan ?? null,
    verificationCriteria: buildVerificationCriteria(request, negativeRequirements),
    changeMap: buildChangeMap(request, negativeRequirements),
    confidence: {
      intent: intentConfidence,
      visual: visualConfidence,
      constraints: constraintsConfidence,
      taste: tasteConfidence,
      tool: toolConfidence,
      execution: 0,
    },
    ambiguityScore,
  });
}
