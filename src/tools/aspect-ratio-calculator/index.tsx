import React, { useMemo, useState } from 'react';
import { calculateHeight, calculateWidth, parseRatio, RATIO_PRESETS, simplifyRatio } from './engine';

export function AspectRatioCalculatorTool() {
  const [ratioText, setRatioText] = useState('16:9');
  const [width, setWidth] = useState('1920');
  const [height, setHeight] = useState('');
  const [lastEdited, setLastEdited] = useState<'width' | 'height'>('width');

  const ratio = useMemo(() => parseRatio(ratioText), [ratioText]);
  const invalid = !ratio;

  const computed = useMemo(() => {
    if (!ratio) return { width: null, height: null };
    if (lastEdited === 'width') {
      const numericWidth = Number(width);
      return { width: numericWidth > 0 ? numericWidth : null, height: calculateHeight(numericWidth, ratio) };
    }
    const numericHeight = Number(height);
    return { width: calculateWidth(numericHeight, ratio), height: numericHeight > 0 ? numericHeight : null };
  }, [height, lastEdited, ratio, width]);

  const simplified = ratio ? simplifyRatio(ratio.width, ratio.height) : null;
  const previewWidth = computed.width ?? 1;
  const previewHeight = computed.height ?? 1;
  const previewRatio = Math.min(320 / previewWidth, 220 / previewHeight);

  const applyPreset = (preset: (typeof RATIO_PRESETS)[number]) => {
    setRatioText(preset.label);
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6" aria-label="Aspect Ratio Calculator">
      <header>
        <h1 className="text-3xl font-semibold">Aspect Ratio Calculator</h1>
        <p className="mt-2 text-sm opacity-80">Calculate proportional dimensions locally in your browser.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span>Aspect ratio</span>
          <input aria-label="Aspect ratio" value={ratioText} onChange={(event) => setRatioText(event.target.value)} className="rounded border p-2" inputMode="decimal" />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Ratio presets">
          {RATIO_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => applyPreset(preset)} className="rounded border px-3 py-2">
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span>Width</span>
          <input aria-label="Width" value={lastEdited === 'width' ? width : String(computed.width ?? '')} onChange={(event) => { setWidth(event.target.value); setLastEdited('width'); }} className="rounded border p-2" inputMode="decimal" />
        </label>
        <label className="flex flex-col gap-2">
          <span>Height</span>
          <input aria-label="Height" value={lastEdited === 'height' ? height : String(computed.height ?? '')} onChange={(event) => { setHeight(event.target.value); setLastEdited('height'); }} className="rounded border p-2" inputMode="decimal" />
        </label>
      </section>

      {invalid ? <p role="alert" className="text-sm">Enter a valid ratio such as 16:9.</p> : null}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded border p-4">
          <h2 className="font-medium">Calculated dimensions</h2>
          <p aria-label="Calculated width">Width: {computed.width == null ? '—' : Math.round(computed.width)}</p>
          <p aria-label="Calculated height">Height: {computed.height == null ? '—' : Math.round(computed.height)}</p>
          <p aria-label="Simplified ratio">Ratio: {simplified ? `${simplified.width}:${simplified.height}` : '—'}</p>
        </div>
        <div className="flex min-h-56 items-center justify-center rounded border p-4" aria-label="Aspect preview">
          <div className="rounded border bg-black/10" style={{ width: Math.max(20, previewWidth * previewRatio), height: Math.max(20, previewHeight * previewRatio) }} />
        </div>
      </section>
    </main>
  );
}
