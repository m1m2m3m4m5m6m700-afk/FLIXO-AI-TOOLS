import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { getReadyToolConfigs } from '../config/tools';
import { getRecentTools } from '../lib/local-workspace';

export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setRecent(getRecentTools());
        setOpen((value) => !value);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const tools = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = getReadyToolConfigs();
    const ordered = [...all].sort((a, b) => {
      const ai = recent.indexOf(a.id);
      const bi = recent.indexOf(b.id);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.title.localeCompare(b.title);
    });
    return q ? ordered.filter((tool) => [tool.title, tool.description, ...(tool.aliases ?? [])].join(' ').toLowerCase().includes(q)) : ordered;
  }, [query, recent]);

  if (!open) return null;

  return (
    <div className="flixo-command-palette__backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="flixo-command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="flixo-command-palette__header">
          <span>FLIXO Command Palette</span>
          <kbd>ESC</kbd>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tools…"
          aria-label="Search tools"
        />
        <div className="flixo-command-palette__results">
          {tools.slice(0, 20).map((tool) => (
            <button
              className="flixo-command-palette__item"
              key={tool.id}
              onClick={() => {
                navigate({ to: tool.path });
                setOpen(false);
                setQuery('');
              }}
            >
              <strong>{tool.title}</strong>
              <span>{tool.category} · {tool.description}</span>
            </button>
          ))}
          {tools.length === 0 && <p className="flixo-command-palette__empty">No matching tools.</p>}
        </div>
        <div className="flixo-command-palette__footer"><span>Navigate instantly</span><kbd>Ctrl</kbd><span>+</span><kbd>K</kbd></div>
      </section>
    </div>
  );
}
