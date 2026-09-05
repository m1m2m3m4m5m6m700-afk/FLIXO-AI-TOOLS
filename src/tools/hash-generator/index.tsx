import { useMemo, useState } from 'react';
import { HASH_ALGORITHMS, hashText, type HashAlgorithm } from './engine';

export function HashGeneratorTool() {
  const [text, setText] = useState('');
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA-256');
  const [result, setResult] = useState('');
  const [status, setStatus] = useState('Ready');
  const byteCount = useMemo(() => new TextEncoder().encode(text).byteLength, [text]);

  async function generate() {
    setStatus('Hashing…');
    try {
      setResult(await hashText(text, algorithm));
      setStatus('Done');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Hashing failed.');
    }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setStatus('Copied');
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Hash Generator</h1>
        <p className="text-sm opacity-70">Generate SHA hashes locally with Web Crypto.</p>
      </header>
      <textarea className="min-h-48 w-full rounded border p-3" value={text} onChange={(event) => setText(event.target.value)} placeholder="Enter text to hash…" aria-label="Text to hash" />
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">Algorithm
          <select className="ml-2 rounded border px-3 py-2" value={algorithm} onChange={(event) => setAlgorithm(event.target.value as HashAlgorithm)}>
            {HASH_ALGORITHMS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <span className="text-sm opacity-70">{byteCount} bytes</span>
      </div>
      <div className="flex gap-3"><button className="rounded bg-black px-4 py-2 text-white" onClick={generate}>Generate</button><button className="rounded border px-4 py-2" disabled={!result} onClick={copy}>Copy</button></div>
      <output className="block break-all rounded border p-4 font-mono text-sm" aria-label="Hash result">{result}</output>
      <p className="text-sm" aria-live="polite">{status}</p>
    </section>
  );
}
