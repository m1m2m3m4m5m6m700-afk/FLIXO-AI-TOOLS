import { useEffect, useState } from 'react';
import { imagesToPdf, type ImageToPdfMargin, type ImageToPdfOrientation } from './engine';

export function ImageToPdfTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [orientation, setOrientation] = useState<ImageToPdfOrientation>('portrait');
  const [margin, setMargin] = useState<ImageToPdfMargin>('small');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const blob = await imagesToPdf(files, { orientation, margin });
      setUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'PDF generation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 text-slate-100">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">FLIXO · PDF TOOLS</p>
        <h1 className="text-3xl font-bold">Image to PDF</h1>
        <p className="text-slate-300">Convert JPG, PNG, and WEBP images into a PDF entirely inside your browser.</p>
      </header>

      <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
        <label htmlFor="image-to-pdf-input" className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-600 p-8 text-center hover:border-slate-400">
          <span className="block text-lg font-semibold">Choose images</span>
          <span className="mt-2 block text-sm text-slate-400">JPG · PNG · WEBP · up to 50 images</span>
        </label>
        <input id="image-to-pdf-input" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />

        {files.length > 0 && <ol className="space-y-2 rounded-xl bg-slate-950 p-4" aria-label="Selected images">
          {files.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 border-b border-slate-800 py-2 last:border-0">
            <span className="truncate">{index + 1}. {file.name}</span>
            <span className="text-xs text-slate-400">{Math.round(file.size / 1024)} KB</span>
          </li>)}
        </ol>}

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="font-semibold">Orientation</legend>
            <div className="flex gap-2">
              {(['portrait', 'landscape'] as const).map((value) => <label key={value} className="flex flex-1 items-center gap-2 rounded-lg border border-slate-700 p-3">
                <input type="radio" name="image-to-pdf-orientation" value={value} checked={orientation === value} onChange={() => setOrientation(value)} />
                {value[0].toUpperCase() + value.slice(1)}
              </label>)}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="font-semibold">Margins</legend>
            <div className="flex gap-2">
              {(['none', 'small', 'large'] as const).map((value) => <label key={value} className="flex flex-1 items-center gap-2 rounded-lg border border-slate-700 p-3">
                <input type="radio" name="image-to-pdf-margin" value={value} checked={margin === value} onChange={() => setMargin(value)} />
                {value[0].toUpperCase() + value.slice(1)}
              </label>)}
            </div>
          </fieldset>
        </div>

        <button type="button" disabled={!files.length || busy} onClick={() => void generate()} className="rounded-lg bg-indigo-500 px-5 py-3 font-semibold text-white disabled:opacity-50">
          {busy ? 'Generating…' : 'Create PDF'}
        </button>

        {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-red-200">{error}</p>}
        {url && <a href={url} download="flixo-images.pdf" className="block rounded-lg bg-emerald-600 px-5 py-3 text-center font-semibold text-white">Download PDF</a>}
      </section>
    </main>
  );
}
