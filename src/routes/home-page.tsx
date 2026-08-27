import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TOOLS_REGISTRY } from '../config/tools';
import { SmartCommandPalette } from '../components/SmartCommandPalette';
import { getBestToolIntent } from '@/lib/intent-router';
import { loadHomeCopy } from '@/lib/i18n/home-loader';
import { LOCALES } from '@/lib/i18n';
import type { HomeCopy } from '../data/home-locales';
import type { Locale } from '@/lib/i18n';

type ToolCardProps = { readonly title: string; readonly description: string; readonly category: 'Images' | 'AI' | 'Other'; readonly path: string };
const READY_TOOLS = TOOLS_REGISTRY.filter((tool) => tool.isReady);
const LANGUAGE_LABELS: Record<Locale, string> = { en: 'English', ar: 'العربية', es: 'Español', fr: 'Français', de: 'Deutsch', ru: 'Русский', zh: '中文', hi: 'हिन्दी', id: 'Bahasa Indonesia', ur: 'اردو', ja: '日本語', pt: 'Português', it: 'Italiano', ko: '한국어', nl: 'Nederlands', pl: 'Polski', tr: 'Türkçe', vi: 'Tiếng Việt', th: 'ไทย', sv: 'Svenska' };
function recommendTool(file: File): ToolCardProps | null {
  const lower = file.name.toLowerCase();
  const imageTool = READY_TOOLS.find((tool) => tool.id === 'image-compressor');
  const ocrTool = READY_TOOLS.find((tool) => tool.id === 'image-ocr');
  if (file.type.startsWith('image/') && /ocr|text|scan/.test(lower)) return ocrTool ?? imageTool ?? null;
  if (file.type.startsWith('image/')) return imageTool ?? null;
  return null;
}

export function HomePage({ locale = 'en' as Locale }: { locale?: Locale }) {
  const navigate = useNavigate();
  const [copy, setCopy] = useState<HomeCopy | null>(null);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dropRecommendation, setDropRecommendation] = useState<ToolCardProps | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void loadHomeCopy(locale).then((nextCopy) => {
      if (active) setCopy(nextCopy);
    });
    return () => {
      active = false;
    };
  }, [locale]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const intent = useMemo(() => getBestToolIntent(query, READY_TO_TOOLS), [query]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(READY_TOOLS.map((tool) => tool.category)))], []);
  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return READY_TO_TOOLS.filter((tool) => {
      const matchesCategory = selectedCategory === 'All' || tool.category === selectedCategory;
      const haystack = `${tool.id} ${tool.title} ${tool.description}`.toLowerCase();
      return matchesCategory && (!normalized || haystack.includes(normalized));
    });
  }, [query, selectedCategory]);

  if (!copy) {
    return <main className="home-shell" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} aria-busy="true" />;
  }

  return (
    <main className="home-shell" lang={copy.language} dir={copy.dir}>
      {paletteOpen && <SmartCommandPalette onClose={() => setPaletteOpen(false)} />}
      <nav className="home-nav" aria-label={copy.ariaPrimary}>
        <div className="home-container home-nav-inner">
          <Link className="home-brand" to="/" aria-label={copy.ariaHome}>FLIXO</Link>
          <div className="home-nav-links"><a href="#tools">{copy.nav.tools}</a><a href="#categories">{copy.nav.categories}</a><a href="#privacy">{copy.nav.privacy}</a></div>
          <label className="sr-only" htmlFor="home-language">{copy.nav.switch}</label><select id="home-language" className="home-nav-language" value={locale} aria-label={copy.nav.switch} onChange={(event) => { void navigate({ to: `/${event.target.value}` }); }}>{LOCALES.map((code) => <option key={code} value={code}>{LANGUAGE_LABELS[code]}</option>)}</select>
        </div>
      </nav>
      <div className="home-container home-content">
        <section className="home-hero" aria-labelledby="home-title"><div><span className="home-badge">{copy.badge}</span><p className="image-tool-eyebrow">{copy.eyebrow}</p><h1 id="home-title" dangerouslySetInnerHTML={{ __html: copy.heroTitle }} /><p className="home-lead">{copy.heroLead}</p></div><button type="button" className="home-hero-command" onClick={() => setPaletteOpen(true)}><span>{copy.describe}</span><kbd>Ctrl K</kbd></button></section>
        <section className="home-search-panel" aria-label={copy.ariaFindTool}><label className="sr-only" htmlFor="tool-search">{copy.searchLabel}</label><div className="home-search-wrap"><span className="home-search-icon" aria-hidden="true">⌕</span><input id="tool-search" ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} autoComplete="off" /><button type="button" className="search-command-button" onClick={() => setPaletteOpen(true)} aria-label={copy.smartPalette}>AI</button></div>{intent && <Link className="intent-suggestion" to={intent.tool.path}><span><strong>{copy.suggested}</strong> {intent.tool.title}</span><small>{intent.score}% · {copy.openDirectly}</small></Link>}<div className="quick-tags" aria-label={copy.popular}>{copy.quickTags.map((tag) => <button key={tag} type="button" onClick={() => setQuery(tag)}>{tag}</button>)}</div></section>
        <section className="home-trust-grid" id="privacy" aria-label={copy.ariaTrust}>{copy.trust.map(([title, text]) => <div key={title}><strong>{title}</strong><span>{text}</span></div>)}</section>
        <section className="home-quick-drop" aria-labelledby="quick-drop-title"><div><span className="image-tool-eyebrow">{copy.quickDrop}</span><h2 id="quick-drop-title">{copy.quickDropTitle}</h2><p>{copy.quickDropLead}</p></div><label className="home-drop-zone"><input type="file" onChange={(event) => setDropRecommendation(event.target.files?.[0] ? recommendTool(event.target.files[0]) : null)} /><strong>{copy.dropChoose}</strong><span>{copy.dropSupport}</span></label>{dropRecommendation && <div className="drop-result"><div><span>{copy.suggestedTool}</span><strong>{dropRecommendation.title}</strong></div><Link className="primary-button" to={dropRecommendation.path}>{copy.openTool}</Link></div>}</section>
        <section id="tools" className="home-tools-section" aria-labelledby="tools-title"><div className="section-heading"><div><span className="image-tool-eyebrow">{copy.toolbox}</span><h2 id="tools-title">{copy.toolboxTitle}</h2></div><span className="tool-count">{filteredTools.length} {copy.ready}</span></div><div id="categories" className="category-pills" aria-label={copy.ariaCategories}>{categories.map((category) => <button key={category} type="button" className={selectedCategory === category ? 'is-active' : ''} onClick={() => setSelectedCategory(category)}>{category === 'All' ? copy.all : category}</button>)}</div><div className="home-tools-grid">{filteredTools.map((tool) => <Link key={tool.id} to={tool.path} className="home-tool-card" aria-label={`${copy.openTool}: ${tool.title}`}><div className="tool-card-topline"><span className="tool-card-category">{tool.category}</span><span className="tool-card-arrow" aria-hidden="true">↗</span></div><h3>{tool.title}</h3><p>{tool.description}</p><span className="tool-card-meta">{copy.browserMeta}</span></Link>)}</div>{filteredTools.length === 0 && <div className="home-empty">{copy.empty}</div>}</section>
        <section className="home-final-cta"><div><span className="image-tool-eyebrow">{copy.builtForFocus}</span><h2>{copy.finalTitle}</h2><p>{copy.finalLead}</p></div><button type="button" className="primary-button" onClick={() => setPaletteOpen(true)}>{copy.trySmart}</button></section>
      </div>
    </main>
  );
}
