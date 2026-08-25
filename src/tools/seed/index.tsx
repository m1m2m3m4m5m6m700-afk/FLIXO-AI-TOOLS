import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import {
  Activity, Aperture, Blend, Contrast, Download, Droplets, Eraser, Focus, Gauge, Highlighter,
  ImagePlus, Layers2, MoveHorizontal, MoveVertical, Redo2, RotateCcw, Scan, SlidersHorizontal,
  Sparkles, Sun, Thermometer, Undo2, Upload, WandSparkles, Zap,
} from 'lucide-react';
import fragmentSource from './glsl/fragment.glsl?raw';
import { SeedGLEngine, type SeedRenderSettings } from './webgl-engine';
import { DEFAULT_ADVANCED, renderAdvanced, type AdvancedSeedSettings } from './advanced-engine';
import { CurveMiniPreview, NumericField, SectionReset, StudioSlider, ToolSection } from './studio-controls';

export interface SeedState extends SeedRenderSettings {
  blurRadius: number;
  crop: { x: number; y: number; width: number; height: number } | null;
}

type Snapshot = { basic: SeedState; advanced: AdvancedSeedSettings };

const DEFAULT_STATE: SeedState = {
  brightness: 0, contrast: 0, saturation: 0, warmth: 0,
  ambiance: 0, highlights: 0, shadows: 0, blurRadius: 0, crop: null,
};

const cloneAdvanced = (value: AdvancedSeedSettings): AdvancedSeedSettings => ({
  ...value,
  curves: value.curves.map((point) => ({ ...point })),
  brush: value.brush.map((stroke) => ({ ...stroke })),
});

const cloneSnapshot = (snapshot: Snapshot): Snapshot => ({ basic: { ...snapshot.basic }, advanced: cloneAdvanced(snapshot.advanced) });

function pushHistory(next: Snapshot, history: Snapshot[], index: number) {
  const last = history[index];
  const serialized = JSON.stringify({ basic: next.basic, advanced: { ...next.advanced, doubleExposure: null } });
  const lastSerialized = last ? JSON.stringify({ basic: last.basic, advanced: { ...last.advanced, doubleExposure: null } }) : '';
  if (serialized === lastSerialized) return { history, index };
  const nextHistory = history.slice(0, index + 1).map(cloneSnapshot);
  nextHistory.push(cloneSnapshot(next));
  return { history: nextHistory, index: nextHistory.length - 1 };
}

export default function SeedTool() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const engineRef = useRef<SeedGLEngine | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const doubleExposureUrlRef = useRef<string | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageName, setImageName] = useState('');
  const [settings, setSettings] = useState<SeedState>(DEFAULT_STATE);
  const [advanced, setAdvanced] = useState<AdvancedSeedSettings>(DEFAULT_ADVANCED);
  const [history, setHistory] = useState<Snapshot[]>([{ basic: DEFAULT_STATE, advanced: DEFAULT_ADVANCED }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [error, setError] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(['basic', 'fx', 'geometry', 'retouch']);

  const scheduleRender = useCallback(() => {
    if (!engineRef.current || !image) return;
    if (renderFrameRef.current !== null) cancelAnimationFrame(renderFrameRef.current);
    setIsRendering(true);
    renderFrameRef.current = requestAnimationFrame(() => {
      renderFrameRef.current = null;
      try { engineRef.current?.render(settings); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'GPU rendering failed.'); }
      finally { setIsRendering(false); }
    });
  }, [image, settings]);

  useEffect(() => {
    if (!canvasRef.current || !image) return;
    try {
      engineRef.current?.destroy();
      const engine = new SeedGLEngine(canvasRef.current, fragmentSource);
      canvasRef.current.width = image.naturalWidth;
      canvasRef.current.height = image.naturalHeight;
      engine.setImage(image);
      engineRef.current = engine;
    } catch (cause) {
      engineRef.current?.destroy(); engineRef.current = null;
      const message = cause instanceof Error ? cause.message : 'Unable to start GPU rendering.';
      queueMicrotask(() => setError(message));
    }
    return () => {
      if (renderFrameRef.current !== null) cancelAnimationFrame(renderFrameRef.current);
      engineRef.current?.destroy(); engineRef.current = null;
    };
  }, [image]);

  useEffect(() => { scheduleRender(); }, [scheduleRender]);

  useEffect(() => () => {
    if (renderFrameRef.current !== null) cancelAnimationFrame(renderFrameRef.current);
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    if (doubleExposureUrlRef.current) URL.revokeObjectURL(doubleExposureUrlRef.current);
  }, []);

  const commit = (nextBasic: SeedState, nextAdvanced: AdvancedSeedSettings) => {
    const next = { basic: nextBasic, advanced: nextAdvanced };
    const result = pushHistory(next, history, historyIndex);
    setSettings(nextBasic); setAdvanced(nextAdvanced); setHistory(result.history); setHistoryIndex(result.index);
  };

  const updateSetting = <K extends keyof SeedState>(key: K, value: SeedState[K]) => commit({ ...settings, [key]: value }, advanced);
  const updateAdvanced = <K extends keyof AdvancedSeedSettings>(key: K, value: AdvancedSeedSettings[K]) => commit(settings, { ...advanced, [key]: value });

  const undo = () => {
    if (historyIndex === 0) return;
    const next = cloneSnapshot(history[historyIndex - 1]);
    setHistoryIndex(historyIndex - 1); setSettings(next.basic); setAdvanced(next.advanced);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const next = cloneSnapshot(history[historyIndex + 1]);
    setHistoryIndex(historyIndex + 1); setSettings(next.basic); setAdvanced(next.advanced);
  };

  const openImage = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Drop a supported image file.'); return; }
    const url = URL.createObjectURL(file);
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      setImage(img); setImageName(file.name); setSettings(DEFAULT_STATE); setAdvanced(cloneAdvanced(DEFAULT_ADVANCED));
      setHistory([{ basic: DEFAULT_STATE, advanced: cloneAdvanced(DEFAULT_ADVANCED) }]); setHistoryIndex(0); setError('');
    };
    img.onerror = () => setError('Unable to decode this image.');
    img.src = url;
  };

  const openDoubleExposure = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Choose an image for the exposure layer.'); return; }
    const url = URL.createObjectURL(file);
    if (doubleExposureUrlRef.current) URL.revokeObjectURL(doubleExposureUrlRef.current);
    doubleExposureUrlRef.current = url;
    const layer = new Image();
    layer.onload = () => updateAdvanced('doubleExposure', layer);
    layer.onerror = () => setError('Unable to decode the exposure layer.');
    layer.src = url;
  };

  const addBrushPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!image || advanced.brushStrength === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * image.naturalWidth;
    const y = ((event.clientY - rect.top) / rect.height) * image.naturalHeight;
    const brushRadius = Math.max(12, image.naturalWidth / 30);
    updateAdvanced('brush', [...advanced.brush, { x, y, radius: brushRadius, opacity: 0.8 }]);
  };

  const resetAll = () => commit({ ...DEFAULT_STATE }, cloneAdvanced(DEFAULT_ADVANCED));
  const resetBasic = () => commit({ ...DEFAULT_STATE, blurRadius: settings.blurRadius, crop: settings.crop }, advanced);
  const resetFx = () => commit(settings, { ...advanced, curves: DEFAULT_ADVANCED.curves.map((point) => ({ ...point })), lensBlur: 0, bokeh: 0, doubleExposureOpacity: 0, doubleExposureBlend: DEFAULT_ADVANCED.doubleExposureBlend });
  const resetGeometry = () => commit(settings, { ...advanced, perspectiveX: 0, perspectiveY: 0 });
  const resetRetouch = () => commit(settings, { ...advanced, brush: [], brushStrength: 0, heal: null });

  const exportImage = async () => {
    if (!image) return;
    try {
      setError('');
      const output = document.createElement('canvas');
      output.width = image.naturalWidth; output.height = image.naturalHeight;
      const ctx = output.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Unable to create export context.');
      ctx.drawImage(image, 0, 0);
      const filterParts = [
        `brightness(${100 + settings.brightness}%)`,
        `contrast(${100 + settings.contrast}%)`,
        `saturate(${100 + settings.saturation}%)`,
        settings.blurRadius > 0 ? `blur(${settings.blurRadius}px)` : '',
      ].filter(Boolean);
      if (filterParts.length) {
        const source = document.createElement('canvas'); source.width = output.width; source.height = output.height;
        const sctx = source.getContext('2d'); if (!sctx) throw new Error('Unable to create export staging canvas.');
        sctx.filter = filterParts.join(' '); sctx.drawImage(output, 0, 0);
        ctx.clearRect(0, 0, output.width, output.height); ctx.drawImage(source, 0, 0);
      }
      if (settings.warmth !== 0) { ctx.save(); ctx.globalAlpha = Math.abs(settings.warmth) / 400; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = settings.warmth > 0 ? '#ffa500' : '#0096ff'; ctx.fillRect(0, 0, output.width, output.height); ctx.restore(); }
      renderAdvanced(ctx, advanced);
      const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/png'));
      if (!blob || blob.size < 32) throw new Error('Export produced an invalid image.');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'seed-edited.png';
      document.body.appendChild(anchor);
      anchor.click();
      // WebKit can dispatch the download asynchronously; keep the object URL alive briefly.
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        anchor.remove();
      }, 1000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to export the image.'); }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setIsDragging(false);
    const file = event.dataTransfer.files?.[0]; if (file) openImage(file);
  };
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) setIsDragging(false);
  };

  const basicActive = ['brightness', 'contrast', 'saturation', 'warmth', 'ambiance', 'highlights', 'shadows'].filter((key) => settings[key as keyof SeedState] !== 0).length;
  const curveStrength = Math.round((advanced.curves[2].y - 0.5) * 200);
  const fxActive = [advanced.lensBlur, advanced.bokeh, advanced.doubleExposureOpacity, settings.blurRadius, curveStrength].filter(Boolean).length + (advanced.doubleExposure ? 1 : 0);
  const geometryActive = [advanced.perspectiveX, advanced.perspectiveY].filter(Boolean).length;
  const retouchActive = [advanced.brushStrength, advanced.heal ? 1 : 0, advanced.brush.length ? 1 : 0].filter(Boolean).length;
  const gpuReady = Boolean(engineRef.current && image);
  const heal = advanced.heal ?? { x: 0, y: 0, width: 32, height: 32 };
  const blendModes: GlobalCompositeOperation[] = ['screen', 'overlay', 'soft-light', 'multiply'];

  return (
    <div className="mx-auto flex min-h-[760px] w-full max-w-[1500px] flex-col gap-3 p-2 sm:p-3 lg:p-4">
      <input ref={imageInputRef} id="seed-main-image-input" type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) openImage(file); event.currentTarget.value = ''; }} />

      <header className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-zinc-950/85 px-3 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-indigo-300/10 bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-cyan-400/10 text-indigo-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"><WandSparkles className="size-5" /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2"><h1 className="text-sm font-semibold tracking-tight text-white">Seed</h1><span className="hidden rounded border border-white/[0.06] bg-white/[0.025] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-500 sm:inline">GPU COLOR ENGINE</span></div>
            <div className="mt-1 flex min-w-0 items-center gap-2 text-[10px] text-zinc-500"><Activity className={`size-3 ${gpuReady ? 'text-emerald-400' : 'text-zinc-600'}`} /><span>{image ? imageName : 'No asset loaded'}</span>{image ? <span className="font-mono text-zinc-700">{image.naturalWidth}×{image.naturalHeight}</span> : null}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          <div className="mr-1 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-zinc-900/80 px-2.5 py-2 text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-500"><span className={`size-1.5 rounded-full ${gpuReady ? 'bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,0.8)]' : 'bg-zinc-700'}`} /><span>{isRendering ? 'Rendering' : gpuReady ? 'WebGL Ready' : 'Waiting'}</span></div>
          <button type="button" onClick={() => undo()} disabled={historyIndex === 0} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-900/80 px-2.5 text-xs text-zinc-400 transition hover:border-white/[0.1] hover:text-white disabled:opacity-30" aria-label="Undo"><Undo2 className="size-3.5" /><span className="hidden md:inline">Undo</span></button>
          <button type="button" onClick={() => redo()} disabled={historyIndex >= history.length - 1} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-900/80 px-2.5 text-xs text-zinc-400 transition hover:border-white/[0.1] hover:text-white disabled:opacity-30" aria-label="Redo"><Redo2 className="size-3.5" /><span className="hidden md:inline">Redo</span></button>
          <button type="button" onClick={resetAll} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-900/80 px-2.5 text-xs text-zinc-400 transition hover:border-white/[0.1] hover:text-white" aria-label="Reset all controls"><RotateCcw className="size-3.5" /><span className="hidden md:inline">Reset</span></button>
          <button type="button" onClick={exportImage} disabled={!image} className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-300/20 bg-indigo-500 px-3 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(99,102,241,0.28)] transition hover:bg-indigo-400 disabled:opacity-40" aria-label="Export PNG"><Download className="size-3.5" />Export PNG</button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className={`relative flex min-h-[560px] min-w-0 items-center justify-center overflow-hidden rounded-2xl border bg-zinc-950 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.24)] transition ${isDragging ? 'border-indigo-400/70 bg-indigo-950/10' : 'border-white/[0.07]'}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.028) 1px, transparent 0), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/[0.035] to-transparent" />
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-black/40 px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500 backdrop-blur-md"><Scan className="size-3 text-zinc-600" />Canvas / Linear Preview</div>
          {image ? (
            <canvas ref={canvasRef} onPointerDown={addBrushPoint} className={`relative z-10 max-h-[78vh] max-w-full touch-none object-contain rounded-md shadow-[0_25px_80px_rgba(0,0,0,0.55)] ${advanced.brushStrength !== 0 ? 'cursor-crosshair' : 'cursor-default'}`} aria-label="Seed preview" />
          ) : (
            <div onClick={() => imageInputRef.current?.click()} className={`relative z-10 flex w-full max-w-lg cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center transition ${isDragging ? 'border-indigo-400/70 bg-indigo-500/10' : 'border-white/[0.1] bg-black/20 hover:border-white/[0.16] hover:bg-white/[0.025]'}`}>
              <span className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-indigo-300/10 bg-gradient-to-br from-indigo-500/15 to-cyan-400/5 text-indigo-200"><ImagePlus className="size-7" /></span>
              <span className="text-sm font-semibold text-zinc-100">Drop an image into Seed</span>
              <span className="mt-2 max-w-sm text-xs leading-5 text-zinc-500">GPU preview, non-destructive history, technical controls and PNG export.</span>
              <span className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-xs text-zinc-300"><Upload className="size-3.5" />Browse files</span>
            </div>
          )}
          {image && <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-black/40 px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500 backdrop-blur-md"><Gauge className="size-3 text-zinc-600" /><span>Fit</span><span className="text-zinc-700">•</span><span>{image.naturalWidth}×{image.naturalHeight}</span></div>{advanced.brushStrength !== 0 ? <div className="flex items-center gap-2 rounded-lg border border-cyan-300/10 bg-cyan-400/5 px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-200 backdrop-blur-md"><Sparkles className="size-3" />Brush active · click preview</div> : null}</div>}
          {isRendering && image ? <span className="absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-lg border border-indigo-300/10 bg-indigo-500/10 px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-indigo-200 backdrop-blur-md"><Zap className="size-3" />GPU Render</span> : null}
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-zinc-950/90 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="shrink-0 border-b border-white/[0.06] bg-zinc-950/95 px-3.5 py-3.5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="flex size-8 items-center justify-center rounded-lg border border-white/[0.07] bg-zinc-900 text-zinc-300"><SlidersHorizontal className="size-4" /></span><div><div className="text-[12px] font-semibold text-zinc-100">Control Matrix</div><div className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-600">Non-destructive parameter graph</div></div></div><button type="button" onClick={() => imageInputRef.current?.click()} className="inline-flex size-8 items-center justify-center rounded-lg border border-white/[0.06] bg-zinc-900 text-zinc-500 transition hover:border-white/[0.11] hover:text-white" aria-label="Replace image"><Upload className="size-3.5" /></button></div></div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2.5" style={{ scrollbarColor: '#3f3f46 transparent', scrollbarWidth: 'thin' }}>
            <Accordion.Root type="multiple" value={openSections} onValueChange={setOpenSections} className="space-y-2">
              <ToolSection value="basic" title="Light & Color" subtitle="Core tonal response and chromatic balance" icon={Sun} activeCount={basicActive}>
                <StudioSlider label="Brightness" code="LUMA" icon={Sun} value={settings.brightness} defaultValue={0} min={-100} max={100} description="Global luminance offset" onChange={(value) => updateSetting('brightness', value)} />
                <StudioSlider label="Contrast" code="CTR" icon={Contrast} value={settings.contrast} defaultValue={0} min={-100} max={100} description="Expand or compress tonal separation" onChange={(value) => updateSetting('contrast', value)} />
                <StudioSlider label="Saturation" code="SAT" icon={Droplets} value={settings.saturation} defaultValue={0} min={-100} max={100} description="Global chroma density" onChange={(value) => updateSetting('saturation', value)} />
                <StudioSlider label="Warmth" code="WB" icon={Thermometer} value={settings.warmth} defaultValue={0} min={-100} max={100} description="Shift white balance toward warm or cool" onChange={(value) => updateSetting('warmth', value)} />
                <StudioSlider label="Ambiance" code="AMB" icon={Sparkles} value={settings.ambiance} defaultValue={0} min={-100} max={100} description="Atmospheric lift for the global image" onChange={(value) => updateSetting('ambiance', value)} />
                <StudioSlider label="Highlights" code="HI" icon={Highlighter} value={settings.highlights} defaultValue={0} min={-100} max={100} description="Recover or accent bright regions" onChange={(value) => updateSetting('highlights', value)} />
                <StudioSlider label="Shadows" code="SH" icon={Layers2} value={settings.shadows} defaultValue={0} min={-100} max={100} description="Open or deepen dark regions" onChange={(value) => updateSetting('shadows', value)} />
                <div className="flex justify-end pt-1"><SectionReset onClick={resetBasic} /></div>
              </ToolSection>

              <ToolSection value="fx" title="FX & Focus" subtitle="Blur, bokeh, curves and exposure compositing" icon={Aperture} activeCount={fxActive}>
                <StudioSlider label="Global Blur" code="BLR" icon={Aperture} value={settings.blurRadius} defaultValue={0} min={0} max={40} description="Fast preview blur before advanced pass" unit="px" onChange={(value) => updateSetting('blurRadius', value)} />
                <StudioSlider label="Lens Blur" code="LENS" icon={Focus} value={advanced.lensBlur} defaultValue={0} min={0} max={40} description="Depth-inspired blur radius" unit="px" onChange={(value) => updateAdvanced('lensBlur', value)} />
                <StudioSlider label="Bokeh / Focus Shift" code="FOCUS" icon={Focus} value={advanced.bokeh} defaultValue={0} min={-100} max={100} description="Move the sharp focal band vertically" onChange={(value) => updateAdvanced('bokeh', value)} />
                <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="flex items-start justify-between gap-2"><div><div className="text-[13px] font-medium text-zinc-100">Curves</div><div className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-600">LUT • RGB master</div></div><span className="rounded-md border border-indigo-400/20 bg-indigo-500/10 px-2 py-1 font-mono text-[11px] text-indigo-200">{curveStrength > 0 ? '+' : ''}{curveStrength}</span></div><CurveMiniPreview y={curveStrength / 200} /><StudioSlider label="Curves Strength" code="LUT" icon={Sparkles} value={curveStrength} defaultValue={0} min={-100} max={100} description="Lift or compress the master midtone curve" onChange={(value) => { const v = value / 200; updateAdvanced('curves', [{ x: 0, y: 0 }, { x: 0.25, y: Math.max(0, 0.25 + v) }, { x: 0.5, y: Math.max(0, Math.min(1, 0.5 + v)) }, { x: 0.75, y: Math.max(0, Math.min(1, 0.75 + v)) }, { x: 1, y: 1 }]); }} /></div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg border border-white/[0.07] bg-zinc-950 text-zinc-400"><Layers2 className="size-4" /></span><div><div className="text-[12px] font-medium text-zinc-100">Double Exposure</div><div className="text-[10px] text-zinc-500">Secondary layer / blend pipeline</div></div></div></div><input type="file" accept="image/*" aria-label="Double Exposure file" onChange={(event) => { const file = event.target.files?.[0]; if (file) openDoubleExposure(file); event.currentTarget.value = ''; }} className="mt-3 block w-full cursor-pointer rounded-lg border border-white/[0.08] bg-zinc-950 px-2 py-2 text-[9px] text-zinc-400 file:mr-2 file:rounded-md file:border-0 file:bg-indigo-500/15 file:px-2 file:py-1 file:text-[9px] file:font-medium file:text-indigo-200" /><div className="mt-3 rounded-lg border border-dashed border-white/[0.07] bg-zinc-950/60 px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-600">{advanced.doubleExposure ? 'Layer loaded • compositing enabled' : 'No exposure layer loaded'}</div><div className="mt-2"><StudioSlider label="Exposure Opacity" code="A" icon={Blend} value={advanced.doubleExposureOpacity} defaultValue={0} min={0} max={100} description="Alpha contribution of exposure layer" unit="%" onChange={(value) => updateAdvanced('doubleExposureOpacity', value)} /></div><div className="mt-2"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">Blend Mode</span><span className="font-mono text-[10px] text-zinc-600">{advanced.doubleExposureBlend}</span></div><div className="grid grid-cols-4 gap-1.5">{blendModes.map((mode) => <button key={mode} type="button" onClick={() => updateAdvanced('doubleExposureBlend', mode)} className={`rounded-md border px-2 py-2 text-[9px] font-medium capitalize transition ${advanced.doubleExposureBlend === mode ? 'border-indigo-400/25 bg-indigo-500/10 text-indigo-200' : 'border-white/[0.06] bg-zinc-950 text-zinc-500 hover:text-zinc-200'}`}>{mode.replace('-', ' ')}</button>)}</div></div></div>
                <div className="flex justify-end pt-1"><SectionReset onClick={resetFx} /></div>
              </ToolSection>

              <ToolSection value="geometry" title="Geometry" subtitle="Perspective correction with continuous preview" icon={Scan} activeCount={geometryActive}>
                <StudioSlider label="Perspective X" code="PX" icon={MoveHorizontal} value={advanced.perspectiveX} defaultValue={0} min={-25} max={25} description="Horizontal perspective bias" unit="%" onChange={(value) => updateAdvanced('perspectiveX', value)} />
                <StudioSlider label="Perspective Y" code="PY" icon={MoveVertical} value={advanced.perspectiveY} defaultValue={0} min={-25} max={25} description="Vertical perspective bias" unit="%" onChange={(value) => updateAdvanced('perspectiveY', value)} />
                <div className="flex items-center gap-2 rounded-xl border border-cyan-300/10 bg-cyan-400/[0.025] p-3 font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500"><Scan className="size-3.5 text-cyan-300/70" />Transform applies during advanced render pass</div>
                <div className="flex justify-end pt-1"><SectionReset onClick={resetGeometry} /></div>
              </ToolSection>

              <ToolSection value="retouch" title="Retouch & Healing" subtitle="Local brush energy and targeted reconstruction" icon={Eraser} activeCount={retouchActive}>
                <StudioSlider label="Selective / Brush Strength" code="BRSH" icon={Highlighter} value={advanced.brushStrength} defaultValue={0} min={-100} max={100} description="Positive = lift, negative = deepen selected pixels" onChange={(value) => updateAdvanced('brushStrength', value)} />
                <div className="rounded-xl border border-amber-300/10 bg-amber-400/[0.025] px-3 py-2.5 text-[10px] leading-4 text-zinc-500"><span className="font-medium text-amber-200">Brush protocol:</span> set a non-zero strength, then click the image. Each point is added to history.</div>
                <div className="grid grid-cols-2 gap-2"><NumericField label="Healing X" value={heal.x} defaultValue={0} min={0} max={image?.naturalWidth ?? 100000} onChange={(value) => updateAdvanced('heal', { ...heal, x: value })} description="Target origin" /><NumericField label="Healing Y" value={heal.y} defaultValue={0} min={0} max={image?.naturalHeight ?? 100000} onChange={(value) => updateAdvanced('heal', { ...heal, y: value })} description="Target origin" /></div>
                <NumericField label="Healing Size" value={heal.width} defaultValue={32} min={4} max={Math.max(4, Math.min(image?.naturalWidth ?? 2048, image?.naturalHeight ?? 2048))} step={4} onChange={(value) => updateAdvanced('heal', { ...heal, width: value, height: value })} description="Square reconstruction area" />
                <div className="flex justify-end pt-1"><SectionReset onClick={resetRetouch} /></div>
              </ToolSection>
            </Accordion.Root>
            <div className="mt-2 rounded-xl border border-white/[0.06] bg-zinc-900/60 p-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><SlidersHorizontal className="size-3.5 text-zinc-500" /><span className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">Pipeline</span></div><span className="font-mono text-[9px] text-emerald-400/80">NON-DESTRUCTIVE</span></div><div className="mt-3 grid grid-cols-3 gap-1.5 text-center font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-600"><div className="rounded-md bg-zinc-950 px-2 py-2">{historyIndex + 1} State</div><div className="rounded-md bg-zinc-950 px-2 py-2">{history.length} Frames</div><div className="rounded-md bg-zinc-950 px-2 py-2">WebGL</div></div></div>
          </div>
          {error ? <div role="alert" className="shrink-0 border-t border-red-400/10 bg-red-950/30 px-3.5 py-3 text-xs text-red-300">{error}</div> : null}
        </aside>
      </main>
    </div>
  );
}
