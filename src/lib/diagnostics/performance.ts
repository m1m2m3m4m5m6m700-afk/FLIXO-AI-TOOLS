export type PerformanceDiagnostic = {
  kind: 'navigation' | 'longtask' | 'memory';
  route: string;
  timestamp: string;
  durationMs?: number;
  domContentLoadedMs?: number;
  loadEventMs?: number;
  jsHeapUsedBytes?: number;
  jsHeapLimitBytes?: number;
};

const STORAGE_KEY = 'flixo:performance-diagnostics';
const MAX_ENTRIES = 30;

function saveDiagnostic(diagnostic: PerformanceDiagnostic): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const current = raw ? (JSON.parse(raw) as PerformanceDiagnostic[]) : [];
    current.push(diagnostic);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current.slice(-MAX_ENTRIES)));
  } catch {
    // Performance diagnostics must never affect the application.
  }
}

export function getPerformanceDiagnostics(): PerformanceDiagnostic[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PerformanceDiagnostic[]) : [];
  } catch {
    return [];
  }
}

export function clearPerformanceDiagnostics(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Performance diagnostics must never affect the application.
  }
}

function route(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function recordNavigation(): void {
  const navigation = performance.getEntriesByType('navigation')[0];
  if (!navigation) return;

  const entry = navigation as PerformanceNavigationTiming;
  saveDiagnostic({
    kind: 'navigation',
    route: route(),
    timestamp: new Date().toISOString(),
    domContentLoadedMs: Math.round(entry.domContentLoadedEventEnd),
    loadEventMs: Math.round(entry.loadEventEnd),
  });
}

function recordMemory(): void {
  const memory = (performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  }).memory;

  if (!memory) return;

  saveDiagnostic({
    kind: 'memory',
    route: route(),
    timestamp: new Date().toISOString(),
    jsHeapUsedBytes: memory.usedJSHeapSize,
    jsHeapLimitBytes: memory.jsHeapSizeLimit,
  });
}

export function installPerformanceDiagnostics(): () => void {
  const observers: PerformanceObserver[] = [];

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          saveDiagnostic({
            kind: 'longtask',
            route: route(),
            timestamp: new Date().toISOString(),
            durationMs: Math.round(entry.duration),
          });
        }
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
      observers.push(longTaskObserver);
    } catch {
      // The Long Tasks API is not available in every browser.
    }
  }

  window.addEventListener('load', recordNavigation, { once: true });
  const memoryTimer = window.setTimeout(recordMemory, 0);

  return () => {
    window.removeEventListener('load', recordNavigation);
    window.clearTimeout(memoryTimer);
    for (const observer of observers) observer.disconnect();
  };
}
