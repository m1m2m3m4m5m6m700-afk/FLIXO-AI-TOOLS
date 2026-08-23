export type CaptionSegment = { start: number; end: number; text: string };

export function clampCaptionDuration(duration: number) {
  return Number.isFinite(duration) ? Math.max(0, Math.min(600, duration)) : 0;
}

export function formatTimestamp(seconds: number, separator = ',') {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const millis = Math.floor((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}${separator}${String(millis).padStart(3, '0')}`;
}

export function normalizeSegments(value: unknown): CaptionSegment[] {
  if (!Array.isArray(value)) return [];
  return value.map((segment) => {
    const item = segment as { timestamp?: [number, number]; text?: string };
    const start = Number(item.timestamp?.[0]);
    const end = Number(item.timestamp?.[1]);
    return {
      start: Number.isFinite(start) && start >= 0 ? start : 0,
      end: Number.isFinite(end) && end > start ? end : Math.max(0.5, start + 0.5),
      text: typeof item.text === 'string' ? item.text.trim() : '',
    };
  }).filter((segment) => segment.text.length > 0);
}

export function segmentsToSrt(segments: CaptionSegment[]) {
  return segments.map((segment, index) => `${index + 1}\n${formatTimestamp(segment.start)} --> ${formatTimestamp(segment.end)}\n${segment.text}\n`).join('\n');
}

export function segmentsToVtt(segments: CaptionSegment[]) {
  return `WEBVTT\n\n${segments.map((segment) => `${formatTimestamp(segment.start, '.')} --> ${formatTimestamp(segment.end, '.')}\n${segment.text}\n`).join('\n')}`;
}

export function makeCaptionFilename(name: string, extension: 'srt' | 'vtt') {
  const base = name.replace(/\.[^/.]+$/, '') || 'flixo-caption';
  return `${base}.${extension}`;
}
