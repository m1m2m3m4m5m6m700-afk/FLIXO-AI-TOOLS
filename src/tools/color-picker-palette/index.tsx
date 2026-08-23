import React, { useMemo, useState } from 'react';
import { contrastRatio, hexToRgb, palette, relativeLuminance, rgbToHsl, rgbToHex, tailwindToken } from './engine';

export function ColorPickerPaletteTool() {
  const [hex, setHex] = useState('#6366F1');
  const [background, setBackground] = useState('#FFFFFF');
  const [error, setError] = useState('');
  const colorState = useMemo(() => { try { return { rgb: hexToRgb(hex), error: '' }; } catch { return { rgb: null, error: 'Invalid HEX color' }; } }, [hex]);
  const bg = useMemo(() => { try { return hexToRgb(background); } catch { return null; } }, [background]);
  const rgb = colorState.rgb;
  const hsl = rgb ? rgbToHsl(rgb) : null;
  const colors = rgb ? palette(rgb, 7) : [];
  const contrast = rgb && bg ? contrastRatio(rgb, bg) : 0;
  const wcagAA = contrast >= 4.5;
  const wcagLarge = contrast >= 3;

  const applyHex = (value: string) => { setHex(value); try { hexToRgb(value); setError(''); } catch { setError('Invalid HEX color'); } };
  const copy = async (value: string) => navigator.clipboard.writeText(value);
  const eyedropper = async () => {
    const Picker = (window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!Picker) { setError('EyeDropper is not supported by this browser'); return; }
    try { const result = await new Picker().open(); applyHex(result.sRGBHex); } catch { /* user cancelled */ }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header><h1 className="text-3xl font-bold">Color Picker &amp; Palette Generator</h1><p className="mt-2 opacity-80">HEX, RGB, HSL, palette generation, EyeDropper, and WCAG contrast locally.</p></header>
      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-3"><input aria-label="Color" type="color" value={rgb ? rgbToHex(rgb) : '#000000'} onChange={(event) => applyHex(event.target.value)} /><input aria-label="HEX" value={hex} onChange={(event) => applyHex(event.target.value)} className="rounded border p-2 font-mono" /><button type="button" onClick={() => void eyedropper()}>EyeDropper</button></div>
          {(error || colorState.error) && <p role="alert">{error || colorState.error}</p>}
          {rgb && <div className="rounded p-6" style={{ backgroundColor: rgbToHex(rgb) }} aria-label="color-preview" />}
          {rgb && <div className="space-y-1 font-mono text-sm"><div>HEX: {rgbToHex(rgb)}</div><div>RGB: {rgb.r}, {rgb.g}, {rgb.b}</div><div>HSL: {hsl?.h.toFixed(1)}°, {hsl?.s.toFixed(1)}%, {hsl?.l.toFixed(1)}%</div></div>}
        </div>
        <div className="space-y-4"><label className="block font-semibold">Background for WCAG<input aria-label="Background" className="ml-3 rounded border p-2 font-mono" value={background} onChange={(event) => setBackground(event.target.value)} /></label><div className="rounded border p-4"><div>Contrast: {contrast.toFixed(2)}:1</div><div>WCAG AA normal text: {wcagAA ? 'PASS' : 'FAIL'}</div><div>WCAG large text: {wcagLarge ? 'PASS' : 'FAIL'}</div></div></div>
      </section>
      <section><h2 className="mb-3 text-xl font-semibold">Palette</h2><div className="grid grid-cols-7 gap-2">{colors.map((color) => <button type="button" key={color} aria-label={color} title={color} className="h-20 rounded border" style={{ backgroundColor: color }} onClick={() => void copy(color)} />)}</div></section>
      {rgb && <section className="flex gap-2"><button type="button" onClick={() => void copy(rgbToHex(rgb))}>Copy HEX</button><button type="button" onClick={() => void copy(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`)}>Copy RGB</button><button type="button" onClick={() => void copy(tailwindToken(rgbToHex(rgb)))}>Copy Tailwind</button><span className="sr-only">Luminance {relativeLuminance(rgb).toFixed(4)}</span></section>}
    </main>
  );
}
