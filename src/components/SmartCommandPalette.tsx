import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { getReadyToolConfigs } from '@/config/tools';
import { findToolIntent } from '@/lib/intent-router';

type SmartCommandPaletteProps = {
  readonly onClose: () => void;
};

export function SmartCommandPalette({ onClose }: SmartCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => findToolIntent(query, getReadyToolConfigs()), [query]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="smart-palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="smart-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="smart-palette-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="smart-palette-header">
          <div>
            <span className="image-tool-eyebrow">SMART INTENT</span>
            <h2 id="smart-palette-title">Tell FLIXO what you need.</h2>
          </div>
          <button type="button" className="smart-palette-close" onClick={onClose} aria-label="Close">Esc</button>
        </div>

        <label className="sr-only" htmlFor="smart-command-input">Describe the task</label>
        <input
          ref={inputRef}
          id="smart-command-input"
          className="smart-palette-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="e.g. compress image, extract text, remove background"
          autoComplete="off"
        />

        <div className="smart-palette-results" aria-live="polite">
          {results.length > 0 ? results.map(({ tool, score }) => (
            <Link key={tool.id} to={tool.path} className="smart-result" onClick={onClose}>
              <span>
                <strong>{tool.title}</strong>
                <small>{tool.description}</small>
              </span>
              <span className="smart-score">{score}% match</span>
            </Link>
          )) : (
            <div className="smart-empty">Start with a task, not an exact tool name.</div>
          )}
        </div>
      </section>
    </div>
  );
}
