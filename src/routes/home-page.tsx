import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TOOLS_REGISTRY } from '../config/tools';
import { SmartCommandPalette } from '../components/SmartCommandPalette';
import { getBestToolIntent } from '@/lib/intent-router';
import { loadHomeCopy } from '@/lib/i18n/home-loader';
import { getAuthoritativeToolSeoName } from '@/config/tool-seo-name-resolver';
import { localizeMsUkCategory, localizeMsUkDescription } from '@/lib/i18n/ms-uk-category';
import { LOCALE_METADATA, LOCALES } from '@/lib/i18n';
import { localizeToolCategory, localizeToolDescription } from '@/lib/i18n/tool-localization';
import type { HomeCopy } from '../data/home-locales';
import type { Locale } from '@/lib/i18n';
import type { ToolConfig } from '../config/tools';

type ToolCardProps = { readonly id: string; readonly title: string; readonly description: string; readonly category: 'Images' | 'AI' | 'Other'; readonly categoryLabel: string; readonly path: string };
const READY_TOOLS = TOOLS_REGISTRY.filter((tool) => tool.isReady);
const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', es: 'Español', fr: 'Français', de: 'Deutsch', hi: 'हिन्दी', id: 'Bahasa Indonesia',
  it: 'Italiano', ja: '日本語', ko: '한국어', ms: 'Bahasa Melayu', nl: 'Nederlands', pl: 'Polski', pt: 'Português',
  ru: 'Русский', sv: 'Svenska', th: 'ไทย', tr: 'Türkçe', uk: 'Українська', vi: 'Tiếng Việt',
};

function toLocalizedTool(tool: ToolConfig, locale: Locale): ToolCardProps {
  const localizedTitle = getAuthoritativeToolSeoName(tool, locale) ?? tool.title;
  const localizedCategory = localizeMsUkCategory(locale, tool.category) ?? localizeToolCategory(locale, tool.category);
  const localizedDescription = localizeMsUkDescription(locale, localizedTitle) ?? localizeToolDescription(locale, localizedTitle, tool.category);
  return {
    id: tool.id,
    title: localizedTitle,
    description: localizedDescription,
    category: tool.category,
    categoryLabel: localizedCategory,
    path: `/${locale}/${tool.id}`,
  };
}

function recommendTool(file: File, locale: Locale): ToolCardProps | null {
  const lower = file.name.toLowerCase();
  const imageTool = READY_TOOLS.find((tool) => tool.id === 'image-compressor');
  const ocrTool = READY_TOOLS.find((tool) => tool.id === 'image-ocr');
  const selected = file.type.startsWith('image/') && /ocr|text|scan/.test(lower) ? ocrTool ?? imageTool : file.type.startsWith('image/') ? imageTool : null;
  return selected ? toLocalizedTool(selected, locale) : null;
}

export function HomePage({ locale = 'en' as Locale }: { locale?: Locale }) {
  const navigate = useNavigate();
  const [copy, setCopy] = useState<HomeCopy | null>(null);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dropRecommendation, setDropRecommendation] = useState<ToolCardProps | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void loadHomeCopy(locale).then((nextCopy) => { if (active) setCopy(nextCopy); });
    return () => { active = false; };
  }, [locale]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen(true); }
      if (event.key === 'Escape') setLanguageMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const localizedTools = useMemo(() => READY_TOOLS.map((tool) => toLocalizedTool(tool, locale)), [locale]);
  const intent = useMemo(() => getBestToolIntent(query, READY_TOOLS), [query]);
  const intentLocalized = intent ? toLocalizedTool(intent.tool, locale) : null;
  const categories = useMemo(() => ['All', ...Array.from(new Set(localizedTools.map((tool) => tool.category)))], [localizedTools]);
  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return localizedTools.filter((tool) => {
      const matchesCategory = selectedCategory === 'All' || tool.category === selectedCategory;
      const haystack = `${tool.id} ${tool.title} ${tool.description} ${tool.categoryLabel}`.toLowerCase();
      return matchesCategory && (!normalized || haystack.includes(normalized));
    });
  }, [localizedTools, query, selectedCategory]);

  const localeMetadata = LOCALE_METADATA[locale];

  if (!copy) return <main className="home-shell" lang={localeMetadata.languageTag} dir={localeMetadata.direction} aria-busy="true" />;

  return (
    <main className="home-shell" lang={localeMetadata.languageTag} dir={localeMetadata.direction}>
      {paletteOpen && <SmartCommandPalette onClose={() => setPaletteOpen(false)} />}
      <nav className="home-nav" aria-label={copy.ariaPrimary}>
        <div className="home-container home-nav-inner">
          <Link className="home-brand" to="/" aria-label={copy.ariaHome}>FLIXO</Link>
          <div className="home-nav-links"><a href="#tools">{copy.nav.tools}</a><a href="#categories">{copy.nav.categories}</a><a href="#privacy">{copy.nav.privacy}</a></div>
          <div className="home-language-switcher">
            <button
              type="button"
              className="home-nav-language"
              aria-label={copy.nav.switch}
              aria-haspopup="listbox"
              aria-expanded={languageMenuOpen}
              onClick={() => setLanguageMenuOpen((open) => !open)}
            >
              {LANGUAGE_LABELS[locale] ?? localeMetadata.languageTag}
            </button>
            {languageMenuOpen && (
              <div className="home-language-menu" role="listbox" aria-label={copy.nav.switch}>
                {LOCALES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    role="option"
                    aria-selected={code === locale}
                    className="home-language-option"
                    onClick={() => {
                      setLanguageMenuOpen(false);
                      void navigate({ to: `/${code}` });
                    }}
                  >
                    {LANGUAGE_LABELS[code] ?? code}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>
      <div className="home-container home-content">
        <section className="home-hero" aria-labelledby="home-title"><div><span className="home-badge">{copy.badge}</span><p className="image-tool-eyebrow">{copy.eyebrow}</p><h1 id="home-title" dangerouslySetInnerHTML={{ __html: copy.heroTitle }} /><p className="home-lead">{copy.heroLead}</p></div><button type="button" className="home-hero-command" onClick={() => setPaletteOpen(true)}><span>{copy.describe}</span><kbd>Ctrl K</kbd></button></section>
        <section className="home-search-panel" aria-label={copy.ariaFindTool}><label className="sr-only" htmlFor="tool-search">{copy.searchLabel}</label><div className="home-search-wrap"><span className="home-search-icon" aria-hidden="true">⌕</span><input id="tool-search" ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} autoComplete="off" /><button type="button" className="search-command-button" onClick={() => setPaletteOpen(true)} aria-label={copy.smartPalette}>AI</button></div>{intentLocalized && intent && <Link className="intent-suggestion" to={intentLocalized.path}><span><strong>{copy.suggested}</strong> {intentLocalized.title}</span><small>{intent.score}% · {copy.openDirectly}</small></Link>}<div className="quick-tags" aria-label={copy.popular}>{copy.quickTags.map((tag) => <button key={tag} type="button" onClick={() => setQuery(tag)}>{tag}</button>)}</div></section>
        <section className="home-trust-grid" id="privacy" aria-label={copy.ariaTrust}>{copy.trust.map(([title, text]) => <div key={title}><strong>{title}</strong><span>{text}</span></div>)}</section>
        <section className="home-quick-drop" aria-labelledby="quick-drop-title"><div><span className="image-tool-eyebrow">{copy.quickDrop}</span><h2 id="quick-drop-title">{copy.quickDropTitle}</h2><p>{copy.quickDropLead}</p></div><label className="home-drop-zone"><input type="file" onChange={(event) => setDropRecommendation(event.target.files?.[0] ? recommendTool(event.target.files[0], locale) : null)} /><strong>{copy.dropChoose}</strong><span>{copy.dropSupport}</span></label>{dropRecommendation && <div className="drop-result"><div><span>{copy.suggestedTool}</span><strong>{dropRecommendation.title}</strong></div><Link className="primary-button" to={dropRecommendation.path}>{copy.openTool}</Link></div>}</section>
        <section id="tools" className="home-tools-section" aria-labelledby="tools-title"><div className="section-heading"><div><span className="image-tool-eyebrow">{copy.toolbox}</span><h2 id="tools-title">{copy.toolboxTitle}</h2></div><span className="tool-count">{filteredTools.length} {copy.ready}</span></div><div id="categories" className="category-pills" aria-label={copy.ariaCategories}>{categories.map((category) => <button key={category} type="button" className={selectedCategory === category ? 'is-active' : ''} onClick={() => setSelectedCategory(category)}>{category === 'All' ? copy.all : localizeMsUkCategory(locale, category as 'Images' | 'AI' | 'Other') ?? localizeToolCategory(locale, category as 'Images' | 'AI' | 'Other')}</button>)}</div><div className="home-tools-grid">{filteredTools.map((tool) => <Link key={tool.id} to={tool.path} className="home-tool-card" aria-label={`${copy.openTool}: ${tool.title}`}><div className="tool-card-topline"><span className="tool-card-category">{tool.categoryLabel}</span><span className="tool-card-arrow" aria-hidden="true">↗</span></div><h3>{tool.title}</h3><p>{tool.description}</p><span className="tool-card-meta">{copy.browserMeta}</span></Link>)}</div>{filteredTools.length === 0 && <div className="home-empty">{copy.empty}</div>}</section>
        <section className="home-final-cta"><div><span className="image-tool-eyebrow">{copy.builtForFocus}</span><h2>{copy.finalTitle}</h2><p>{copy.finalLead}</p></div><button type="button" className="primary-button" onClick={() => setPaletteOpen(true)}>{copy.trySmart}</button></section>
      </div>
    </main>
  );
}
