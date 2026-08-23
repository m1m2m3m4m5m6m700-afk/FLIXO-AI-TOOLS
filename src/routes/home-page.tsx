import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TOOLS_REGISTRY } from '../config/tools';
import { SmartCommandPalette } from '../components/SmartCommandPalette';
import { getBestToolIntent } from '@/lib/intent-router';
import { HOME_EN } from '../data/home-i18n';

type ToolCardProps = {
  readonly title: string;
  readonly description: string;
  readonly category: 'Images' | 'AI' | 'Other';
  readonly path: string;
};

const READY_TOOLS = TOOLS_REGISTRY.filter((tool) => tool.isReady);

function recommendTool(file: File): ToolCardProps | null {
  const lower = file.name.toLowerCase();
  const imageTool = READY_TOOLS.find((tool) => tool.id === 'image-compressor');
  const ocrTool = READY_TOOLS.find((tool) => tool.id === 'image-ocr');
  if (file.type.startsWith('image/') && /ocr|text|scan/.test(lower)) return ocrTool ?? imageTool ?? null;
  if (file.type.startsWith('image/')) return imageTool ?? null;
  return null;
}

function ToolCard({ title, description, category, path }: ToolCardProps) {
  return (
    <Link to={path} className="home-tool-card" aria-label={`${HOME_EN.openTool}: ${title}`}>
      <div className="tool-card-topline"><span className="tool-card-category">{category}</span><span className="tool-card-arrow" aria-hidden="true">↗</span></div>
      <h3>{title}</h3><p>{description}</p><span className="tool-card-meta">{HOME_EN.browserMeta}</span>
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
        event.preventDefault(); setPaletteOpen(true);
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
    <main className="home-shell" lang={HOME_EN.language} dir={HOME_EN.dir}>
      {paletteOpen && <SmartCommandPalette onClose={() => setPaletteOpen(false)} />}
      <nav className="home-nav" aria-label={HOME_EN.ariaPrimary}>
        <div className="home-container home-nav-inner">
          <Link className="home-brand" to="/" aria-label={HOME_EN.ariaHome}>FLIXO</Link>
          <div className="home-nav-links"><a href="#tools">{HOME_EN.nav.tools}</a><a href="#categories">{HOME_EN.nav.categories}</a><a href="#privacy">{HOME_EN.nav.privacy}</a></div>
          <Link className="home-nav-language" to="/ar" lang="ar">{HOME_EN.nav.switch}</Link>
        </div>
      </nav>

      <div className="home-container home-content">
        <section className="home-hero" aria-labelledby="home-title"><div><span className="home-badge">{HOME_EN.badge}</span><p className="image-tool-eyebrow">{HOME_EN.eyebrow}</p><h1 id="home-title" dangerouslySetInnerHTML={{ __html: HOME_EN.heroTitle }} /><p className="home-lead">{HOME_EN.heroLead}</p></div><button type="button" className="home-hero-command" onClick={() => setPaletteOpen(true)}><span>{HOME_EN.describe}</span><kbd>Ctrl K</kbd></button></section>

        <section className="home-search-panel" aria-label={HOME_EN.ariaFindTool}><label className="sr-only" htmlFor="tool-search">{HOME_EN.searchLabel}</label><div className="home-search-wrap"><span className="home-search-icon" aria-hidden="true">⌕</span><input id="tool-search" ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={HOME_EN.searchPlaceholder} autoComplete="off" /><button type="button" className="search-command-button" onClick={() => setPaletteOpen(true)} aria-label={HOME_EN.smartPalette}>AI</button></div>{intent && <Link className="intent-suggestion" to={intent.tool.path}><span><strong>{HOME_EN.suggested}</strong> {intent.tool.title}</span><small>{intent.score}% match · {HOME_EN.openDirectly}</small></Link>}<div className="quick-tags" aria-label={HOME_EN.popular}>{HOME_EN.quickTags.map((tag) => <button key={tag} type="button" onClick={() => setQuery(tag)}>{tag}</button>)}</div></section>

        <section className="home-trust-grid" id="privacy" aria-label={HOME_EN.ariaTrust}>{HOME_EN.trust.map(([title, text]) => <div key={title}><strong>{title}</strong><span>{text}</span></div>)}</section>

        <section className="home-quick-drop" aria-labelledby="quick-drop-title"><div><span className="image-tool-eyebrow">{HOME_EN.quickDrop}</span><h2 id="quick-drop-title">{HOME_EN.quickDropTitle}</h2><p>{HOME_EN.quickDropLead}</p></div><label className="home-drop-zone"><input type="file" onChange={(event) => setDropRecommendation(event.target.files?.[0] ? recommendTool(event.target.files[0]) : null)} /><strong>{HOME_EN.dropChoose}</strong><span>{HOME_EN.dropSupport}</span></label>{dropRecommendation && <div className="drop-result"><div><span>{HOME_EN.suggestedTool}</span><strong>{dropRecommendation.title}</strong></div><Link className="primary-button" to={dropRecommendation.path}>{HOME_EN.openTool}</Link></div>}</section>

        <section id="tools" className="home-tools-section" aria-labelledby="tools-title"><div className="section-heading"><div><span className="image-tool-eyebrow">{HOME_EN.toolbox}</span><h2 id="tools-title">{HOME_EN.toolboxTitle}</h2></div><span className="tool-count">{filteredTools.length} {HOME_EN.ready}</span></div><div id="categories" className="category-pills" aria-label={HOME_EN.ariaCategories}>{categories.map((category) => <button key={category} type="button" className={selectedCategory === category ? 'is-active' : ''} onClick={() => setSelectedCategory(category)}>{category === 'All' ? HOME_EN.all : category}</button>)}</div><div className="home-tools-grid">{filteredTools.map((tool) => <ToolCard key={tool.id} title={tool.title} description={tool.description} category={tool.category} path={tool.path} />)}</div>{filteredTools.length === 0 && <div className="home-empty">{HOME_EN.empty}</div>}</section>

        <section className="home-final-cta"><div><span className="image-tool-eyebrow">{HOME_EN.builtForFocus}</span><h2>{HOME_EN.finalTitle}</h2><p>{HOME_EN.finalLead}</p></div><button type="button" className="primary-button" onClick={() => setPaletteOpen(true)}>{HOME_EN.trySmart}</button></section>
      </div>
    </main>
  );
}
