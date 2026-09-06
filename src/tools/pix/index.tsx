import React, { useCallback, useEffect, useRef, useState } from 'react';

export type ToolMode = 'tune' | 'liquify' | 'dispersion' | 'text';
export interface FilterSettings { brightness: number; contrast: number; saturation: number; hue: number; blur: number; }
export interface TextLayer { id: string; text: string; x: number; y: number; color: string; fontSize: number; }
export interface Particle { x: number; y: number; size: number; color: string; vx: number; vy: number; alpha: number; life: number; maxLife: number; }
type Snapshot = { imageData: ImageData; textLayers: TextLayer[]; filters: FilterSettings };

const DEFAULT_FILTERS: FilterSettings = { brightness: 0, contrast: 0, saturation: 0, hue: 0, blur: 0 };
const cloneFilters = (value: FilterSettings): FilterSettings => ({ ...value });

function applyLiquify(ctx: CanvasRenderingContext2D, cx: number, cy: number, dx: number, dy: number, radius: number, intensity: number) {
  const width = ctx.canvas.width, height = ctx.canvas.height;
  const minX = Math.max(0, Math.floor(cx - radius)), maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius)), maxY = Math.min(height - 1, Math.ceil(cy + radius));
  const rw = maxX - minX + 1, rh = maxY - minY + 1;
  if (rw <= 0 || rh <= 0 || radius <= 0) return;
  const srcImageData = ctx.getImageData(minX, minY, rw, rh), dstImageData = ctx.createImageData(rw, rh);
  const src = srcImageData.data, dst = dstImageData.data, radiusSq = radius * radius;
  for (let y = 0; y < rh; y += 1) {
    for (let x = 0; x < rw; x += 1) {
      const curX = minX + x, curY = minY + y, distX = curX - cx, distY = curY - cy;
      const distSq = distX * distX + distY * distY, dstIdx = (y * rw + x) * 4;
      if (distSq < radiusSq) {
        const norm = Math.sqrt(distSq) / radius, weight = Math.pow(1 - norm * norm, 2) * intensity;
        const srcX = Math.max(0, Math.min(width - 1, curX - dx * weight)), srcY = Math.max(0, Math.min(height - 1, curY - dy * weight));
        const x1 = Math.max(0, Math.min(rw - 1, Math.floor(srcX - minX))), y1 = Math.max(0, Math.min(rh - 1, Math.floor(srcY - minY)));
        const x2 = Math.min(rw - 1, x1 + 1), y2 = Math.min(rh - 1, y1 + 1);
        const fx = Math.max(0, Math.min(1, srcX - minX - x1)), fy = Math.max(0, Math.min(1, srcY - minY - y1));
        const i1 = (y1 * rw + x1) * 4, i2 = (y1 * rw + x2) * 4, i3 = (y2 * rw + x1) * 4, i4 = (y2 * rw + x2) * 4;
        for (let c = 0; c < 4; c += 1) dst[dstIdx + c] = src[i1 + c] * (1 - fx) * (1 - fy) + src[i2 + c] * fx * (1 - fy) + src[i3 + c] * (1 - fx) * fy + src[i4 + c] * fx * fy;
      } else {
        dst[dstIdx] = src[dstIdx]; dst[dstIdx + 1] = src[dstIdx + 1]; dst[dstIdx + 2] = src[dstIdx + 2]; dst[dstIdx + 3] = src[dstIdx + 3];
      }
    }
  }
  ctx.putImageData(dstImageData, minX, minY);
}

function generateDispersionParticles(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): Particle[] {
  const width = ctx.canvas.width, height = ctx.canvas.height;
  const minX = Math.max(0, Math.floor(cx - radius)), maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius)), maxY = Math.min(height - 1, Math.ceil(cy + radius));
  const imgData = ctx.getImageData(0, 0, width, height), data = imgData.data, particles: Particle[] = [];
  for (let y = minY; y <= maxY; y += 2) {
    for (let x = minX; x <= maxX; x += 2) {
      const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (distSq > radius * radius || Math.random() >= 0.45) continue;
      const idx = (y * width + x) * 4, alpha = data[idx + 3] / 255;
      if (alpha <= 0.2) continue;
      const angle = Math.atan2(y - cy, x - cx) + (Math.random() - 0.5) * 0.9, speed = 2 + Math.random() * 7;
      particles.push({ x, y, size: 2 + Math.random() * 5, color: `rgb(${data[idx]},${data[idx + 1]},${data[idx + 2]})`, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, alpha, life: 0, maxLife: 28 + Math.random() * 42 });
      data[idx + 3] = 0;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return particles;
}

function buildFilter(value: FilterSettings) {
  return `brightness(${100 + value.brightness}%) contrast(${100 + value.contrast}%) saturate(${100 + value.saturation}%) hue-rotate(${value.hue}deg) blur(${value.blur}px)`;
}

export default function PixTool() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<Snapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [activeTool, setActiveTool] = useState<ToolMode>('tune');
  const [filters, setFilters] = useState<FilterSettings>(DEFAULT_FILTERS);
  const [liquifyRadius, setLiquifyRadius] = useState(40);
  const [liquifyStrength, setLiquifyStrength] = useState(0.5);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [newText, setNewText] = useState('Pix Studio');
  const [textColor, setTextColor] = useState('#ffffff');
  const [isInteracting, setIsInteracting] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyLength, setHistoryLength] = useState(0);

  const captureSnapshot = useCallback((nextLayers: TextLayer[], nextFilters: FilterSettings): Snapshot | null => {
    const canvas = workingCanvasRef.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return null;
    return { imageData: ctx.getImageData(0, 0, canvas.width, canvas.height), textLayers: nextLayers.map((layer) => ({ ...layer })), filters: cloneFilters(nextFilters) };
  }, []);

  const saveState = useCallback((nextLayers: TextLayer[], nextFilters: FilterSettings) => {
    const snapshot = captureSnapshot(nextLayers, nextFilters);
    if (!snapshot) return;
    const next = [...historyRef.current.slice(0, historyIndexRef.current + 1), snapshot];
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    setHistoryIndex(historyIndexRef.current);
    setHistoryLength(next.length);
  }, [captureSnapshot]);

  const restoreSnapshot = useCallback((index: number) => {
    const snapshot = historyRef.current[index], working = workingCanvasRef.current, ctx = working?.getContext('2d');
    if (!snapshot || !working || !ctx) return;
    ctx.putImageData(snapshot.imageData, 0, 0);
    setTextLayers(snapshot.textLayers.map((layer) => ({ ...layer })));
    setFilters(cloneFilters(snapshot.filters));
    setParticles([]);
    historyIndexRef.current = index;
    setHistoryIndex(index);
  }, []);

  const redraw = useCallback(() => {
    const display = canvasRef.current, working = workingCanvasRef.current;
    if (!display || !working || !image) return;
    const ctx = display.getContext('2d');
    if (!ctx) return;
    display.width = working.width;
    display.height = working.height;
    ctx.clearRect(0, 0, display.width, display.height);
    ctx.save();
    ctx.filter = buildFilter(filters);
    ctx.drawImage(working, 0, 0);
    ctx.restore();
    textLayers.forEach((layer) => {
      ctx.save();
      ctx.font = `700 ${layer.fontSize}px sans-serif`;
      ctx.fillStyle = layer.color;
      ctx.fillText(layer.text, layer.x, layer.y);
      ctx.restore();
    });
    particles.forEach((particle) => {
      ctx.save();
      ctx.globalAlpha = particle.alpha * Math.max(0, 1 - particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      ctx.restore();
    });
  }, [filters, image, particles, textLayers]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => () => {
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        restoreSnapshot(historyIndexRef.current + (event.shiftKey ? 1 : -1));
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        restoreSnapshot(historyIndexRef.current + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [restoreSnapshot]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      const working = document.createElement('canvas');
      working.width = img.naturalWidth;
      working.height = img.naturalHeight;
      const ctx = working.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      workingCanvasRef.current = working;
      setImage(img);
      setActiveTool('tune');
      setFilters(cloneFilters(DEFAULT_FILTERS));
      setTextLayers([]);
      setParticles([]);
      const initial: Snapshot = { imageData: ctx.getImageData(0, 0, working.width, working.height), textLayers: [], filters: cloneFilters(DEFAULT_FILTERS) };
      historyRef.current = [initial];
      historyIndexRef.current = 0;
      setHistoryIndex(0);
      setHistoryLength(1);
    };
    img.src = url;
    event.currentTarget.value = '';
  };

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(event);
    if (!point) return;
    setIsInteracting(true);
    lastMousePos.current = point;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (activeTool === 'dispersion') {
      const ctx = workingCanvasRef.current?.getContext('2d');
      if (!ctx) return;
      const created = generateDispersionParticles(ctx, point.x, point.y, liquifyRadius);
      setParticles(created);
      saveState(textLayers, filters);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isInteracting || activeTool !== 'liquify' || !lastMousePos.current) return;
    const point = getCanvasPoint(event), ctx = workingCanvasRef.current?.getContext('2d');
    if (!point || !ctx) return;
    applyLiquify(ctx, point.x, point.y, point.x - lastMousePos.current.x, point.y - lastMousePos.current.y, liquifyRadius, liquifyStrength);
    lastMousePos.current = point;
    redraw();
  };

  const finishInteraction = () => {
    if (isInteracting && activeTool === 'liquify') saveState(textLayers, filters);
    setIsInteracting(false);
    lastMousePos.current = null;
  };

  const updateFilter = (key: keyof FilterSettings, value: number) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    saveState(textLayers, nextFilters);
  };

  const addTextLayer = () => {
    const canvas = workingCanvasRef.current;
    const text = newText.trim();
    if (!canvas || !text) return;
    const nextLayers = [...textLayers, {
      id: crypto.randomUUID(),
      text,
      x: Math.max(20, canvas.width / 2 - 80),
      y: Math.max(48, canvas.height / 2),
      color: textColor,
      fontSize: Math.max(18, Math.min(96, Math.round(canvas.width / 16))),
    }];
    setTextLayers(nextLayers);
    saveState(nextLayers, filters);
  };

  const resetEditor = () => restoreSnapshot(0);

  const exportImage = async () => {
    const working = workingCanvasRef.current;
    if (!working) return;
    const output = document.createElement('canvas');
    output.width = working.width;
    output.height = working.height;
    const ctx = output.getContext('2d');
    if (!ctx) return;
    ctx.filter = buildFilter(filters);
    ctx.drawImage(working, 0, 0);
    textLayers.forEach((layer) => {
      ctx.save();
      ctx.font = `700 ${layer.fontSize}px sans-serif`;
      ctx.fillStyle = layer.color;
      ctx.fillText(layer.text, layer.x, layer.y);
      ctx.restore();
    });
    particles.forEach((particle) => {
      ctx.save();
      ctx.globalAlpha = particle.alpha * Math.max(0, 1 - particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      ctx.restore();
    });
    const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/png', 1));
    if (!blob || blob.size <= 20) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'pix-studio-export.png';
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return <div className="mx-auto flex min-h-[650px] max-w-7xl flex-col gap-6 p-4 lg:flex-row" dir="rtl">
    <div className="relative flex min-h-[520px] flex-1 items-center justify-center overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      {image ? <canvas ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishInteraction} onPointerCancel={finishInteraction} className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-2xl touch-none cursor-crosshair" aria-label="Pix Studio preview" /> : <label className="cursor-pointer rounded-xl border-2 border-dashed border-zinc-800 p-12 text-center transition hover:border-zinc-700"><span className="mb-2 block font-bold text-zinc-300">افتح صورة للبدء في Pix Studio</span><span className="block text-xs text-zinc-600">JPG, PNG, WebP — معالجة محلية وتصدير PNG عالي الدقة</span><input id="pix-image-file" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></label>}
    </div>
    {image && <aside className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-6 lg:w-96">
      <div className="mb-5 flex items-center justify-between border-b border-zinc-800 pb-4"><div><h1 className="text-lg font-bold text-white">Pix Studio</h1><p className="text-xs text-zinc-500">Liquify · Dispersion · Tune · Text · History · Export</p></div><label className="cursor-pointer rounded-lg bg-zinc-800 px-3 py-2 text-xs text-white">فتح صورة<input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></label></div>
      <div className="mb-5 grid grid-cols-4 gap-1 rounded-xl bg-zinc-950 p-1">{(['tune', 'liquify', 'dispersion', 'text'] as ToolMode[]).map((tool) => <button key={tool} type="button" onClick={() => setActiveTool(tool)} className={`rounded-lg py-2 text-xs font-bold capitalize transition ${activeTool === tool ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}>{tool}</button>)}</div>
      {activeTool === 'tune' && <div className="space-y-4">{([['Brightness', 'brightness', -100, 100], ['Contrast', 'contrast', -100, 100], ['Saturation', 'saturation', -100, 100], ['Hue', 'hue', 0, 360], ['Blur', 'blur', 0, 20]] as const).map(([label, key, min, max]) => <label key={key} className="block text-xs text-zinc-400"><span className="mb-1 block">{label}: {filters[key]}</span><input aria-label={label} type="range" min={min} max={max} value={filters[key]} onChange={(event) => updateFilter(key, Number(event.target.value))} className="w-full accent-indigo-500" /></label>)}</div>}
      {activeTool === 'liquify' && <div className="space-y-4"><p className="text-xs text-zinc-500">اسحب على الصورة لتشكيل البكسلات محليًا.</p><label className="block text-xs text-zinc-400">Brush radius: {liquifyRadius}<input aria-label="Liquify radius" type="range" min="10" max="120" value={liquifyRadius} onChange={(event) => setLiquifyRadius(Number(event.target.value))} className="mt-2 w-full accent-indigo-500" /></label><label className="block text-xs text-zinc-400">Strength: {Math.round(liquifyStrength * 100)}%<input aria-label="Liquify strength" type="range" min="0.1" max="1" step="0.05" value={liquifyStrength} onChange={(event) => setLiquifyStrength(Number(event.target.value))} className="mt-2 w-full accent-indigo-500" /></label></div>}
      {activeTool === 'dispersion' && <div className="space-y-4"><p className="text-xs text-zinc-500">انقر على الصورة لاستخراج الجسيمات من المنطقة المحددة.</p><label className="block text-xs text-zinc-400">Particle radius: {liquifyRadius}<input aria-label="Dispersion radius" type="range" min="10" max="120" value={liquifyRadius} onChange={(event) => setLiquifyRadius(Number(event.target.value))} className="mt-2 w-full accent-indigo-500" /></label></div>}
      {activeTool === 'text' && <div className="space-y-4"><input aria-label="Text layer" value={newText} onChange={(event) => setNewText(event.target.value)} placeholder="أدخل النص هنا..." className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-sm text-white focus:border-indigo-500 focus:outline-none" /><div className="flex gap-2"><input aria-label="Text color" type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} className="h-9 w-12 cursor-pointer rounded-md bg-transparent" /><button type="button" onClick={addTextLayer} className="flex-1 rounded-lg bg-zinc-800 text-xs font-bold text-white hover:bg-zinc-700">إضافة نص</button></div></div>}
      <div className="mt-6 grid grid-cols-3 gap-2"><button type="button" onClick={() => restoreSnapshot(historyIndex - 1)} disabled={historyIndex <= 0} className="rounded-lg bg-zinc-800 py-2 text-xs text-white disabled:opacity-40">تراجع Undo</button><button type="button" onClick={() => restoreSnapshot(historyIndex + 1)} disabled={historyIndex >= historyLength - 1} className="rounded-lg bg-zinc-800 py-2 text-xs text-white disabled:opacity-40">إعادة Redo</button><button type="button" onClick={resetEditor} disabled={historyIndex === 0} className="rounded-lg bg-zinc-800 py-2 text-xs text-white disabled:opacity-40">Reset</button></div>
      <button type="button" onClick={() => void exportImage()} className="mt-3 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-indigo-500">تصدير الصورة PNG عالي الدقة</button>
    </aside>}
  </div>;
}
