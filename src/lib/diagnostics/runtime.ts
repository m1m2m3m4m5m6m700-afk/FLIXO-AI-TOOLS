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

function saveDiagnostic(diagnostic: RuntimeDiagnostic): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const current = raw ? (JSON.parse(raw) as RuntimeDiagnostic[]) : [];
    current.push(diagnostic);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current.slice(-MAX_ENTRIES)));
  } catch {
    // Diagnostics must never break the application.
  }
}

export function getRuntimeDiagnostics(): RuntimeDiagnostic[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RuntimeDiagnostic[]) : [];
  } catch {
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
