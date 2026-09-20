type ToolPerformanceMetric = {
  toolId: string;
  operation: string;
  durationMs: number;
  workerDurationMs?: number;
  decodeDurationMs?: number;
  encodeDurationMs?: number;
};

const STORAGE_KEY = 'flixo:performance-diagnostics';
const MAX_ENTRIES = 50;

export function recordToolPerformance(metric: ToolPerformanceMetric): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const current = raw ? (JSON.parse(raw) as unknown[]) : [];
    current.push({
      ...metric,
      route: `${window.location.pathname}${window.location.search}`,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current.slice(-MAX_ENTRIES)));
  } catch {
    // Performance diagnostics must never affect the application.
  }
}
