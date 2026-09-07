import { z } from 'zod';

export type RuntimeDiagnostic = {
  kind: 'error' | 'unhandledrejection';
  message: string;
  stack?: string;
  route: string;
  userAgent: string;
  timestamp: string;
};

const STORAGE_KEY = 'flixo:runtime-diagnostics';
const MAX_ENTRIES = 20;
const diagnosticSchema = z.object({
  kind: z.enum(['error', 'unhandledrejection']),
  message: z.string().max(16 * 1024),
  stack: z.string().max(32 * 1024).optional(),
  route: z.string().max(4096),
  userAgent: z.string().max(2048),
  timestamp: z.string().datetime(),
}).strict();
const diagnosticsSchema = z.array(diagnosticSchema).max(MAX_ENTRIES);

function purgeCorruptState(reason: unknown): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* restricted storage */ }
  console.error('[runtime-diagnostics] rejected persisted state', reason);
}

function parsePersisted(raw: string | null): RuntimeDiagnostic[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = diagnosticsSchema.safeParse(parsed);
    if (result.success) return result.data;
    purgeCorruptState(result.error.flatten());
  } catch (error) {
    purgeCorruptState(error);
  }
  return [];
}

function saveDiagnostic(diagnostic: RuntimeDiagnostic): void {
  try {
    const current = parsePersisted(localStorage.getItem(STORAGE_KEY));
    const validated = diagnosticSchema.parse(diagnostic);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, validated].slice(-MAX_ENTRIES)));
  } catch (error) {
    console.error('[runtime-diagnostics] persistence rejected', error);
  }
}

export function getRuntimeDiagnostics(): RuntimeDiagnostic[] {
  try { return parsePersisted(localStorage.getItem(STORAGE_KEY)); }
  catch (error) { purgeCorruptState(error); return []; }
}

export function clearRuntimeDiagnostics(): void {
  try { localStorage.removeItem(STORAGE_KEY); }
  catch (error) { console.error('[runtime-diagnostics] clear failed', error); }
}

function record(kind: RuntimeDiagnostic['kind'], error: unknown): void {
  const diagnostic: RuntimeDiagnostic = {
    kind,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    route: `${window.location.pathname}${window.location.search}`,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };
  saveDiagnostic(diagnostic);
}

export function installRuntimeDiagnostics(): () => void {
  const onError = (event: ErrorEvent) => record('error', event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => record('unhandledrejection', event.reason);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
