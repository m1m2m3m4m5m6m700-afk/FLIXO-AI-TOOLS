export const INGESTION_RUNTIME_VERSION = 1 as const;

export type IngestionSource =
  | 'WEB'
  | 'PDF'
  | 'IMAGE'
  | 'VIDEO'
  | 'RSS'
  | 'API'
  | 'DATABASE'
  | 'GITHUB'
  | 'USER_FILE'
  | 'CONVERSATION';

export type IngestionStage =
  | 'INGEST'
  | 'NORMALIZE'
  | 'FILTER'
  | 'UNDERSTAND'
  | 'TRANSFORM'
  | 'VERIFY'
  | 'DELIVER';

export type IngestionEnvelope = Readonly<{
  version: typeof INGESTION_RUNTIME_VERSION;
  ingestionId: string;
  source: IngestionSource;
  sourceRef: string;
  mediaType: string | null;
  bytes: number | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type IngestionArtifact = Readonly<{
  stage: IngestionStage;
  value: unknown;
  producedAt: string;
  checksum: string;
}>;

export type IngestionPipeline = Readonly<{
  ingestionId: string;
  source: IngestionSource;
  artifacts: readonly IngestionArtifact[];
  finalValue: unknown;
}>;

export type IngestionStageRunner = (
  input: unknown,
  context: Readonly<{ envelope: IngestionEnvelope; previous: readonly IngestionArtifact[] }>,
) => Promise<unknown> | unknown;

export type IngestionPipelineConfig = Readonly<{
  normalize?: IngestionStageRunner;
  filter?: IngestionStageRunner;
  understand?: IngestionStageRunner;
  transform?: IngestionStageRunner;
  verify?: IngestionStageRunner;
  deliver?: IngestionStageRunner;
  maxStages?: number;
  maxOutputBytes?: number;
}>;

function checksum(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function requiredText(value: string, code: string, max = 512): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(code);
  return normalized;
}

export function createIngestionEnvelope(input: {
  ingestionId: string;
  source: IngestionSource;
  sourceRef: string;
  mediaType?: string | null;
  bytes?: number | null;
  metadata?: Readonly<Record<string, unknown>>;
}): IngestionEnvelope {
  if (!Number.isInteger(input.bytes ?? 0) || (input.bytes ?? 0) < 0) throw new Error('INGESTION_BYTES_INVALID');
  return Object.freeze({
    version: INGESTION_RUNTIME_VERSION,
    ingestionId: requiredText(input.ingestionId, 'INGESTION_ID_INVALID'),
    source: input.source,
    sourceRef: requiredText(input.sourceRef, 'INGESTION_SOURCE_REF_INVALID'),
    mediaType: input.mediaType?.trim() || null,
    bytes: input.bytes ?? null,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export async function runIngestionPipeline(
  envelope: IngestionEnvelope,
  input: unknown,
  config: IngestionPipelineConfig = {},
): Promise<IngestionPipeline> {
  const maxStages = Number.isInteger(config.maxStages) && (config.maxStages as number) > 0
    ? Math.min(config.maxStages as number, 32)
    : 8;
  const maxOutputBytes = Number.isInteger(config.maxOutputBytes) && (config.maxOutputBytes as number) > 0
    ? Math.min(config.maxOutputBytes as number, 64 * 1024 * 1024)
    : 64 * 1024 * 1024;

  const stages: readonly [IngestionStage, IngestionStageRunner | undefined][] = [
    ['INGEST', undefined],
    ['NORMALIZE', config.normalize],
    ['FILTER', config.filter],
    ['UNDERSTAND', config.understand],
    ['TRANSFORM', config.transform],
    ['VERIFY', config.verify],
    ['DELIVER', config.deliver],
  ];

  let current = input;
  const artifacts: IngestionArtifact[] = [];
  for (const [stage, runner] of stages) {
    if (artifacts.length >= maxStages) throw new Error('INGESTION_STAGE_BUDGET_EXCEEDED');
    if (runner) current = await runner(current, { envelope, previous: artifacts });
    const serialized = JSON.stringify(current);
    if (new TextEncoder().encode(serialized).byteLength > maxOutputBytes) {
      throw new Error('INGESTION_OUTPUT_BUDGET_EXCEEDED');
    }
    artifacts.push(Object.freeze({
      stage,
      value: current,
      producedAt: new Date().toISOString(),
      checksum: checksum(current),
    }));
  }

  return Object.freeze({
    ingestionId: envelope.ingestionId,
    source: envelope.source,
    artifacts: Object.freeze(artifacts),
    finalValue: current,
  });
}
