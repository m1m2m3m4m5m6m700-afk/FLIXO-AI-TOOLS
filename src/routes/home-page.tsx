import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { TOOL_CATALOG } from '../config/registry';
import { loadHomeCopy } from '@/lib/i18n/home-loader';
import { getAuthoritativeToolSeoName } from '@/config/tool-seo-name-resolver';
import { localizeMsUkCategory, localizeMsUkDescription } from '@/lib/i18n/ms-uk-category';
import { LOCALE_METADATA, LOCALES } from '@/lib/i18n';
import { localizeToolCategory, localizeToolDescription } from '@/lib/i18n/tool-localization';
import type { HomeCopy } from '../data/home-locales';
import type { Locale } from '@/lib/i18n';
import type { ToolDefinition } from '../config/canonical-tool-definition';

type ToolCardProps = Readonly<{
  id: string;
  title: string;
  description: string;
  category: 'Images';
  categoryLabel: string;
  path: string;
}>;

const READY_TOOLS = TOOL_CATALOG.ready;
const LANGUAGE_LABELS: Record<string, string> = { en: 'English', ar: 'العربية', es: 'Español', fr: 'Français', de: 'Deutsch', hi: 'हिन्दी', id: 'Bahasa Indonesia', it: 'Italiano', ja: '日本語', ko: '한국어', ms: 'Bahasa Melayu', nl: 'Nederlands', pl: 'Polski', pt: 'Português', ru: 'Русский', sv: 'Svenska', th: 'ไทย', tr: 'Türkçe', uk: 'Українська', vi: 'Tiếng Việt' };
const FILTER_LABELS: Record<string, string> = { en: 'Filters', ar: 'الفلاتر', es: 'Filtros', fr: 'Filtres', de: 'Filter', hi: 'फ़िल्टर', id: 'Filter', it: 'Filtri', ja: 'フィルター', ko: '필터', ms: 'Penapis', nl: 'Filters', pl: 'Filtry', pt: 'Filtros', ru: 'Фильтры', sv: 'Filter', th: 'ฟิลเตอร์', tr: 'Filtreler', uk: 'Фільтри', vi: 'Bộ lọc' };

function toLocalizedTool(tool: ToolDefinition, locale: Locale): ToolCardProps {
  const localizedTitle = getAuthoritativeToolSeoName(tool, locale) ?? tool.title;
  const localizedCategory = localizeMsUkCategory(locale, 'Images') ?? localizeToolCategory(locale, 'Images');
  const localizedDescription = localizeMsUkDescription(locale, localizedTitle) ?? localizeToolDescription(locale, localizedTitle, 'Images');
  return { id: tool.id, title: localizedTitle, description: localizedDescription, category: 'Images', categoryLabel: localizedCategory, path: `/${locale}/${tool.id}` };
}

function renderHeroTitle(value: string) {
  const match = /^([\s\S]*?)<span>([\s\S]*?)<\/span>([\s\S]*)$/.exec(value);
  if (!match) return value;
  return <>{match[1]}<span>{match[2]}</span>{match[3]}</>;
}

export function HomePage({ locale = 'en' as Locale }: { locale?: Locale }) {
  const navigate = useNavigate();
  const [copy, setCopy] = useState<HomeCopy | null>(null);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    let active = true;
    void loadHomeCopy(locale).then((nextCopy) => { if (active) setCopy(nextCopy); });
    return () => { active = false; };
  }, [locale]);

  const localizedTools = useMemo(() => READY_TOOLS.map((tool) => toLocalizedTool(tool, locale)), [locale]);
  const categories = useMemo(() => ['All', 'Images'] as const, []);
  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return localizedTools.filter((tool) => {
      const matchesCategory = selectedCategory === 'All' || selectedCategory === tool.category;
      const haystack = `${tool.id} ${tool.title} ${tool.description} ${tool.categoryLabel}`.toLowerCase();
      return matchesCategory && (!normalized || haystack.includes(normalized));
    });
  }, [localizedTools, query, selectedCategory]);

  const localeMetadata = LOCALE_METADATA[locale];
  if (!copy) return <main className="home-shell" lang={localeMetadata.languageTag} dir={localeMetadata.direction} aria-busy="true" />;

  return (
    <main className="home-shell" lang={localeMetadata.languageTag} dir={localeMetadata.direction}>
      <nav className="home-nav" aria-label={copy.ariaPrimary}>
        <div className="home-container home-nav-inner">
          <Link className="home-brand" to="/" aria-label={copy.ariaHome}>FLIXO Hub</Link>
          <div className="home-nav-links"><a href="#tools">{locale === 'ar' ? 'أدوات الصور' : copy.nav.tools}</a><Link to="/$locale/$tool" params={{ locale, tool: 'filter-mask' }}>{FILTER_LABELS[locale] ?? copy.nav.categories}</Link></div>
          <label className="sr-only" htmlFor="home-language">{copy.nav.switch}</label>
          <select id="home-language" className="home-nav-language" value={locale} aria-label={copy.nav.switch} onChange={(event) => { const nextLocale = event.target.value as Locale; void navigate(nextLocale === 'en' ? { to: '/' } : { to: '/$locale', params: { locale: nextLocale } }); }}>
            {LOCALES.map((code) => <option key={code} value={code}>{LANGUAGE_LABELS[code] ?? code}</option>)}
          </select>
        </div>
      </nav>
      <div className="home-container home-content">
        <section className="home-hero" aria-labelledby="home-title">
          <div><span className="home-badge">{copy.badge}</span><p className="image-tool-eyebrow">{copy.eyebrow}</p><h1 id="home-title">{renderHeroTitle(copy.heroTitle)}</h1><p className="home-lead">{copy.heroLead}</p></div>
        </section>
        <section className="home-search-panel" aria-label={copy.ariaFindTool}>
          <label className="sr-only" htmlFor="tool-search">{copy.searchLabel}</label>
          <div className="home-search-wrap"><span className="home-search-icon" aria-hidden="true">⌕</span><input id="tool-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} autoComplete="off" /></div>
          <div className="quick-tags" aria-label={copy.popular}>{copy.quickTags.map((tag) => <button key={tag} type="button" onClick={() => setQuery(tag)}>{tag}</button>)}</div>
        </section>
        <section className="home-trust-grid" id="privacy" aria-label={copy.ariaTrust}>{copy.trust.map(([title, text]) => <div key={title}><strong>{title}</strong><span>{text}</span></div>)}</section>
        <section id="tools" className="home-tools-section" aria-labelledby="tools-title">
          <div className="section-heading"><div><span className="image-tool-eyebrow">{copy.toolbox}</span><h2 id="tools-title">{copy.toolboxTitle}</h2></div><span className="tool-count">{filteredTools.length} {copy.ready}</span></div>
          <div id="categories" className="category-pills" aria-label={copy.ariaCategories}>{categories.map((category) => <button key={category} type="button" className={selectedCategory === category ? 'is-active' : ''} onClick={() => setSelectedCategory(category)}>{category === 'All' ? copy.all : localizeMsUkCategory(locale, 'Images') ?? localizeToolCategory(locale, 'Images')}</button>)}</div>
          <div className="home-tools-grid">{filteredTools.map((tool) => <Link key={tool.id} to={tool.path} className="home-tool-card" aria-label={`${copy.openTool}: ${tool.title}`}><div className="tool-card-topline"><span className="tool-card-category">{tool.categoryLabel}</span><span className="tool-card-arrow" aria-hidden="true">↗</span></div><h3>{tool.title}</h3><p>{tool.description}</p><span className="tool-card-meta">{copy.browserMeta}</span></Link>)}</div>
          {filteredTools.length === 0 && <div className="home-empty">{copy.empty}</div>}
        </section>
        <section className="home-final-cta"><div><span className="image-tool-eyebrow">{copy.builtForFocus}</span><h2>{copy.finalTitle}</h2><p>{copy.finalLead}</p></div><a className="primary-button" href="#tools">{copy.openTool}</a></section>
      </div>
    </main>
  );
}
