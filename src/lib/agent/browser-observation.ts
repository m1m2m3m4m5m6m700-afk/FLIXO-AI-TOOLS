import { z } from 'zod';
import type { McpCapabilityDefinition } from './mcp-gateway.ts';

const Sha = z.string().regex(/^[a-f0-9]{40}$/u);
const Identity = z.string().trim().min(1).max(256);
const SafeText = z.string().max(500);
const ObservationStatus = z.enum(['clean', 'degraded', 'failed']);

export const BrowserObservationInputSchema = z.object({
  taskId: Identity,
  traceId: Identity,
  expectedSha: Sha,
  url: z.string().trim().min(1).max(2048),
}).strict();

export const BrowserObservationSchema = z.object({
  schemaVersion: z.literal(1),
  taskId: Identity,
  traceId: Identity,
  exactSha: Sha,
  url: z.string().trim().min(1).max(2048),
  capturedAt: z.string().datetime(),
  status: ObservationStatus,
  document: z.object({
    title: z.string().max(500),
    lang: z.string().max(64),
    dir: z.enum(['ltr', 'rtl', 'auto']),
    readyState: z.enum(['loading', 'interactive', 'complete']),
    mainCount: z.number().int().nonnegative(),
    h1Count: z.number().int().nonnegative(),
  }).strict(),
  consoleErrors: z.array(z.object({
    type: z.string().max(64),
    text: SafeText,
  }).strict()).max(100),
  pageErrors: z.array(z.object({
    name: z.string().max(128).optional(),
    message: SafeText,
  }).strict()).max(100),
  requestFailures: z.array(z.object({
    method: z.string().max(16),
    resourceType: z.string().max(64),
    failure: SafeText.optional(),
    url: z.string().max(2048),
  }).strict()).max(100),
  failedResponses: z.array(z.object({
    status: z.number().int().min(400).max(599),
    statusText: z.string().max(256),
    method: z.string().max(16),
    resourceType: z.string().max(64),
    url: z.string().max(2048),
  }).strict()).max(100),
  performance: z.object({
    domContentLoadedMs: z.number().nonnegative().nullable(),
    loadEventMs: z.number().nonnegative().nullable(),
    firstContentfulPaintMs: z.number().nonnegative().nullable(),
    resourceCount: z.number().int().nonnegative(),
  }).strict(),
}).strict();

export type BrowserObservationInput = z.infer<typeof BrowserObservationInputSchema>;
export type BrowserObservation = z.infer<typeof BrowserObservationSchema>;

export function normalizeBrowserObservationUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.origin + url.pathname;
  } catch {
    return value.split(/[?#]/u, 1)[0] || value;
  }
}

export function isCurrentBrowserObservation(
  observation: BrowserObservation,
  input: BrowserObservationInput,
): boolean {
  return observation.exactSha === input.expectedSha
    && observation.taskId === input.taskId
    && observation.traceId === input.traceId
    && normalizeBrowserObservationUrl(observation.url) === normalizeBrowserObservationUrl(input.url);
}

export type BrowserObservationAdapter = (
  input: BrowserObservationInput,
  signal: AbortSignal,
) => Promise<unknown>;

export function createBrowserObservationCapability(
  adapter: BrowserObservationAdapter,
): McpCapabilityDefinition<BrowserObservationInput, BrowserObservation> {
  return Object.freeze({
    id: 'browser.observe',
    kind: 'BROWSER_OBSERVATION',
    inputSchema: BrowserObservationInputSchema,
    outputSchema: BrowserObservationSchema,
    permission: 'READ',
    requiredTrust: 'CORE',
    timeoutMs: 30_000,
    invoke: adapter,
    verify: (output, input) => isCurrentBrowserObservation(output, input),
  });
}
