import { useMemo, useState } from 'react';
import { extractPdfText, exportJson, exportText, type PdfTextExtraction } from './engine';

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function PdfToTextTool() {
  const [file, setFile] = useState<File | null>(null);
  const [extraction, setExtraction] = useState<PdfTextExtraction | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const filteredPages = useMemo(() => {
    if (!extraction || !search.trim()) return extraction?.pages ?? [];
    const query = search.trim().toLocaleLowerCase();
    return extraction.pages.filter((page) => page.text.toLocaleLowerCase().includes(query));
  }, [extraction, search]);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      setExtraction(await extractPdfText(file));
    } catch (cause) {
      setExtraction(null);
      setError(cause instanceof Error ? cause.message : 'PDF text extraction failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6" aria-labelledby="pdf-to-text-title">
      <header>
        <h1 id="pdf-to-text-title" className="text-3xl font-bold">PDF to Text</h1>
        <p className="mt-2 text-sm opacity-75">Extract selectable PDF text locally in your browser.</p>
      </header>

      <label className="flex flex-col gap-2 rounded-2xl border border-dashed p-6">
        <span className="font-medium">Select PDF</span>
        <input id="pdf-to-text-input" type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        {file && <span className="text-sm opacity-70">{file.name}</span>}
      </label>

      <button type="button" disabled={!file || busy} onClick={run} className="rounded-xl border px-4 py-3 font-semibold disabled:opacity-50">
        {busy ? 'Extracting locally…' : 'Extract Text'}
      </button>

      {error && <div role="alert" className="rounded-xl border p-4">{error}</div>}

      {extraction && (
        <>
          <div className="grid gap-3 sm:grid-cols-3" aria-label="Extraction statistics">
            <div className="rounded-xl border p-4"><strong>{extraction.pages.length}</strong><span className="ml-2 text-sm opacity-70">pages</span></div>
            <div className="rounded-xl border p-4"><strong>{extraction.wordCount}</strong><span className="ml-2 text-sm opacity-70">words</span></div>
            <div className="rounded-xl border p-4"><strong>{extraction.text.length}</strong><span className="ml-2 text-sm opacity-70">characters</span></div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input aria-label="Search extracted text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search extracted text" className="min-w-0 flex-1 rounded-xl border px-4 py-3" />
            <button type="button" className="rounded-xl border px-4 py-3" onClick={() => download(exportText(extraction), `${file?.name.replace(/\.pdf$/iu, '') ?? 'document'}.txt`, 'text/plain;charset=utf-8')}>Download TXT</button>
            <button type="button" className="rounded-xl border px-4 py-3" onClick={() => download(exportJson(extraction), `${file?.name.replace(/\.pdf$/iu, '') ?? 'document'}.json`, 'application/json;charset=utf-8')}>Download JSON</button>
          </div>

          <div className="grid gap-4" aria-label="Extracted pages">
            {filteredPages.map((page) => (
              <article key={page.pageNumber} className="rounded-2xl border p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="font-semibold">Page {page.pageNumber}</h2>
                  <span className="text-xs opacity-70">{page.wordCount} words</span>
                </div>
                <pre className="whitespace-pre-wrap break-words text-sm">{page.text || '[No selectable text on this page]'}</pre>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
