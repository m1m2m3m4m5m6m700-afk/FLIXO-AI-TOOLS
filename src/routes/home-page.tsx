import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TOOLS_REGISTRY } from '../config/tools';
import { SmartCommandPalette } from '../components/SmartCommandPalette';
import { getBestToolIntent } from '@/lib/intent-router';

type ToolCardProps = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: 'Images' | 'AI' | 'Other';
  readonly path: string;
};

const READY_TOOLS = TOOLS_REGISTRY.filter((tool) => tool.isReady);
const QUICK_TAGS = ['Image compressor', 'Background remover', 'OCR', 'PDF', 'AI image'];

function recommendTool(file: File): ToolCardProps | null {
  const lower = file.name.toLowerCase();
  const imageTool = READY_TOOLS.find((tool) => tool.id === 'image-compressor');
  const ocrTool = READY_TOOLS.find((tool) => tool.id === 'image-ocr');
  if (file.type.startsWith('image/') && /ocr|text|scan/.test(lower)) return ocrTool ?? imageTool ?? null;
  if (file.type.startsWith('image/')) return imageTool ?? null;
  return null;
}

function ToolCard({ id, title, description, category, path }: ToolCardProps) {
  return (
    <Link to={path} className="home-tool-card" aria-label={`Open ${title}`}>
      <div className="tool-card-topline">
        <span className="tool-card-category">{category}</span>
        <span className="tool-card-arrow" aria-hidden="true">↗</span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="tool-card-meta">Browser-first · Instant start</span>
    </Link>
  );
}

export function HomePage() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dropRecommendation, setDropRecommendation] = useState<ToolCardProps | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const intent = useMemo(() => getBestToolIntent(query, READY_TOOLS), [query]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(READY_TOOLS.map((tool) => tool.category)))], []);
  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return READY_TOOLS.filter((tool) => {
      const matchesCategory = selectedCategory === 'All' || tool.category === selectedCategory;
      const haystack = `${tool.id} ${tool.title} ${tool.description}`.toLowerCase();
      return matchesCategory && (!normalized || haystack.includes(normalized));
    });
  }, [query, selectedCategory]);

  return (
    <main className="home-shell">
      {paletteOpen && <SmartCommandPalette onClose={() => setPaletteOpen(false)} />}
      <nav className="home-nav" aria-label="Primary navigation">
        <div className="home-container home-nav-inner">
          <Link className="home-brand" to="/" aria-label="FLIXO home">FLIXO</Link>
          <div className="home-nav-links">
            <a href="#tools">Tools</a>
            <a href="#categories">Categories</a>
            <a href="#privacy">Privacy</a>
          </div>
          <a className="home-nav-language" href="/ar/" lang="ar">العربية</a>
        </div>
      </nav>

      <div className="home-container home-content">
        <section className="home-hero" aria-labelledby="home-title">
          <div>
            <span className="home-badge">Privacy-first · Browser-first</span>
            <p className="image-tool-eyebrow">FLIXO · SMART TOOLBOX</p>
            <h1 id="home-title">The right tool, <span>without the detour.</span></h1>
            <p className="home-lead">Find the job, open the tool, finish fast. FLIXO keeps the experience focused and uses local browser processing where the tool supports it.</p>
          </div>
          <button type="button" className="home-hero-command" onClick={() => setPaletteOpen(true)}>
            <span>Describe a task</span><kbd>Ctrl K</kbd>
          </button>
        </section>

        <section className="home-search-panel" aria-label="Find a tool">
          <label className="sr-only" htmlFor="tool-search">Search tools</label>
          <div className="home-search-wrap">
            <span className="home-search-icon" aria-hidden="true">⌕</span>
            <input
              id="tool-search"
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What do you need to do? Try “compress image”"
              autoComplete="off"
            />
            <button type="button" className="search-command-button" onClick={() => setPaletteOpen(true)} aria-label="Open smart command palette">AI</button>
          </div>
          {intent && (
            <Link className="intent-suggestion" to={intent.tool.path}>
              <span><strong>Suggested:</strong> {intent.tool.title}</span>
              <small>{intent.score}% match · open directly</small>
            </Link>
          )}
          <div className="quick-tags" aria-label="Popular searches">
            {QUICK_TAGS.map((tag) => <button key={tag} type="button" onClick={() => setQuery(tag)}>{tag}</button>)}
          </div>
        </section>

        <section className="home-trust-grid" id="privacy" aria-label="Trust signals">
          <div><strong>Browser-first</strong><span>Local processing where supported by the tool.</span></div>
          <div><strong>Fast to start</strong><span>Direct routes with no unnecessary onboarding wall.</span></div>
          <div><strong>Smart routing</strong><span>Common tasks can jump straight to the best ready tool.</span></div>
        </section>

        <section className="home-quick-drop" aria-labelledby="quick-drop-title">
          <div>
            <span className="image-tool-eyebrow">QUICK-DROP</span>
            <h2 id="quick-drop-title">Drop a file. We’ll point you to the right tool.</h2>
            <p>FLIXO does not upload your file from the homepage. It only inspects the file type locally to recommend an existing tool.</p>
          </div>
          <label className="home-drop-zone">
            <input
              type="file"
              onChange={(event) => setDropRecommendation(event.target.files?.[0] ? recommendTool(event.target.files[0]) : null)}
            />
            <strong>Drop or choose a file</strong>
            <span>Images are currently supported for smart recommendations.</span>
          </label>
          {dropRecommendation && (
            <div className="drop-result">
              <div><span>Suggested tool</span><strong>{dropRecommendation.title}</strong></div>
              <Link className="primary-button" to={dropRecommendation.path}>Open tool</Link>
            </div>
          )}
        </section>

        <section id="tools" className="home-tools-section" aria-labelledby="tools-title">
          <div className="section-heading">
            <div>
              <span className="image-tool-eyebrow">TOOLBOX</span>
              <h2 id="tools-title">Start with the tools people actually need.</h2>
            </div>
            <span className="tool-count">{filteredTools.length} ready</span>
          </div>

          <div id="categories" className="category-pills" aria-label="Tool categories">
            {categories.map((category) => (
              <button key={category} type="button" className={selectedCategory === category ? 'is-active' : ''} onClick={() => setSelectedCategory(category)}>{category}</button>
            ))}
          </div>

          <div className="home-tools-grid">
            {filteredTools.map((tool) => <ToolCard key={tool.id} id={tool.id} title={tool.title} description={tool.description} category={tool.category} path={tool.path} />)}
          </div>
          {filteredTools.length === 0 && <div className="home-empty">No matching tool yet. Try a simpler phrase or open Smart Intent with Ctrl K.</div>}
        </section>

        <section className="home-final-cta">
          <div>
            <span className="image-tool-eyebrow">BUILT FOR FOCUS</span>
            <h2>One search. One useful result.</h2>
            <p>FLIXO is designed to get you from intent to action without turning a simple task into a workflow.</p>
          </div>
          <button type="button" className="primary-button" onClick={() => setPaletteOpen(true)}>Try Smart Intent</button>
        </section>
      </div>
    </main>
  );
}
