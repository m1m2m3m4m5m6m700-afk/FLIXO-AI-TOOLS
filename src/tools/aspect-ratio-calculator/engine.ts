export type Ratio = { width: number; height: number };

export function parseRatio(value: string): Ratio | null {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : null;
}

export function simplifyRatio(width: number, height: number): Ratio | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const a = Math.round(width * 1000000);
  const b = Math.round(height * 1000000);
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return { width: a / x, height: b / x };
}

export function calculateHeight(width: number, ratio: Ratio): number | null {
  return Number.isFinite(width) && width > 0 ? width * (ratio.height / ratio.width) : null;
}

export function calculateWidth(height: number, ratio: Ratio): number | null {
  return Number.isFinite(height) && height > 0 ? height * (ratio.width / ratio.height) : null;
}

export const RATIO_PRESETS = [
  { id: '16-9', label: '16:9', width: 16, height: 9 },
  { id: '4-3', label: '4:3', width: 4, height: 3 },
  { id: '21-9', label: '21:9', width: 21, height: 9 },
  { id: '1-1', label: '1:1', width: 1, height: 1 },
  { id: '9-16', label: '9:16', width: 9, height: 16 },
] as const;
