import type { AgentEventEnvelope } from './event-gateway.ts';

export const INGESTION_PIPELINE_VERSION = 1 as const;

export type IngestionSource =
  | 'WEB' | 'PDF' | 'IMAGE' | 'VIDEO' | 'RSS' | 'API'
  | 'DATABASE' | 'GITHUB' | 'USER_FILE' | 'CONVERSATION';

export type IngestionDocument = Readonly<{
  source: IngestionSource;
  locator: string;
  mimeType: string | null;
  text: string | null;
  bytes: number;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type NormalizedIngestion = Readonly<{
  version: typeof INGESTION_PIPELINE_VERSION;
  document: IngestionDocument;
  normalizedText: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type IngestionHandlers = Readonly<{
  understand?: (input: NormalizedIngestion) => Promise<NormalizedIngestion> | NormalizedIngestion;
  transform?: (input: NormalizedIngestion) => Promise<NormalizedIngestion> | NormalizedIngestion;
  verify?: (input: NormalizedIngestion) => Promise<boolean> | boolean;
  deliver?: (input: NormalizedIngestion) => Promise<void> | void;
}>;

function stripNulCharacters(text: string): string {
  return [...text].filter((character) => character !== String.fromCharCode(0)).join('');
}

function normalizeText(text: string | null): string {
  return stripNulCharacters(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 100_000);
}

export function normalizeIngestion(document: IngestionDocument): NormalizedIngestion {
  if (!document.locator.trim()) throw new Error('INGESTION_LOCATOR_REQUIRED');
  if (!Number.isInteger(document.bytes) || document.bytes < 0) throw new Error('INGESTION_BYTES_INVALID');

  return Object.freeze({
    version: INGESTION_PIPELINE_VERSION,
    document: Object.freeze({
      ...document,
      locator: document.locator.trim().slice(0, 2048),
      text: document.text === null ? null : stripNulCharacters(document.text).slice(0, 100_000),
      metadata: Object.freeze({ ...document.metadata }),
    }),
    normalizedText: normalizeText(document.text),
    metadata: Object.freeze({
      source: document.source,
      mimeType: document.mimeType,
      bytes: document.bytes,
      ...document.metadata,
    }),
  });
}

export async function runIngestionPipeline(
  document: IngestionDocument,
  handlers: IngestionHandlers = {},
): Promise<NormalizedIngestion> {
  let current = normalizeIngestion(document);
  if (handlers.understand) current = Object.freeze(await handlers.understand(current));
  if (handlers.transform) current = Object.freeze(await handlers.transform(current));
  if (handlers.verify && !(await handlers.verify(current))) {
    throw new Error('INGESTION_VERIFICATION_FAILED');
  }
  if (handlers.deliver) await handlers.deliver(current);
  return current;
}

export function ingestionFromAgentEvent(event: AgentEventEnvelope): IngestionDocument {
  const source: IngestionSource =
    event.source === 'FILE_UPLOAD' ? 'USER_FILE' :
    event.source === 'USER_MESSAGE' ? 'CONVERSATION' :
    event.source === 'WEBHOOK' ? 'API' :
    event.source === 'SYSTEM' ? 'DATABASE' :
    'CONVERSATION';

  return {
    source,
    locator: event.source + ':' + event.eventId,
    mimeType: typeof event.payload.mimeType === 'string' ? event.payload.mimeType : null,
    text: typeof event.payload.text === 'string' ? event.payload.text : null,
    bytes: typeof event.payload.bytes === 'number' ? event.payload.bytes : 0,
    metadata: {
      eventType: event.eventType,
      userId: event.userId,
      conversationId: event.conversationId,
      taskId: event.taskId,
      traceId: event.traceId,
    },
  };
}
