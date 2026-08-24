import { useEffect, useState } from 'react';
import { compressPdf, type PdfCompressionLevel, type PdfCompressionResult } from './engine';

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function PdfCompressorTool() {
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<PdfCompressionLevel>('medium');
  const [result, setResult] = useState<PdfCompressionResult | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); }, [downloadUrl]);

  const compress = async () => {
    if (!file) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const next = await compressPdf(file, { level });
      setResult(next);
      setDownloadUrl((current) => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(next.blob); });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'PDF compression failed.'); }
    finally { setBusy(false); }
  };

  const download = () => {
    if (!downloadUrl) return;
    const anchor = document.createElement('a'); anchor.href = downloadUrl; anchor.download = 'flixo-compressed.pdf'; anchor.click();
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 text-slate-100">
      <header className="space-y-2"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">FLIXO · PDF TOOLS</p><h1 className="text-3xl font-bold">PDF Compressor</h1><p className="max-w-3xl text-slate-300">Re-render PDF pages locally and re-encode them for a smaller browser-generated PDF. No upload is required.</p></header>
      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <label htmlFor="pdf-compressor-input" className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-600 p-10 text-center hover:border-slate-400"><span className="block text-lg font-semibold">Choose a PDF</span><span className="mt-2 block text-sm text-slate-400">Browser limit: 75 MB · processing stays local</span></label>
          <input id="pdf-compressor-input" className="sr-only" type="file" accept="application/pdf,.pdf" onChange={(event) => { setError(''); setResult(null); setDownloadUrl((current) => { if (current) URL.revokeObjectURL(current); return ''; }); setFile(event.target.files?.[0] ?? null); }} />
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-4"><div className="font-semibold">{file?.name ?? 'No PDF selected'}</div><div className="mt-1 text-sm text-slate-400">{file ? formatBytes(file.size) : 'Select a PDF to begin.'}</div></div>
          {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-red-200">{error}</p>}
          <button type="button" disabled={!file || busy} onClick={() => void compress()} className="rounded-lg bg-indigo-500 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Compressing locally…' : 'Compress PDF'}</button>
          <p className="text-sm text-slate-400">Note: PDF compression here rasterizes pages, so selectable text and vector structure are not preserved. The tool prefers the compressed output only when it is actually smaller than the source.</p>
        </div>
        <aside className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <div><h2 className="text-lg font-semibold">Compression level</h2><p className="mt-1 text-sm text-slate-400">Higher compression uses lower JPEG quality and a lower render scale.</p></div>
          <div className="grid gap-2">{(['low', 'medium', 'high'] as const).map((value) => <label key={value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-950 p-3"><input type="radio" name="compression-level" value={value} checked={level === value} onChange={() => setLevel(value)} /><span className="capitalize">{value}</span></label>)}</div>
          {result && <div className="space-y-3 rounded-xl bg-slate-950 p-4" aria-live="polite"><div className="text-3xl font-bold">{result.savingsPercent}%</div><div className="text-sm text-slate-400">size reduction · {result.pageCount} pages</div><dl className="space-y-2 text-sm"><div className="flex justify-between gap-3"><dt>Before</dt><dd>{formatBytes(result.inputBytes)}</dd></div><div className="flex justify-between gap-3"><dt>After</dt><dd>{formatBytes(result.outputBytes)}</dd></div><div className="flex justify-between gap-3"><dt>Mode</dt><dd>{result.usedCompression ? level : 'original retained'}</dd></div></dl>{downloadUrl && <a className="block rounded-lg bg-emerald-600 px-4 py-3 text-center font-semibold text-white" href={downloadUrl} download="flixo-compressed.pdf" onClick={(event) => { event.preventDefault(); download(); }}>Download compressed PDF</a>}</div>}
        </aside>
      </section>
    </main>
  );
}
