import { useMemo, useState } from 'react';
import { analyzeText } from './engine';

const INITIAL_TEXT = '';

export function WordCharacterCounterTool() {
  const [text, setText] = useState(INITIAL_TEXT);
  const stats = useMemo(() => analyzeText(text), [text]);

  const copyText = async () => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6" aria-labelledby="word-counter-title">
      <header>
        <h1 id="word-counter-title" className="text-3xl font-bold">Word &amp; Character Counter</h1>
        <p className="mt-2 text-sm opacity-75">Count words, characters, sentences, paragraphs, reading time, speaking time, and keyword density locally.</p>
      </header>

      <textarea
        aria-label="Text input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Type or paste your text here…"
        className="min-h-72 w-full resize-y rounded-2xl border p-4"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Text statistics">
        {[
          ['Words', stats.words],
          ['Characters', stats.characters],
          ['Characters without spaces', stats.charactersNoSpaces],
          ['Sentences', stats.sentences],
          ['Paragraphs', stats.paragraphs],
          ['Reading minutes', stats.readingMinutes],
          ['Speaking minutes', stats.speakingMinutes],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border p-4">
            <div className="text-sm opacity-65">{label}</div>
            <div className="mt-1 text-2xl font-bold" data-testid={`stat-${String(label).toLowerCase().replaceAll(' ', '-')}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="rounded-xl border px-4 py-2" onClick={() => setText('')}>Clear</button>
        <button type="button" className="rounded-xl border px-4 py-2 disabled:opacity-50" disabled={!text} onClick={copyText}>Copy text</button>
      </div>

      <section className="rounded-2xl border p-4" aria-labelledby="keyword-density-title">
        <h2 id="keyword-density-title" className="font-semibold">Top keyword density</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr><th className="p-2">Keyword</th><th className="p-2">Count</th><th className="p-2">Density</th></tr></thead>
            <tbody>
              {stats.keywords.map((keyword) => (
                <tr key={keyword.word} className="border-t">
                  <td className="p-2">{keyword.word}</td>
                  <td className="p-2">{keyword.count}</td>
                  <td className="p-2">{keyword.density}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
