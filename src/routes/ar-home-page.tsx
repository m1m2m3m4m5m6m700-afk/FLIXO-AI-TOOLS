import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { SmartCommandPalette } from '../components/SmartCommandPalette';
import { FlixoHeroWorkspace } from '../components/home/FlixoHeroWorkspace';
import { ArHomeToolsSection } from '../components/ar-home-tools-section';
import { TOOLS_REGISTRY, getToolConfig } from '../config/tools';
import { getBestToolIntent } from '../lib/intent-router';
import { getToolCategories, filterTools } from '../lib/ar-home-search';
import { recommendImageTool } from '../lib/ar-home-recommendation';
import { loadHomeCopy } from '../lib/i18n/home-loader';
import type { HomeCopy } from '../data/home-locales';
import { getAuthoritativeToolSeoName } from '../config/tool-seo-name-resolver';
import { localizeMsUkDescription } from '../lib/i18n/ms-uk-category';
import { localizeToolDescription } from '../lib/i18n/tool-localization';

type ToolCard = {
  title: string;
  description: string;
  category: 'Images' | 'AI' | 'Other';
  path: string;
};

type LocalizableTool = {
  id: string;
  title: string;
  description: string;
  category: ToolCard['category'];
  path: string;
};

const READY_TOOLS = TOOLS_REGISTRY.filter((tool) => tool.isReady);

function localTool(tool: LocalizableTool): ToolCard {
  const toolConfig = getToolConfig(tool.id);
  const localizedTitle = toolConfig ? getAuthoritativeToolSeoName(toolConfig, 'ar') ?? tool.title : tool.title;
  const localizedDescription = localizeMsUkDescription('ar', localizedTitle) ?? localizeToolDescription('ar', localizedTitle, tool.category);
  return {
    title: localizedTitle,
    description: localizedDescription,
    category: tool.category,
    path: tool.path.replace(/^\/en\//, '/ar/'),
  };
}

export function ArHomePage() {
  const [copy, setCopy] = useState<HomeCopy | null>(null);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dropRecommendation, setDropRecommendation] = useState<ToolCard | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const intent = useMemo(() => getBestToolIntent(query, READY_TOOLS), [query]);
  const categories = useMemo(() => getToolCategories(READY_TOOLS), []);
  const filteredTools = useMemo(
    () => filterTools(READY_TOOLS, query, selectedCategory).map(localTool),
    [query, selectedCategory],
  );

  useEffect(() => {
    let active = true;
    void loadHomeCopy('ar').then((nextCopy) => { if (active) setCopy(nextCopy); });
    return () => { active = false; };
  }, []);

  if (!copy) return <main className="home-shell" lang="ar" dir="rtl" aria-busy="true" />;

  return (
    <main className="home-shell" dir="rtl" lang="ar">
      {paletteOpen && <SmartCommandPalette onClose={() => setPaletteOpen(false)} />}
      <nav className="home-nav" aria-label={copy.ariaPrimary}>
        <div className="home-container home-nav-inner">
          <Link className="home-brand" to="/" aria-label={copy.ariaHome}>FLIXO</Link>
          <div className="home-nav-links"><a href="#tools">{copy.nav.tools}</a><a href="#categories">{copy.nav.categories}</a><a href="#privacy">{copy.nav.privacy}</a></div>
          <a className="home-nav-language" href="/" lang="en">{copy.nav.switch}</a>
        </div>
      </nav>
      <div className="home-container home-content">
        <FlixoHeroWorkspace
          copy={{
            badge: copy.badge,
            eyebrow: copy.eyebrow,
            title: copy.heroTitle.replace(/<[^>]+>/g, ''),
            lead: copy.heroLead,
            describe: copy.describe,
            workspace: 'مساحة عمل FLIXO الأساسية',
            ready: copy.ready,
            processTab: 'المعالجة الذكية',
            layersTab: 'إدارة الطبقات',
            settingsTab: 'الإعدادات المتقدمة',
            processTitle: 'ابدأ من المهمة التي تريد إنجازها',
            processDescription: 'ارفع ملفًا أو افتح الأداة المناسبة مباشرة من مسارات FLIXO الجاهزة.',
            processAction: 'ابدأ المعالجة الآن',
            processingAction: 'جاري فتح المسار…',
            layersDescription: 'قائمة الطبقات والعمليات النشطة تظهر هنا تلقائيًا أثناء تنفيذ الأدوات التي تدعمها.',
            settingsDescription: 'خيارات التخصيص، دقة التصدير، وحفظ الملفات تبقى مرتبطة بالأداة الفعلية المستخدمة.',
            speedTitle: 'بدء سريع',
            speedDescription: 'مسارات مباشرة إلى الأدوات الجاهزة بدون حواجز غير ضرورية.',
            privacyTitle: 'المتصفح أولًا',
            privacyDescription: 'المعالجة المحلية تُستخدم عندما تدعمها الأداة.',
            apiTitle: 'توجيه ذكي',
            apiDescription: 'النية الشائعة يمكنها الانتقال مباشرة إلى أفضل أداة جاهزة.',
          }}
          onDescribeTask={() => setPaletteOpen(true)}
          onProcess={() => setPaletteOpen(true)}
        />
        <section className="home-search-panel" aria-label={copy.ariaFindTool}>
          <label className="sr-only" htmlFor="ar-tool-search">{copy.searchLabel}</label>
          <div className="home-search-wrap"><span className="home-search-icon" aria-hidden="true">⌕</span><input id="ar-tool-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} autoComplete="off" /><button type="button" className="search-command-button" onClick={() => setPaletteOpen(true)} aria-label={copy.smartPalette}>AI</button></div>
          {intent && <Link className="intent-suggestion" to={intent.tool.path.replace(/^\/en\//, '/ar/')}><span><strong>{copy.suggested}</strong> {getAuthoritativeToolSeoName(intent.tool, 'ar') ?? intent.tool.title}</span><small>{intent.score}% · {copy.openDirectly}</small></Link>}
          <div className="quick-tags" aria-label={copy.popular}>{copy.quickTags.map((tag) => <button key={tag} type="button" onClick={() => setQuery(tag)}>{tag}</button>)}</div>
        </section>
        <section className="home-trust-grid" id="privacy" aria-label={copy.ariaTrust}>{copy.trust.map(([title, text]) => <div key={title}><strong>{title}</strong><span>{text}</span></div>)}</section>
        <section className="home-quick-drop" aria-labelledby="quick-drop-title"><div><span className="image-tool-eyebrow">{copy.quickDrop}</span><h2 id="quick-drop-title">{copy.quickDropTitle}</h2><p>{copy.quickDropLead}</p></div><label className="home-drop-zone"><input type="file" onChange={(event) => setDropRecommendation(event.target.files?.[0] ? recommendImageTool(event.target.files[0], READY_TOOLS, localTool) : null)} /><strong>{copy.dropChoose}</strong><span>{copy.dropSupport}</span></label>{dropRecommendation && <div className="drop-result"><div><span>{copy.suggestedTool}</span><strong>{dropRecommendation.title}</strong></div><Link className="primary-button" to={dropRecommendation.path}>{copy.openTool}</Link></div>}</section>
        <ArHomeToolsSection copy={copy} categories={categories} filteredTools={filteredTools} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
        <section className="home-final-cta"><div><span className="image-tool-eyebrow">{copy.builtForFocus}</span><h2>{copy.finalTitle}</h2><p>{copy.finalLead}</p></div><button type="button" className="primary-button" onClick={() => setPaletteOpen(true)}>{copy.trySmart}</button></section>
      </div>
    </main>
  );
}