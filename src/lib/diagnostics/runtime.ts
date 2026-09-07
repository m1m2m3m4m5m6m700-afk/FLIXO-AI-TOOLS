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
  message: z.string(),
  stack: z.string().optional(),
  route: z.string(),
  userAgent: z.string(),
  timestamp: z.string(),
}).strict();
const diagnosticsSchema = z.array(diagnosticSchema).max(MAX_ENTRIES);

function parsePersisted(raw: string | null): RuntimeDiagnostic[] {
  if (!raw) return [];
  const parsed = diagnosticsSchema.safeParse(JSON.parse(raw));
  if (parsed.success) return parsed.data;
  console.error('[runtime-diagnostics] rejected persisted state', parsed.error.flatten());
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* restricted storage */ }
  return [];
}

function saveDiagnostic(diagnostic: RuntimeDiagnostic): void {
  try {
    const current = parsePersisted(localStorage.getItem(STORAGE_KEY));
    current.push(diagnostic);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current.slice(-MAX_ENTRIES)));
  } catch (error) {
    console.error('[runtime-diagnostics] persistence failed', error);
  }
}

export function getRuntimeDiagnostics(): RuntimeDiagnostic[] {
  try { return parsePersisted(localStorage.getItem(STORAGE_KEY)); }
  catch (error) { console.error('[runtime-diagnostics] read failed', error); return []; }
}

export function clearRuntimeDiagnostics(): void {
  try { localStorage.removeItem(STORAGE_KEY); }
  catch (error) { console.error('[runtime-diagnostics] clear failed', error); }
}

function record(kind: RuntimeDiagnostic['kind'], error: unknown): void {
  saveDiagnostic({
    kind,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    route: `${window.location.pathname}${window.location.search}`,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  });
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
