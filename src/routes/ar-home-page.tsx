import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { SmartCommandPalette } from '../components/SmartCommandPalette';
import { FlixoHeroWorkspace } from '../components/home/FlixoHeroWorkspace';
import { ArHomeToolsSection } from '../components/ar-home-tools-section';
import { TOOLS_REGISTRY, getToolConfig } from '../config/tools';
import { getBestToolIntent } from '../lib/intent-router';
import { getToolCategories, filterTools } from '../lib/ar-home-search';
import { recommendImageTool } from '../lib/ar-home-recommendation';
import { HOME_I18N } from '../data/home-locales';
import { getAuthoritativeToolSeoName } from '../config/tool-seo-name-resolver';
import { localizeMsUkCategory, localizeMsUkDescription } from '../lib/i18n/ms-uk-category';
import { localizeToolCategory, localizeToolDescription } from '../lib/i18n/tool-localization';

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
const HOME_AR = HOME_I18N.ar;

function localTool(tool: LocalizableTool): ToolCard {
  const toolConfig = getToolConfig(tool.id);
  const localizedTitle = toolConfig ? getAuthoritativeToolSeoName(toolConfig, 'ar') ?? tool.title : tool.title;
  const localizedCategory = localizeMsUkCategory('ar', tool.category) ?? localizeToolCategory('ar', tool.category);
  const localizedDescription = localizeMsUkDescription('ar', localizedTitle) ?? localizeToolDescription('ar', localizedTitle, tool.category);
  return {
    title: localizedTitle,
    description: localizedDescription,
    category: tool.category,
    path: tool.path.replace(/^\/en\//, '/ar/'),
  };
}

export function ArHomePage() {
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

  return (
    <main className="home-shell" dir="rtl" lang="ar">
      {paletteOpen && <SmartCommandPalette onClose={() => setPaletteOpen(false)} />}
      <nav className="home-nav" aria-label={HOME_AR.ariaPrimary}>
        <div className="home-container home-nav-inner">
          <Link className="home-brand" to="/" aria-label={HOME_AR.ariaHome}>FLIXO</Link>
          <div className="home-nav-links"><a href="#tools">{HOME_AR.nav.tools}</a><a href="#categories">{HOME_AR.nav.categories}</a><a href="#privacy">{HOME_AR.nav.privacy}</a></div>
          <a className="home-nav-language" href="/" lang="en">{HOME_AR.nav.switch}</a>
        </div>
      </nav>
      <div className="home-container home-content">
        <FlixoHeroWorkspace
          copy={{
            badge: HOME_AR.badge,
            eyebrow: HOME_AR.eyebrow,
            title: HOME_AR.heroTitle.replace(/<[^>]+>/g, ''),
            lead: HOME_AR.heroLead,
            describe: HOME_AR.describe,
            workspace: 'مساحة عمل FLIXO الأساسية',
            ready: HOME_AR.ready,
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
        <section className="home-search-panel" aria-label={HOME_AR.ariaFindTool}>
          <label className="sr-only" htmlFor="ar-tool-search">{HOME_AR.searchLabel}</label>
          <div className="home-search-wrap"><span className="home-search-icon" aria-hidden="true">⌕</span><input id="ar-tool-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={HOME_AR.searchPlaceholder} autoComplete="off" /><button type="button" className="search-command-button" onClick={() => setPaletteOpen(true)} aria-label={HOME_AR.smartPalette}>AI</button></div>
          {intent && <Link className="intent-suggestion" to={intent.tool.path.replace(/^\/en\//, '/ar/')}><span><strong>{HOME_AR.suggested}</strong> {getAuthoritativeToolSeoName(intent.tool, 'ar') ?? intent.tool.title}</span><small>{intent.score}% · {HOME_AR.openDirectly}</small></Link>}
          <div className="quick-tags" aria-label={HOME_AR.popular}>{HOME_AR.quickTags.map((tag) => <button key={tag} type="button" onClick={() => setQuery(tag)}>{tag}</button>)}</div>
        </section>
        <section className="home-trust-grid" id="privacy" aria-label={HOME_AR.ariaTrust}>{HOME_AR.trust.map(([title, text]) => <div key={title}><strong>{title}</strong><span>{text}</span></div>)}</section>
        <section className="home-quick-drop" aria-labelledby="quick-drop-title"><div><span className="image-tool-eyebrow">{HOME_AR.quickDrop}</span><h2 id="quick-drop-title">{HOME_AR.quickDropTitle}</h2><p>{HOME_AR.quickDropLead}</p></div><label className="home-drop-zone"><input type="file" onChange={(event) => setDropRecommendation(event.target.files?.[0] ? recommendImageTool(event.target.files[0], READY_TOOLS, localTool) : null)} /><strong>{HOME_AR.dropChoose}</strong><span>{HOME_AR.dropSupport}</span></label>{dropRecommendation && <div className="drop-result"><div><span>{HOME_AR.suggestedTool}</span><strong>{dropRecommendation.title}</strong></div><Link className="primary-button" to={dropRecommendation.path}>{HOME_AR.openTool}</Link></div>}</section>
        <ArHomeToolsSection categories={categories} filteredTools={filteredTools} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
        <section className="home-final-cta"><div><span className="image-tool-eyebrow">{HOME_AR.builtForFocus}</span><h2>{HOME_AR.finalTitle}</h2><p>{HOME_AR.finalLead}</p></div><button type="button" className="primary-button" onClick={() => setPaletteOpen(true)}>{HOME_AR.trySmart}</button></section>
      </div>
    </main>
  );
}
