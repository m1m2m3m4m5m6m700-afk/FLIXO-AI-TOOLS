import { useMemo, useState } from 'react';
import { getReadyToolConfigs } from '../config/tools';
import { addToolToChain, clearToolChain, getToolChain, moveToolInChain, removeToolFromChain } from '../lib/tool-chain';
import './tool-chain-panel.css';

export function ToolChainPanel({ currentToolId }: { currentToolId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [chain, setChain] = useState(() => getToolChain());
  const tools = useMemo(() => getReadyToolConfigs(), []);
  const selected = chain.map((step) => ({ step, tool: tools.find((tool) => tool.id === step.id) })).filter((item): item is { step: typeof chain[number]; tool: (typeof tools)[number] } => Boolean(item.tool));

  const refresh = () => setChain(getToolChain());
  const addCurrent = () => {
    if (!currentToolId) return;
    addToolToChain(currentToolId);
    refresh();
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
                    <button type="button" onClick={() => { moveToolInChain(tool.id, -1); refresh(); }} disabled={index === 0} aria-label={`Move ${tool.title} up`}>↑</button>
                    <button type="button" onClick={() => { moveToolInChain(tool.id, 1); refresh(); }} disabled={index === selected.length - 1} aria-label={`Move ${tool.title} down`}>↓</button>
                    <button type="button" onClick={() => { removeToolFromChain(tool.id); refresh(); }} aria-label={`Remove ${tool.title}`}>×</button>
                  </div>
                  {index < selected.length - 1 && <span className="flixo-chain-panel__connector" aria-hidden="true">↓</span>}
                </li>
              ))}
            </ol>
          )}
          <div className="flixo-chain-panel__status" role="status">
            <strong>Execution contract:</strong> composer only. A step runs only after a tool-specific local adapter exists, so the UI never pretends to execute an unsupported pipeline.
          </div>
        </div>
      )}
    </aside>
  );
}
