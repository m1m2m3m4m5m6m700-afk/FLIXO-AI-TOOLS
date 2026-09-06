import { useMemo, useState } from 'react';
import { convertCase, type CaseMode } from './engine';
import type { Locale } from '@/lib/i18n';
import { LOCALE_METADATA } from '@/lib/i18n';

const MODES: Array<{ id: CaseMode; label: string }> = [
  { id: 'upper', label: 'UPPERCASE' },
  { id: 'lower', label: 'lowercase' },
  { id: 'title', label: 'Title Case' },
  { id: 'sentence', label: 'Sentence case' },
  { id: 'camel', label: 'camelCase' },
  { id: 'pascal', label: 'PascalCase' },
  { id: 'snake', label: 'snake_case' },
  { id: 'kebab', label: 'kebab-case' },
  { id: 'constant', label: 'CONSTANT_CASE' },
];

const STAT_LABELS: Readonly<Record<Locale, Readonly<{ characters: string; words: string; mode: string }>>> = {
  en: { characters: 'Characters', words: 'Words', mode: 'Mode' },
  ar: { characters: 'الأحرف', words: 'الكلمات', mode: 'الوضع' },
  es: { characters: 'Caracteres', words: 'Palabras', mode: 'Modo' },
  fr: { characters: 'Caractères', words: 'Mots', mode: 'Mode' },
  de: { characters: 'Zeichen', words: 'Wörter', mode: 'Modus' },
  hi: { characters: 'अक्षर', words: 'शब्द', mode: 'मोड' },
  id: { characters: 'Karakter', words: 'Kata', mode: 'Mode' },
  it: { characters: 'Caratteri', words: 'Parole', mode: 'Modalità' },
  ja: { characters: '文字', words: '単語', mode: 'モード' },
  ko: { characters: '문자', words: '단어', mode: '모드' },
  ms: { characters: 'Aksara', words: 'Perkataan', mode: 'Mod' },
  nl: { characters: 'Tekens', words: 'Woorden', mode: 'Modus' },
  pl: { characters: 'Znaki', words: 'Słowa', mode: 'Tryb' },
  pt: { characters: 'Caracteres', words: 'Palavras', mode: 'Modo' },
  ru: { characters: 'Символы', words: 'Слова', mode: 'Режим' },
  sv: { characters: 'Tecken', words: 'Ord', mode: 'Läge' },
  th: { characters: 'อักขระ', words: 'คำ', mode: 'โหมด' },
  tr: { characters: 'Karakter', words: 'Kelimeler', mode: 'Mod' },
  uk: { characters: 'Символи', words: 'Слова', mode: 'Режим' },
  vi: { characters: 'Ký tự', words: 'Từ', mode: 'Chế độ' },
};

export function CaseConverterTool() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<CaseMode>('upper');
  const output = useMemo(() => convertCase(text, mode), [text, mode]);

  const rawLocale = typeof document !== 'undefined' ? document.documentElement.lang.split('-')[0] : 'en';
  const locale = (Object.prototype.hasOwnProperty.call(STAT_LABELS, rawLocale) ? rawLocale : 'en') as Locale;
  const labels = STAT_LABELS[locale];

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6" aria-labelledby="case-converter-title">
      <header>
        <h1 id="case-converter-title" className="text-3xl font-bold">Case Converter</h1>
        <p className="mt-2 text-sm opacity-75">Convert text between common letter and identifier cases locally in your browser.</p>
      </header>

      <textarea
        aria-label="Text input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Type or paste text here…"
        className="min-h-56 w-full resize-y rounded-2xl border p-4"
      />

      <div className="grid gap-2 sm:grid-cols-3" aria-label="Case modes">
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${mode === id ? 'border-current' : 'opacity-70'}`}
            aria-pressed={mode === id}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <textarea
        aria-label="Converted output"
        value={output}
        readOnly
        className="min-h-56 w-full resize-y rounded-2xl border p-4"
      />

      <div className="flex flex-wrap gap-3">
        <button type="button" className="rounded-xl border px-4 py-2" onClick={() => navigator.clipboard.writeText(output)} disabled={!output}>Copy</button>
        <button type="button" className="rounded-xl border px-4 py-2" onClick={() => setText('')} disabled={!text}>Clear</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3" aria-label="Text statistics">
        <div className="rounded-2xl border p-4"><div className="text-sm opacity-65">{labels.characters}</div><div className="text-2xl font-bold">{[...text].length}</div></div>
        <div className="rounded-2xl border p-4"><div className="text-sm opacity-65">{labels.words}</div><div className="text-2xl font-bold">{text.trim() ? text.trim().split(/\s+/u).length : 0}</div></div>
        <div className="rounded-2xl border p-4"><div className="text-sm opacity-65">{labels.mode}</div><div className="text-2xl font-bold">{MODES.find(({ id }) => id === mode)?.label}</div></div>
      </div>
    </section>
  );
}