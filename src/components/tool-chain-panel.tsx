import { useEffect, useMemo, useState } from 'react';
import { getReadyToolConfigs } from '../config/tools';
import { addToolToChain, clearToolChain, getToolChain, moveToolInChain, removeToolFromChain } from '../lib/tool-chain';
import { runStoredToolChain } from '../lib/tool-chain-runner';
import './tool-chain-panel.css';

export function ToolChainPanel({ currentToolId }: { currentToolId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [chain, setChain] = useState(() => getToolChain());
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTool, setActiveTool] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const tools = useMemo(() => getReadyToolConfigs(), []);
  const selected = chain.map((step) => ({ step, tool: tools.find((tool) => tool.id === step.id) })).filter((item): item is { step: typeof chain[number]; tool: (typeof tools)[number] } => Boolean(item.tool));

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const refresh = () => setChain(getToolChain());
  const addCurrent = () => {
    if (!currentToolId) return;
    addToolToChain(currentToolId);
    refresh();
  };

  const runChain = async () => {
    if (!inputFile || selected.length === 0 || running) return;
    setRunning(true);
    setProgress(0);
    setActiveTool('');
    setError('');
    setResult(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl('');
    }
    try {
      const output = await runStoredToolChain(
        selected.map(({ step }) => step.id),
        { blob: inputFile, fileName: inputFile.name },
        (completed, total, toolId) => {
          setProgress(Math.round((completed / total) * 100));
          setActiveTool(toolId);
        },
      );
      setProgress(100);
      setActiveTool(selected[selected.length - 1]?.tool.title ?? '');
      setResult(output);
      setResultUrl(URL.createObjectURL(output.blob));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tool chain failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <aside className="flixo-chain-panel" aria-label="Tool chaining workspace">
      <div className="flixo-chain-panel__bar">
        <div>
          <strong>Tool Chain</strong>
          <span>{selected.length}/8 steps</span>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? 'Hide' : 'Open'}
        </button>
      </div>
      {open && (
        <div className="flixo-chain-panel__body">
          <div className="flixo-chain-panel__actions">
            <button type="button" onClick={addCurrent} disabled={!currentToolId || chain.some((step) => step.id === currentToolId) || selected.length >= 8}>
              + Add current tool
            </button>
            <button type="button" onClick={() => { clearToolChain(); refresh(); }} disabled={selected.length === 0}>Clear</button>
          </div>
          {selected.length === 0 ? (
            <p className="flixo-chain-panel__empty">Add tools in the order you want to process them. The chain is stored only in this browser.</p>
          ) : (
            <ol className="flixo-chain-panel__list">
              {selected.map(({ tool }, index) => (
                <li key={tool.id}>
                  <span className="flixo-chain-panel__index">{index + 1}</span>
                  <div className="flixo-chain-panel__tool"><strong>{tool.title}</strong><span>{tool.category}</span></div>
                  <div className="flixo-chain-panel__row-actions">
                    <button type="button" onClick={() => { moveToolInChain(tool.id, -1); refresh(); }} disabled={index === 0 || running} aria-label={`Move ${tool.title} up`}>↑</button>
                    <button type="button" onClick={() => { moveToolInChain(tool.id, 1); refresh(); }} disabled={index === selected.length - 1 || running} aria-label={`Move ${tool.title} down`}>↓</button>
                    <button type="button" onClick={() => { removeToolFromChain(tool.id); refresh(); }} disabled={running} aria-label={`Remove ${tool.title}`}>×</button>
                  </div>
                  {index < selected.length - 1 && <span className="flixo-chain-panel__connector" aria-hidden="true">↓</span>}
                </li>
              ))}
            </ol>
          )}
          <div className="flixo-chain-panel__runner">
            <label className="flixo-chain-panel__file">
              <span>Input file</span>
              <input type="file" accept="image/*" disabled={running} onChange={(event) => { setInputFile(event.target.files?.[0] ?? null); setError(''); setResult(null); }} />
            </label>
            <button type="button" className="flixo-chain-panel__run" onClick={() => void runChain()} disabled={!inputFile || selected.length === 0 || running}>
              {running ? `Processing… ${progress}%` : 'Run chain locally'}
            </button>
            {activeTool && <div className="flixo-chain-panel__progress" role="status">Current step: {activeTool}</div>}
            {error && <div className="flixo-chain-panel__error" role="alert">{error}</div>}
            {result && resultUrl && (
              <div className="flixo-chain-panel__result">
                <span>Output ready: {result.fileName}</span>
                <a href={resultUrl} download={result.fileName}>Download result</a>
              </div>
            )}
          </div>
          <div className="flixo-chain-panel__status" role="status">
            <strong>Execution contract:</strong> local adapters only. Unsupported steps fail explicitly; no file is uploaded by the chain runner.
          </div>
        </div>
      )}
    </aside>
  );
}
