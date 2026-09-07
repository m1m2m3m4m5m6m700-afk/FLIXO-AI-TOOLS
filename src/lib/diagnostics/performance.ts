import { z } from 'zod';

export type CoreWebVitalsSnapshot = { lcp?: number; inp?: number; cls?: number; route: string; locale?: string; timestamp: string };
export type ToolPerformanceMetric = { toolId: string; operation: string; durationMs: number; workerDurationMs?: number; decodeDurationMs?: number; encodeDurationMs?: number; route: string; timestamp: string };
export type RuntimePerformanceDiagnostic = { kind: 'navigation' | 'longtask' | 'memory'; route: string; timestamp: string; durationMs?: number; domContentLoadedMs?: number; loadEventMs?: number; jsHeapUsedBytes?: number; jsHeapLimitBytes?: number };
type PerformanceEntryRecord = CoreWebVitalsSnapshot | ToolPerformanceMetric | RuntimePerformanceDiagnostic;

const STORAGE_KEY = 'flixo:performance-diagnostics';
const MAX_ENTRIES = 50;
const finite = z.number().finite().nonnegative();
const performanceEntrySchema = z.object({
  kind: z.enum(['navigation', 'longtask', 'memory']).optional(),
  toolId: z.string().max(128).optional(),
  operation: z.string().max(128).optional(),
  durationMs: finite.optional(), workerDurationMs: finite.optional(), decodeDurationMs: finite.optional(), encodeDurationMs: finite.optional(),
  lcp: finite.optional(), inp: finite.optional(), cls: finite.optional(),
  route: z.string(), locale: z.string().max(32).optional(), timestamp: z.string(),
  domContentLoadedMs: finite.optional(), loadEventMs: finite.optional(), jsHeapUsedBytes: finite.optional(), jsHeapLimitBytes: finite.optional(),
}).strict();
const performanceEntriesSchema = z.array(performanceEntrySchema).max(MAX_ENTRIES);

function parsePersisted(raw: string | null): PerformanceEntryRecord[] {
  if (!raw) return [];
  const parsed = performanceEntriesSchema.safeParse(JSON.parse(raw));
  if (parsed.success) return parsed.data as PerformanceEntryRecord[];
  console.error('[performance-diagnostics] rejected persisted state', parsed.error.flatten());
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* restricted storage */ }
  return [];
}
function save(entry: PerformanceEntryRecord): void {
  try {
    const current = parsePersisted(localStorage.getItem(STORAGE_KEY));
    current.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current.slice(-MAX_ENTRIES)));
  } catch (error) { console.error('[performance-diagnostics] persistence failed', error); }
}
export function recordToolPerformance(metric: Omit<ToolPerformanceMetric, 'route' | 'timestamp'>): void {
  save({ ...metric, route: `${window.location.pathname}${window.location.search}`, timestamp: new Date().toISOString() });
}

export function installCoreWebVitalsDiagnostics(): () => void {
  let lcp: number | undefined; let inp: number | undefined; let cls = 0; let clsSources = 0;
  const observers: PerformanceObserver[] = [];
  if (typeof PerformanceObserver === 'undefined') return () => undefined;
  try { const observer = new PerformanceObserver((list) => { const last = list.getEntries().at(-1); if (last) lcp = last.startTime; }); observer.observe({ type: 'largest-contentful-paint', buffered: true }); observers.push(observer); } catch { /* unsupported */ }
  try { const observer = new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (entry.duration > (inp ?? 0)) inp = entry.duration; }); observer.observe({ type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit); observers.push(observer); } catch { /* unsupported */ }
  try { const observer = new PerformanceObserver((list) => { for (const entry of list.getEntries()) { const layoutShift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean }; if (layoutShift.hadRecentInput) continue; cls += layoutShift.value ?? 0; clsSources += 1; } }); observer.observe({ type: 'layout-shift', buffered: true }); observers.push(observer); } catch { /* unsupported */ }
  const flush = () => {
    if (lcp === undefined && inp === undefined && clsSources === 0) return;
    save({ lcp, inp, cls, route: `${window.location.pathname}${window.location.search}`, locale: document.documentElement.lang || undefined, timestamp: new Date().toISOString() });
  };
  window.addEventListener('pagehide', flush, { once: true });
  return () => { for (const observer of observers) observer.disconnect(); window.removeEventListener('pagehide', flush); };
}
function route(): string { return `${window.location.pathname}${window.location.search}`; }
function recordNavigation(): void { const navigation = performance.getEntriesByType('navigation')[0]; if (!navigation) return; const entry = navigation as PerformanceNavigationTiming; save({ kind: 'navigation', route: route(), timestamp: new Date().toISOString(), domContentLoadedMs: Math.round(entry.domContentLoadedEventEnd), loadEventMs: Math.round(entry.loadEventEnd) }); }
function recordMemory(): void { const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory; if (!memory) return; save({ kind: 'memory', route: route(), timestamp: new Date().toISOString(), jsHeapUsedBytes: memory.usedJSHeapSize, jsHeapLimitBytes: memory.jsHeapSizeLimit }); }
export function installPerformanceDiagnostics(): () => void {
  const observers: PerformanceObserver[] = [];
  if (typeof PerformanceObserver !== 'undefined') { try { const observer = new PerformanceObserver((list) => { for (const entry of list.getEntries()) save({ kind: 'longtask', route: route(), timestamp: new Date().toISOString(), durationMs: Math.round(entry.duration) }); }); observer.observe({ type: 'longtask', buffered: true }); observers.push(observer); } catch { /* unsupported */ } }
  window.addEventListener('load', recordNavigation, { once: true });
  const memoryTimer = window.setTimeout(recordMemory, 0);
  return () => { window.removeEventListener('load', recordNavigation); window.clearTimeout(memoryTimer); for (const observer of observers) observer.disconnect(); };
}
export function getPerformanceDiagnostics(): PerformanceEntryRecord[] { try { return parsePersisted(localStorage.getItem(STORAGE_KEY)); } catch (error) { console.error('[performance-diagnostics] read failed', error); return []; } }
export function clearPerformanceDiagnostics(): void { try { localStorage.removeItem(STORAGE_KEY); } catch (error) { console.error('[performance-diagnostics] clear failed', error); } }
