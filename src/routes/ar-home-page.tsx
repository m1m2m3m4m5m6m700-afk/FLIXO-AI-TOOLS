import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { SmartCommandPalette } from '../components/SmartCommandPalette';
import { TOOLS_REGISTRY } from '../config/tools';
import { getBestToolIntent } from '../lib/intent-router';
import { HOME_AR } from '../data/home-i18n';

type ToolCard = {
  title: string;
  description: string;
  category: 'Images' | 'AI' | 'Other';
  path: string;
};

const READY_TOOLS = TOOLS_REGISTRY.filter((tool) => tool.isReady);
const AR_CATEGORY: Record<ToolCard['category'], string> = {
  Images: 'الصور',
  AI: 'الذكاء الاصطناعي',
  Other: 'أخرى',
};

function localTool(tool: (typeof READY_TOOLS)[number]): ToolCard {
  return {
    title: HOME_AR.tools[tool.id as keyof typeof HOME_AR.tools] ?? tool.title,
    description: tool.description,
    category: tool.category,
    path: tool.path.replace(/^\/en\//, '/ar/'),
  };
}

function recommendTool(file: File): ToolCard | null {
  const lower = file.name.toLowerCase();
  const imageTool = READY_TOOLS.find((tool) => tool.id === 'image-compressor');
  const ocrTool = READY_TOOLS.find((tool) => tool.id === 'image-ocr');
  if (!file.type.startsWith('image/')) return null;
  return localTool((/ocr|text|scan/.test(lower) ? ocrTool : imageTool) ?? imageTool ?? READY_TO_TOOLS[0]);
}

export function ArHomePage() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dropRecommendation, setDropRecommendation] = useState<ToolCard | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const intent = useMemo(() => getBestToolIntent(query, READY_TOOLS), [query]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(READY_TOOLS.map((tool) => tool.category)))], []);
  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return READY_TOOLS.filter((tool) => {
      const matchesCategory = selectedCategory === 'All' || selectedCategory === tool.category;
      const haystack = `${tool.id} ${tool.title} ${tool.description}`.toLowerCase();
      return matchesCategory && (!normalized || haystack.includes(normalized));
    }).map(localTool);
  }, [query, selectedCategory]);

  return (
    <main className="home-shell" dir="rtl" lang="ar">
      {paletteOpen && <SmartCommandPalette onClose={() => setPaletteOpen(false)} />}
      <nav className="home-nav" aria-label={HOME_AR.ariaPrimary}>
        <div className="home-container home-nav-inner">
          <Link className="home-brand" to="/" aria-label={HOME_AR.ariaHome}>FLIXO</Link>
          <div className="home-nav-links">
            <a href="#tools">{HOME_AR.nav.tools}</a>
            <a href="#categories">{HOME_AR.nav.categories}</a>
            <a href="#privacy">{HOME_AR.nav.privacy}</a>
          </div>
          <a className="home-nav-language" href="/" lang="en">{HOME_AR.nav.switch}</a>
        </div>
      </nav>

      <div className="home-container home-content">
        <section className="home-hero" aria-labelledby="home-title">
          <div>
            <span className="home-badge">{HOME_AR.badge}</span>
            <p className="image-tool-eyebrow">{HOME_AR.eyebrow}</p>
            <h1 id="home-title" dangerouslySetInnerHTML={{ __html: HOME_AR.heroTitle }} />
            <p className="home-lead">{HOME_AR.heroLead}</p>
          </div>
          <button type="button" className="home-hero-command" onClick={() => setPaletteOpen(true)}>
            <span>{HOME_AR.describe}</span><kbd>Ctrl K</kbd>
          </button>
        </section>

        <section className="home-search-panel" aria-label={HOME_AR.ariaFindTool}>
          <label className="sr-only" htmlFor="ar-tool-search">{HOME_AR.searchLabel}</label>
          <div className="home-search-wrap">
            <span className="home-search-icon" aria-hidden="true">⌕</span>
            <input id="ar-tool-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={HOME_AR.searchPlaceholder} autoComplete="off" />
            <button type="button" className="search-command-button" onClick={() => setPaletteOpen(true)} aria-label={HOME_AR.smartPalette}>AI</button>
          </div>
          {intent && (
            <Link className="intent-suggestion" to={intent.tool.path.replace(/^\/en\//, '/ar/')}>
              <span><strong>{HOME_AR.suggested}</strong> {HOME_AR.tools[intent.tool.id as keyof typeof HOME_AR.tools] ?? intent.tool.title}</span>
              <small>{intent.score}% · {HOME_AR.openDirectly}</small>
            </Link>
          )}
          <div className="quick-tags" aria-label={HOME_AR.popular}>
            {HOME_AR.quickTags.map((tag) => <button key={tag} type="button" onClick={() => setQuery(tag)}>{tag}</button>)}
          </div>
        </section>

        <section className="home-trust-grid" id="privacy" aria-label={HOME_AR.ariaTrust}>
          {HOME_AR.trust.map(([title, text]) => <div key={title}><strong>{title}</strong><span>{text}</span></div>)}
        </section>

        <section className="home-quick-drop" aria-labelledby="quick-drop-title">
          <div>
            <span className="image-tool-eyebrow">{HOME_AR.quickDrop}</span>
            <h2 id="quick-drop-title">{HOME_AR.quickDropTitle}</h2>
            <p>{HOME_AR.quickDropLead}</p>
          </div>
          <label className="home-drop-zone">
            <input type="file" onChange={(event) => setDropRecommendation(event.target.files?.[0] ? recommendTool(event.target.files[0]) : null)} />
            <strong>{HOME_AR.dropChoose}</strong>
            <span>{HOME_AR.dropSupport}</span>
          </label>
          {dropRecommendation && <div className="drop-result"><div><span>{HOME_AR.suggestedTool}</span><strong>{dropRecommendation.title}</strong></div><Link className="primary-button" to={dropRecommendation.path}>{HOME_AR.openTool}</Link></div>}
        </section>

        <section id="tools" className="home-tools-section" aria-labelledby="tools-title">
          <div className="section-heading">
            <div><span className="image-tool-eyebrow">{HOME_AR.toolbox}</span><h2 id="tools-title">{HOME_AR.toolboxTitle}</h2></div>
            <span className="tool-count">{filteredTools.length} {HOME_AR.ready}</span>
          </div>
          <div id="categories" className="category-pills" aria-label={HOME_AR.ariaCategories}>
            {categories.map((category) => <button key={category} type="button" className={selectedCategory === category ? 'is-active' : ''} onClick={() => setSelectedCategory(category)}>{category === 'All' ? HOME_AR.all : AR_CATEGORY[category as ToolCard['category']]}</button>)}
          </div>
          <div className="home-tools-grid">
            {filteredTools.map((tool) => <Link key={tool.path} to={tool.path} className="home-tool-card" aria-label={`${HOME_AR.openTool} ${tool.title}`}><div className="tool-card-topline"><span className="tool-card-category">{AR_CATEGORY[tool.category]}</span><span className="tool-card-arrow" aria-hidden="true">↗</span></div><h3>{tool.title}</h3><p>{tool.description}</p><span className="tool-card-meta">{HOME_AR.browserMeta}</span></Link>)}
          </div>
          {filteredTools.length === 0 && <div className="home-empty">{HOME_AR.empty}</div>}
        </section>

        <section className="home-final-cta">
          <div><span className="image-tool-eyebrow">{HOME_AR.builtForFocus}</span><h2>{HOME_AR.finalTitle}</h2><p>{HOME_AR.finalLead}</p></div>
          <button type="button" className="primary-button" onClick={() => setPaletteOpen(true)}>{HOME_AR.trySmart}</button>
        </section>
      </div>
    </main>
  );
}
