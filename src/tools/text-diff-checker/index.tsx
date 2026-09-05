import { useMemo, useState } from 'react';
import { diffSummary, diffText, type DiffKind } from './engine';

const styles: Record<DiffKind, string> = { equal: '', added: 'bg-green-200/40', removed: 'bg-red-200/40 line-through' };

export function TextDiffCheckerTool() {
  const [original, setOriginal] = useState('');
  const [modified, setModified] = useState('');
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [mode, setMode] = useState<'inline' | 'side-by-side'>('inline');
  const result = useMemo(() => diffText(original, modified, ignoreWhitespace), [original, modified, ignoreWhitespace]);

  const copySummary = async () => navigator.clipboard.writeText(diffSummary(result));

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6" aria-labelledby="text-diff-title">
      <header>
        <h1 id="text-diff-title" className="text-3xl font-bold">Text Diff Checker</h1>
        <p className="mt-2 text-sm opacity-75">Compare two texts locally with inline or side-by-side differences.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2"><span>Original</span><textarea aria-label="Original text" value={original} onChange={(e) => setOriginal(e.target.value)} className="min-h-64 rounded-2xl border p-4" /></label>
        <label className="flex flex-col gap-2"><span>Modified</span><textarea aria-label="Modified text" value={modified} onChange={(e) => setModified(e.target.value)} className="min-h-64 rounded-2xl border p-4" /></label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2"><input type="checkbox" checked={ignoreWhitespace} onChange={(e) => setIgnoreWhitespace(e.target.checked)} /> Ignore whitespace</label>
        <div className="flex gap-2" role="group" aria-label="Diff view mode">
          <button type="button" className="rounded-xl border px-3 py-2" aria-pressed={mode === 'inline'} onClick={() => setMode('inline')}>Inline</button>
          <button type="button" className="rounded-xl border px-3 py-2" aria-pressed={mode === 'side-by-side'} onClick={() => setMode('side-by-side')}>Side-by-side</button>
        </div>
        <button type="button" className="rounded-xl border px-3 py-2" onClick={copySummary}>Copy summary</button>
      </div>
      <div data-testid="diff-summary" className="rounded-2xl border p-4">{diffSummary(result)}</div>
      {mode === 'inline' ? (
        <div aria-label="Inline diff" className="whitespace-pre-wrap rounded-2xl border p-4 leading-7">
          {result.parts.map((part, index) => <span key={`${part.kind}-${index}`} className={styles[part.kind]}>{part.value}</span>)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div aria-label="Original diff" className="whitespace-pre-wrap rounded-2xl border p-4">{result.parts.filter((p) => p.kind !== 'added').map((part, index) => <span key={`o-${part.kind}-${index}`} className={styles[part.kind]}>{part.value}</span>)}</div>
          <div aria-label="Modified diff" className="whitespace-pre-wrap rounded-2xl border p-4">{result.parts.filter((p) => p.kind !== 'removed').map((part, index) => <span key={`m-${part.kind}-${index}`} className={styles[part.kind]}>{part.value}</span>)}</div>
        </div>
      )}
    </section>
  );
}
