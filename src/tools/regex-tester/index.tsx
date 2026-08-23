import { useMemo, useState } from 'react';
import { testRegex, type RegexFlags } from './engine';

const defaults: RegexFlags = { global: true, ignoreCase: false, multiline: false, dotAll: false, unicode: false, sticky: false };

export function RegexTesterTool() {
  const [pattern, setPattern] = useState('\\b\\w+\\b');
  const [input, setInput] = useState('FLIXO Regex Tester');
  const [flags, setFlags] = useState<RegexFlags>(defaults);
  const result = useMemo(() => testRegex(pattern, input, flags), [pattern, input, flags]);
  const toggle = (key: keyof RegexFlags) => setFlags((current) => ({ ...current, [key]: !current[key] }));

  return <section className="mx-auto max-w-4xl space-y-6 p-6">
    <header><h1 className="text-2xl font-semibold">Regex Tester & Debugger</h1><p className="text-sm opacity-70">Test JavaScript regular expressions locally with live matches and capture groups.</p></header>
    <input className="w-full rounded border p-3 font-mono" value={pattern} onChange={(e) => setPattern(e.target.value)} aria-label="Regex pattern" />
    <div className="flex flex-wrap gap-3 text-sm">{(Object.keys(flags) as Array<keyof RegexFlags>).map((key) => <label key={key} className="inline-flex items-center gap-2"><input type="checkbox" checked={flags[key]} onChange={() => toggle(key)} />{key}</label>)}</div>
    <textarea className="min-h-48 w-full rounded border p-3" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Regex input" />
    {result.error ? <p role="alert" className="rounded border p-3">{result.error}</p> : <div className="space-y-3"><p aria-live="polite">{result.matches.length} match{result.matches.length === 1 ? '' : 'es'}</p>{result.matches.map((match, index) => <div key={`${match.index}-${index}`} className="rounded border p-3 font-mono text-sm">#{index + 1} • index {match.index} • {JSON.stringify(match.text)}{match.groups.length > 0 && <div className="mt-1 opacity-70">groups: {JSON.stringify(match.groups)}</div>}</div>)}</div>}
  </section>;
}
