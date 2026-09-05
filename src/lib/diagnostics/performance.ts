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

export type RuntimePerformanceDiagnostic = {
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
const MAX_ENTRIES = 50;

type PerformanceEntryRecord = CoreWebVitalsSnapshot | ToolPerformanceMetric | RuntimePerformanceDiagnostic;

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
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries.at(-1) as PerformanceEntry | undefined;
      if (last) lcp = last.startTime;
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    observers.push(lcpObserver);
  } catch {
    // Browser does not expose LCP observer.
  }

  try {
    const inpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = entry.duration;
        if (duration > (inp ?? 0)) inp = duration;
      }
    });
    inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
    observers.push(inpObserver);
  } catch {
    // Browser does not expose Event Timing.
  }

  try {
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
        if (layoutShift.hadRecentInput) continue;
        cls += layoutShift.value ?? 0;
        clsSources += 1;
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
    observers.push(clsObserver);
  } catch {
    // Browser does not expose Layout Shift.
  }

  const flush = () => {
    if (lcp === undefined && inp === undefined && clsSources === 0) return;
    const locale = document.documentElement.lang || undefined;
    save({
      lcp,
      inp,
      cls,
      route: `${window.location.pathname}${window.location.search}`,
      locale,
      timestamp: new Date().toISOString(),
    });
  };

  window.addEventListener('pagehide', flush, { once: true });

  return () => {
    for (const observer of observers) observer.disconnect();
    window.removeEventListener('pagehide', flush);
  };
}

function route(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function recordNavigation(): void {
  const navigation = performance.getEntriesByType('navigation')[0];
  if (!navigation) return;

  const entry = navigation as PerformanceNavigationTiming;
  save({
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

  save({
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
          save({
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
