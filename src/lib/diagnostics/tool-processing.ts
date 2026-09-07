export type ToolProcessingTiming = {
  toolId: string;
  operation: string;
  totalDurationMs: number;
  workerDurationMs?: number;
  decodeDurationMs?: number;
  transformDurationMs?: number;
  encodeDurationMs?: number;
};

type TimingMark = ReturnType<Performance['now']>;

export function startToolProcessingTimer(): TimingMark {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export function elapsedToolProcessingMs(start: TimingMark): number {
  const now = typeof performance === 'undefined' ? Date.now() : performance.now();
  return Math.max(0, now - start);
}
