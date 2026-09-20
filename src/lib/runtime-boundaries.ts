import { z } from 'zod';
import { TOOLS_REGISTRY } from '../config/tools.ts';

const toolIds = new Set(TOOLS_REGISTRY.map((tool) => tool.id));

export const ToolChainStepSchema = z.object({
  id: z.string().min(1).max(200),
  order: z.number().int().nonnegative().max(1000),
}).strict();

export const ToolChainSchema = z.array(ToolChainStepSchema).max(8);
export const ToolIdArraySchema = z.array(z.string().min(1).max(200)).max(50);

export const RuntimeDiagnosticSchema = z.object({
  kind: z.enum(['error', 'unhandledrejection']),
  message: z.string().max(20_000),
  stack: z.string().max(50_000).optional(),
  route: z.string().max(4_096),
  userAgent: z.string().max(2_000),
  timestamp: z.string().datetime({ offset: true }),
}).strict();

export const RuntimeDiagnosticsSchema = z.array(RuntimeDiagnosticSchema).max(20);

const checkpointIdentitySchema = z.object({
  commitSha: z.string().regex(/^[0-9a-f]{40}$/i),
  contractId: z.string().min(1).max(200),
  contractVersion: z.number().int().nonnegative(),
  inputHash: z.string().min(1).max(200),
  dependencyHash: z.string().min(1).max(200),
  lockfileHash: z.string().min(1).max(200),
  toolchainHash: z.string().min(1).max(200),
  configHash: z.string().min(1).max(200),
  ciConfigHash: z.string().min(1).max(200),
}).strict();

const checkpointScopeSchema = z.object({
  toolId: z.string().max(200).optional(),
  route: z.string().max(4_096).optional(),
  locale: z.string().max(32).optional(),
  file: z.string().max(4_096).optional(),
  artifact: z.string().max(4_096).optional(),
}).strict();

const checkpointEvidenceSchema = z.object({
  source: z.string().max(200).optional(),
  line: z.number().int().positive().optional(),
  artifact: z.string().max(4_096).optional(),
  sha256: z.string().max(200).optional(),
}).strict();

const checkpointResultSchema = z.object({
  gate: z.string().min(1).max(200),
  contract: z.string().min(1).max(200),
  contractVersion: z.number().int().nonnegative(),
  status: z.enum(['PASS', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  scope: checkpointScopeSchema,
  assertion: z.string().max(20_000).optional(),
  expected: z.unknown().optional(),
  actual: z.unknown().optional(),
  rootCauseId: z.string().max(200).optional(),
  blockedBy: z.array(z.string().max(200)).max(100).optional(),
  evidence: z.array(checkpointEvidenceSchema).max(100).optional(),
  durationMs: z.number().finite().nonnegative().optional(),
}).strict();

export const StoredCheckpointSchema = z.object({
  schemaVersion: z.literal(1),
  identity: checkpointIdentitySchema,
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/i),
  result: checkpointResultSchema,
  evidencePath: z.string().max(4_096).optional(),
}).strict();

export const ImageAIResponseSchema = z.object({
  requestId: z.string().max(512).optional(),
  mimeType: z.string().max(255).optional(),
  text: z.string().max(100_000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type StoredCheckpointData = z.infer<typeof StoredCheckpointSchema>;

export function parseToolChain(value: unknown): Array<{ id: string; order: number }> {
  const parsed = ToolChainSchema.parse(value);
  const ids = new Set<string>();
  for (const step of parsed) {
    if (!toolIds.has(step.id)) throw new Error(`Unknown persisted tool id: ${step.id}`);
    if (ids.has(step.id)) throw new Error(`Duplicate persisted tool id: ${step.id}`);
    ids.add(step.id);
  }
  return parsed.map((step, index) => ({ id: step.id, order: index }));
}

export function parsePersistedToolIds(value: unknown, maxEntries: number): string[] {
  const parsed = ToolIdArraySchema.max(maxEntries).parse(value);
  const seen = new Set<string>();
  for (const toolId of parsed) {
    if (!toolIds.has(toolId)) throw new Error(`Unknown persisted tool id: ${toolId}`);
    if (seen.has(toolId)) throw new Error(`Duplicate persisted tool id: ${toolId}`);
    seen.add(toolId);
  }
  return parsed;
}

export function parseRuntimeDiagnostics(value: unknown): z.infer<typeof RuntimeDiagnosticsSchema> {
  return RuntimeDiagnosticsSchema.parse(value);
}

export function parseStoredCheckpoint(value: unknown): StoredCheckpointData {
  return StoredCheckpointSchema.parse(value);
}
