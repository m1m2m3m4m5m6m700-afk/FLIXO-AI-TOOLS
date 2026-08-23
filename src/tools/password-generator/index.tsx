import { useState } from 'react';
import { generatePassword, passwordStrength, type PasswordOptions } from './engine';

const DEFAULTS: PasswordOptions = { length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true, excludeAmbiguous: false };

export function PasswordGeneratorTool() {
  const [options, setOptions] = useState(DEFAULTS);
  const [password, setPassword] = useState(() => generatePassword(DEFAULTS));
  const [history, setHistory] = useState<string[]>([]);

  const regenerate = () => {
    const next = generatePassword(options);
    setPassword(next);
    setHistory((items) => [next, ...items].slice(0, 10));
  };
  const copy = async () => navigator.clipboard.writeText(password);
  const toggle = (key: keyof Omit<PasswordOptions, 'length'>) => setOptions((current) => ({ ...current, [key]: !current[key] }));

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6" aria-labelledby="password-generator-title">
      <header><h1 id="password-generator-title" className="text-3xl font-bold">Password Generator</h1><p className="mt-2 text-sm opacity-75">Generate passwords locally with the browser Web Crypto API.</p></header>
      <output aria-label="Generated password" className="break-all rounded-2xl border p-5 font-mono text-xl">{password}</output>
      <div className="flex gap-3"><button type="button" className="rounded-xl border px-4 py-2" onClick={regenerate}>Generate</button><button type="button" className="rounded-xl border px-4 py-2" onClick={copy}>Copy</button></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>Length <input aria-label="Length" type="range" min="4" max="128" value={options.length} onChange={(e) => setOptions((o) => ({ ...o, length: Number(e.target.value) }))} /> <span>{options.length}</span></label>
        {(['uppercase','lowercase','numbers','symbols','excludeAmbiguous'] as const).map((key) => <label key={key} className="flex gap-2"><input type="checkbox" checked={options[key]} onChange={() => toggle(key)} />{key}</label>)}
      </div>
      <div>Strength: <strong data-testid="strength">{passwordStrength(password)}</strong></div>
      <section aria-labelledby="history-title"><h2 id="history-title" className="font-semibold">Recent generated passwords</h2><ul>{history.map((item) => <li key={item} className="break-all font-mono text-sm">{item}</li>)}</ul></section>
    </section>
  );
}
