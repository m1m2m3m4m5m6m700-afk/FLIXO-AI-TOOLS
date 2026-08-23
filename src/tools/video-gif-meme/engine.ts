export type GifOptions = { start: number; end: number; fps: number; width: number; topText: string; bottomText: string };

export function clampGifRange(start: number, end: number, duration: number) {
  const safeDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const safeStart = Math.min(Math.max(0, Number.isFinite(start) ? start : 0), safeDuration);
  const safeEnd = Math.min(Math.max(safeStart, Number.isFinite(end) ? end : safeDuration), safeDuration);
  return { start: safeStart, end: safeEnd };
}

export function normalizeFps(fps: number) { return Number.isFinite(fps) ? Math.min(15, Math.max(2, Math.round(fps))) : 8; }
export function normalizeWidth(width: number) { return Number.isFinite(width) ? Math.min(720, Math.max(160, Math.round(width))) : 480; }

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) line = candidate;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawMemeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  if (!text.trim()) return;
  ctx.save(); ctx.font = 'bold 32px Impact, Arial Black, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 8;
  wrapText(ctx, text, maxWidth).forEach((line, i) => { const yy = y + i * 38; ctx.strokeText(line, x, yy, maxWidth); ctx.fillText(line, x, yy, maxWidth); });
  ctx.restore();
}
