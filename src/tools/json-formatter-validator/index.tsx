import React, { useMemo, useState } from 'react';
import { buildJsonTree, formatJson, minifyJson, toCsv, toYaml, validateJson } from './engine';

const DEFAULT_JSON = '{\n  "name": "FLIXO",\n  "tools": 20,\n  "ready": true\n}';

type TreeNodeProps = { value: unknown; depth?: number };
const TreeNode = ({ value, depth = 0 }: TreeNodeProps) => {
  if (value && typeof value === 'object') {
    const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value as Record<string, unknown>);
    return <div style={{ marginLeft: depth * 12 }}>{entries.map(([key, child]) => <div key={`${depth}-${key}`}><span className="font-medium">{key}:</span>{' '}{child && typeof child === 'object' ? <TreeNode value={child} depth={depth + 1} /> : <span>{JSON.stringify(child)}</span>}</div>)}</div>;
  }
  return <span>{JSON.stringify(value)}</span>;
};

export function JsonFormatterValidatorTool() {
  const [input, setInput] = useState(DEFAULT_JSON);
  const [output, setOutput] = useState(DEFAULT_JSON);
  const [spaces, setSpaces] = useState<2 | 4>(2);
  const [mode, setMode] = useState<'editor' | 'tree'>('editor');
  const [format, setFormat] = useState<'json' | 'yaml' | 'csv'>('json');
  const validation = useMemo(() => validateJson(input), [input]);
  const parsedValue = useMemo(() => validation.valid ? JSON.parse(input) as unknown : null, [input, validation.valid]);

  const run = (action: 'pretty' | 'minify' | 'yaml' | 'csv') => {
    if (!validation.valid) { setOutput(validation.error ?? 'Invalid JSON'); return; }
    try {
      if (action === 'pretty') { setOutput(formatJson(input, spaces)); setFormat('json'); }
      else if (action === 'minify') { setOutput(minifyJson(input)); setFormat('json'); }
      else if (action === 'yaml') { setOutput(toYaml(input)); setFormat('yaml'); }
      else { setOutput(toCsv(input)); setFormat('csv'); }
    } catch (error) { setOutput(error instanceof Error ? error.message : 'Conversion failed'); }
  };
  const copyOutput = async () => navigator.clipboard.writeText(output);
  const downloadOutput = () => {
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `flixo-output.${format}`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <main className="mx-auto max-w-6xl space-y-6 p-6">
    <header><h1 className="text-3xl font-bold">JSON Formatter &amp; Validator</h1><p className="mt-2 opacity-80">Format, validate, inspect, convert, copy, and download JSON locally.</p></header>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => run('pretty')}>Prettify</button><button type="button" onClick={() => run('minify')}>Minify</button><button type="button" onClick={() => run('yaml')}>YAML</button><button type="button" onClick={() => run('csv')}>CSV</button>
      <label className="flex items-center gap-2">Spaces<select value={spaces} onChange={(event) => setSpaces(Number(event.target.value) as 2 | 4)}><option value="2">2</option><option value="4">4</option></select></label>
      <button type="button" onClick={() => setMode((current) => current === 'editor' ? 'tree' : 'editor')}>{mode === 'editor' ? 'Tree View' : 'Editor View'}</button><button type="button" onClick={copyOutput}>Copy</button><button type="button" onClick={downloadOutput}>Download</button>
    </div>
    <section className="grid gap-6 md:grid-cols-2">
      <div><label htmlFor="json-input" className="mb-2 block font-semibold">JSON Input</label><textarea id="json-input" aria-label="JSON input" className="min-h-[420px] w-full rounded border p-4 font-mono" value={input} onChange={(event) => setInput(event.target.value)} />{validation.valid ? <p className="mt-2 text-sm">Valid JSON</p> : <p className="mt-2 text-sm">Invalid JSON{validation.line ? ` — line ${validation.line}, column ${validation.column ?? 1}` : ''}: {validation.error}</p>}</div>
      <div><label htmlFor="json-output" className="mb-2 block font-semibold">Output</label><textarea id="json-output" aria-label="JSON output" className="min-h-[420px] w-full rounded border p-4 font-mono" readOnly value={output} />{mode === 'tree' && <div aria-label="JSON tree" className="mt-3 min-h-[120px] rounded border p-4">{parsedValue !== null ? <TreeNode value={buildJsonTree(parsedValue).value} /> : <p>{validation.error}</p>}</div>}</div>
    </section>
  </main>;
}
