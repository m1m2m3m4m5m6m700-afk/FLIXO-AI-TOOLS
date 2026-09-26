import { z } from 'zod';

export const KnowledgeStatusSchema = z.enum([
  'VERIFIED',
  'PROBABLE',
  'INFERRED',
  'UNKNOWN',
  'CONFLICTED',
]);

export const KnowledgeSourceTypeSchema = z.enum([
  'FLIXO_DOC',
  'REPOSITORY',
  'TEST',
  'INTERNAL_EVIDENCE',
  'TRUSTED_EXTERNAL',
  'WEB',
  'GENERATED',
]);

export const KnowledgeRecordSchema = z.object({
  id: z.string().min(1).max(256),
  content: z.string().min(1).max(100_000),
  source: z.string().min(1).max(2_000),
  sourceType: KnowledgeSourceTypeSchema,
  timestamp: z.string().datetime({ offset: true }),
  version: z.string().min(1).max(128),
  scope: z.string().min(1).max(512),
  confidence: z.number().finite().min(0).max(1),
  provenance: z.array(z.string().min(1).max(2_000)).min(1).max(32),
  validity: z.enum(['CURRENT', 'STALE', 'REVOKED']),
  status: KnowledgeStatusSchema,
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export type KnowledgeRecord = z.infer<typeof KnowledgeRecordSchema>;

export const KnowledgeQuerySchema = z.object({
  text: z.string().trim().min(1).max(8_000),
  scope: z.string().trim().min(1).max(512).optional(),
  limit: z.number().int().positive().max(50).default(10),
  minConfidence: z.number().finite().min(0).max(1).default(0),
}).strict();

export type KnowledgeQuery = z.infer<typeof KnowledgeQuerySchema>;

export type RetrievalSignal = Readonly<{
  lexical: number;
  semantic: number;
  authority: number;
  freshness: number;
  provenance: number;
}>;

export type RankedKnowledge = Readonly<{
  record: KnowledgeRecord;
  score: number;
  signals: RetrievalSignal;
}>;

export function validateKnowledgeRecord(value: unknown): KnowledgeRecord {
  return KnowledgeRecordSchema.parse(value);
}

export function validateKnowledgeQuery(value: unknown): KnowledgeQuery {
  return KnowledgeQuerySchema.parse(value);
}
