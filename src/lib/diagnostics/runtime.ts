import { parseRuntimeDiagnostics, RuntimeDiagnosticSchema } from '../runtime-boundaries.ts';
import type { z } from 'zod';

export type RuntimeDiagnostic = z.infer<typeof RuntimeDiagnosticSchema>;

const STORAGE_KEY = 'flixo:runtime-diagnostics';
const MAX_ENTRIES = 20;

function clearInvalidDiagnostics(reason: unknown): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Diagnostics must never block recovery from corrupted persistence.
  }
  console.error('[FLIXO][boundary] Purged invalid runtime diagnostics.', { key: STORAGE_KEY, reason });
}

function saveDiagnostic(diagnostic: RuntimeDiagnostic): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const current = raw === null ? [] : parseRuntimeDiagnostics(JSON.parse(raw));
    const validated = RuntimeDiagnosticSchema.parse(diagnostic);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, validated].slice(-MAX_ENTRIES)));
  } catch (error) {
    clearInvalidDiagnostics(error);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([diagnostic]));
    } catch {
      // Diagnostics must never break the application.
    }
  }
}

export function getRuntimeDiagnostics(): RuntimeDiagnostic[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];

  try {
    return parseRuntimeDiagnostics(JSON.parse(raw));
  } catch (error) {
    clearInvalidDiagnostics(error);
    return [];
  }
}

export function clearRuntimeDiagnostics(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Diagnostics must never break the application.
  }
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
