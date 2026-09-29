import { z } from 'zod';

const constraint = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(['PRESERVE', 'STYLE', 'QUALITY', 'SCOPE', 'FORMAT']),
  value: z.string().min(1).max(500),
  priority: z.enum(['CRITICAL', 'HIGH', 'NORMAL']).default('NORMAL'),
}).strict();

const operation = z.object({
  id: z.string().min(1).max(80),
  capabilityId: z.string().min(1).max(120),
  purpose: z.string().min(1).max(500),
  order: z.number().int().positive(),
}).strict();

export const VisualTaskSpecSchema = z.object({
  version: z.literal(1),
  source: z.literal('DETERMINISTIC'),
  goal: z.string().min(1).max(2000),
  constraints: z.array(constraint).max(24),
  operations: z.array(operation).min(1).max(8),
  quality: z.object({
    artifactTolerance: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    preserveSubject: z.boolean(),
    requireVisibleChange: z.boolean(),
  }).strict(),
}).strict();

export type VisualTaskSpec = Readonly<z.infer<typeof VisualTaskSpecSchema>>;

export function parseVisualTaskSpec(value: unknown): VisualTaskSpec {
  return Object.freeze(VisualTaskSpecSchema.parse(value));
}

export function safeParseVisualTaskSpec(value: unknown) {
  return VisualTaskSpecSchema.safeParse(value);
}
