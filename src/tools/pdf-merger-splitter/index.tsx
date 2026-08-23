import { useEffect, useMemo, useState } from 'react';
import { createPageRefs, mergePdfPages, normalizeRotation, parsePageRange, readPdfSource, reorderPages, rotatePage, splitPdf, type PdfPageRef, type PdfSource } from './engine';

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function pdfBlob(bytes: Uint8Array): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: 'application/pdf' });
}

export function PdfMergerSplitterTool() {
  const [sources, setSources] = useState<PdfSource[]>([]);
  const [pages, setPages] = useState<PdfPageRef[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadName, setDownloadName] = useState('flixo-merged.pdf');

  useEffect(() => () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl]);

  const totalPages = pages.length;
  const selectedPage = useMemo(() => pages.find((page) => page.id === selected) ?? null, [pages, selected]);

  const loadFiles = async (files: File[]) => {
    setError('');
    setSelected(null);
    const pdfs = files.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) {
      setError('Please select one or more PDF files.');
      return;
    }
    try {
      const nextSources: PdfSource[] = [];
      const nextPages: PdfPageRef[] = [];
      for (const [index, file] of pdfs.entries()) {
        const source = await readPdfSource(file, sources.length + index);
        nextSources.push(source);
        nextPages.push(...createPageRefs(source));
      }
      setSources((current) => [...current, ...nextSources]);
      setPages((current) => [...current, ...nextPages]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to read the selected PDF.');
    }
  };

  const removePage = (id: string) => {
    setPages((current) => current.filter((page) => page.id !== id));
    setSelected((current) => current === id ? null : current);
  };

  const rotateSelected = () => {
    if (!selected) return;
    setPages((current) => current.map((page) => page.id === selected ? rotatePage(page) : page));
  };

  const moveSelected = (delta: number) => {
    if (!selected) return;
    setPages((current) => {
      const index = current.findIndex((page) => page.id === selected);
      const target = index + delta;
      return index < 0 || target < 0 || target >= current.length ? current : reorderPages(current, index, target);
    });
  };

  const createDownload = (bytes: Uint8Array, name: string) => {
    const blob = pdfBlob(bytes);
    setDownloadUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(blob);
    });
    setDownloadName(name);
  };

  const merge = async () => {
    setBusy(true);
    setError('');
    try {
      const bytes = await mergePdfPages(sources, pages);
      createDownload(bytes, 'flixo-merged.pdf');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'PDF merge failed.');
    } finally {
      setBusy(false);
    }
  };

  const split = async () => {
    if (!sources[0]) {
      setError('Add a PDF first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const parsed = parsePageRange(range, sources[0].pageCount);
      const file = new File([sources[0].bytes], sources[0].name, { type: 'application/pdf' });
      const bytes = await splitPdf(file, parsed);
      createDownload(bytes, `flixo-${sources[0].name.replace(/\.pdf$/i, '')}-${parsed.start}-${parsed.end}.pdf`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'PDF split failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 text-slate-100">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">FLIXO · PDF TOOLS</p>
        <h1 className="text-3xl font-bold">PDF Merger & Splitter</h1>
        <p className="max-w-3xl text-slate-300">Merge PDFs locally, reorder or remove pages, rotate pages, or split the first PDF by an exact page range. Files stay in your browser.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <label htmlFor="pdf-input" className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-600 p-8 text-center hover:border-slate-400">
            <span className="block text-lg font-semibold">Drop PDFs here or choose files</span>
            <span className="mt-2 block text-sm text-slate-400">Multiple files supported · pages remain editable before export</span>
          </label>
          <input id="pdf-input" className="sr-only" type="file" accept="application/pdf,.pdf" multiple onChange={(event) => void loadFiles(Array.from(event.target.files ?? []))} />

          {sources.length > 0 && <div className="grid gap-2 sm:grid-cols-2">
            {sources.map((source) => <div key={source.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
              <div className="truncate font-medium">{source.name}</div>
              <div className="text-xs text-slate-400">{source.pageCount} pages · {formatBytes(source.bytes.byteLength)}</div>
            </div>)}
          </div>}

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!pages.length || busy} onClick={() => void merge()} className="rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Processing…' : `Merge ${totalPages} pages`}</button>
            <button type="button" disabled={!selected || busy} onClick={rotateSelected} className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">Rotate selected</button>
            <button type="button" disabled={!selected || busy} onClick={() => moveSelected(-1)} className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">Move ↑</button>
            <button type="button" disabled={!selected || busy} onClick={() => moveSelected(1)} className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">Move ↓</button>
            <button type="button" disabled={!selected || busy} onClick={() => selected && removePage(selected)} className="rounded-lg border border-red-700 px-4 py-2 text-red-300 disabled:opacity-50">Delete</button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page, index) => <button key={page.id} type="button" onClick={() => setSelected(page.id)} className={`rounded-xl border p-4 text-left transition ${selected === page.id ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-700 bg-slate-950 hover:border-slate-500'}`}>
              <div className="mb-3 flex aspect-[3/4] items-center justify-center rounded-lg bg-white text-slate-950 shadow-inner"><div className="text-center text-xs"><div className="text-3xl font-bold">PDF</div><div>Page {page.pageIndex + 1}</div></div></div>
              <div className="truncate text-sm font-medium">#{index + 1} · {page.label}</div>
              <div className="text-xs text-slate-400">Rotation {normalizeRotation(page.rotation)}°</div>
            </button>)}
          </div>

          {!pages.length && <div className="rounded-xl bg-slate-950 p-8 text-center text-slate-400">No pages loaded yet.</div>}
          {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-red-200">{error}</p>}
        </div>

        <aside className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <div>
            <h2 className="text-lg font-semibold">Split first PDF</h2>
            <p className="mt-1 text-sm text-slate-400">Examples: <code>1-3</code>, <code>4</code>, <code>2-5</code>.</p>
          </div>
          <input value={range} onChange={(event) => setRange(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" aria-label="Page range" />
          <button type="button" disabled={!sources.length || busy} onClick={() => void split()} className="w-full rounded-lg border border-indigo-400 px-4 py-2 font-semibold text-indigo-200 disabled:opacity-50">Split range</button>

          {selectedPage && <div className="rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
            <div className="font-semibold">Selected page</div>
            <div className="mt-1 break-words">{selectedPage.label}</div>
            <div className="mt-1">Rotation: {normalizeRotation(selectedPage.rotation)}°</div>
          </div>}

          {downloadUrl && <a className="block rounded-lg bg-emerald-600 px-4 py-3 text-center font-semibold text-white" href={downloadUrl} download={downloadName}>Download {downloadName}</a>}
        </aside>
      </section>
    </main>
  );
}
