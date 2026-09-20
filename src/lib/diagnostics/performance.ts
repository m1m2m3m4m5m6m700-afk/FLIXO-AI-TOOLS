export type CoreWebVitalsSnapshot = {
  lcp?: number;
  inp?: number;
  cls?: number;
  route: string;
  locale?: string;
  timestamp: string;
};

export type ToolPerformanceMetric = {
  toolId: string;
  operation: string;
  durationMs: number;
  workerDurationMs?: number;
  decodeDurationMs?: number;
  encodeDurationMs?: number;
  route: string;
  timestamp: string;
};

type PerformanceEntryRecord = CoreWebVitalsSnapshot | ToolPerformanceMetric;

const STORAGE_KEY = 'flixo:performance-diagnostics';
const MAX_ENTRIES = 50;

function save(entry: PerformanceEntryRecord): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const current = raw ? (JSON.parse(raw) as PerformanceEntryRecord[]) : [];
    current.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current.slice(-MAX_ENTRIES)));
  } catch {
    // Performance diagnostics must never affect the application.
  }
}

export function recordToolPerformance(metric: Omit<ToolPerformanceMetric, 'route' | 'timestamp'>): void {
  save({
    ...metric,
    route: `${window.location.pathname}${window.location.search}`,
    timestamp: new Date().toISOString(),
  });
}

export function installCoreWebVitalsDiagnostics(): () => void {
  let lcp: number | undefined;
  let inp: number | undefined;
  let cls = 0;
  let clsSources = 0;
  const observers: PerformanceObserver[] = [];

  if (typeof PerformanceObserver === 'undefined') return () => undefined;

  try {
    const observer = new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1);
      if (last) lcp = last.startTime;
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    observers.push(observer);
  } catch {
    // LCP is optional when unsupported.
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (entry.duration > (inp ?? 0)) inp = entry.duration;
    });
    observer.observe({ type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
    observers.push(observer);
  } catch {
    // Event Timing is optional when unsupported.
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
        if (!shift.hadRecentInput) {
          cls += shift.value ?? 0;
          clsSources += 1;
        }
      }
    });
    observer.observe({ type: 'layout-shift', buffered: true });
    observers.push(observer);
  } catch {
    // Layout Shift is optional when unsupported.
  }

  const flush = () => {
    if (lcp === undefined && inp === undefined && clsSources === 0) return;
    save({
      lcp,
      inp,
      cls,
      route: `${window.location.pathname}${window.location.search}`,
      locale: document.documentElement.lang || undefined,
      timestamp: new Date().toISOString(),
    });
  };

  window.addEventListener('pagehide', flush, { once: true });
  return () => {
    for (const observer of observers) observer.disconnect();
    window.removeEventListener('pagehide', flush);
  };
}

export function getPerformanceDiagnostics(): PerformanceEntryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PerformanceEntryRecord[]) : [];
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
