const STORAGE_KEY = 'flixo:runtime-diagnostics';
const MAX_ENTRIES = 20;

type StartupDiagnostic = {
  kind: 'error' | 'unhandledrejection';
  message: string;
  stack?: string;
  route: string;
  userAgent: string;
  timestamp: string;
};

function capture(kind: StartupDiagnostic['kind'], error: unknown): void {
  const diagnostic: StartupDiagnostic = {
    kind,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    route: `${window.location.pathname}${window.location.search}`,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const current = Array.isArray(parsed) ? parsed : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, diagnostic].slice(-MAX_ENTRIES)));
  } catch {
    // Startup diagnostics are best-effort and must never block application startup.
  }
}

export function installStartupRuntimeDiagnostics(): () => void {
  const onError = (event: ErrorEvent) => capture('error', event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => capture('unhandledrejection', event.reason);

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
