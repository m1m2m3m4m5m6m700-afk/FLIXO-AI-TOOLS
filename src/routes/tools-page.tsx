import { useMemo, useState } from 'react';
import { Blend, Camera, Crop, Eraser, FileImage, Grid2X2, ImageDown, ImageUp, Layers2, MonitorSmartphone, Palette, ScanText, Settings2, SlidersHorizontal, Sparkles, Stamp, Type, Wand2 } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { TOOL_CATALOG } from '@/config/registry';
import { getAuthoritativeToolSeoName } from '@/config/tool-seo-name-resolver';
import { localizeToolDescription } from '@/lib/i18n/tool-localization';
import type { Locale } from '@/lib/i18n';
import '../components/tools-modern.css';

const TOOL_ICONS = {
  'filter-mask': Camera, 'image-compressor': ImageDown, 'background-remover': Eraser, 'image-upscaler': ImageUp,
  'image-converter': FileImage, 'object-remover': Wand2, 'watermark-remover': Stamp, 'image-cropper': Crop,
  'image-to-svg': FileImage, 'image-ocr': ScanText, 'background-blur': SlidersHorizontal, 'passport-photo-maker': Camera,
  'watermark-adder': Stamp, 'meme-generator': Type, 'collage-maker': Grid2X2, 'image-effects': Sparkles,
  'exif-cleaner': Settings2, 'svg-optimizer': Blend, 'mockup-generator': MonitorSmartphone, seed: SlidersHorizontal,
  pix: Layers2, 'ai-image-generator': Sparkles, 'photo-colorizer': Palette,
} as const;

const FILTERS = [
  ['all', 'الكل', 'All'], ['image', 'الصور', 'Images'], ['ai', 'AI', 'AI'], ['files', 'الملفات', 'Files'], ['utilities', 'الأدوات', 'Utilities'],
] as const;

function getToolIcon(toolId: string) { return TOOL_ICONS[toolId as keyof typeof TOOL_ICONS] ?? Settings2; }

export function ToolsPage({ locale = 'en' as Locale }: { locale?: Locale }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const ar = locale === 'ar';

  const tools = useMemo(() => TOOL_CATALOG.ready.map((tool) => {
    const title = getAuthoritativeToolSeoName(tool, locale) ?? tool.title;
    return { ...tool, title, description: localizeToolDescription(locale, title, tool.category), path: tool.path.replace(/^\/en\//, locale === 'ar' ? '/ar/' : '/en/') };
  }).filter((tool) => {
    const q = query.trim().toLowerCase();
    const haystack = (tool.id + ' ' + tool.title + ' ' + tool.description).toLowerCase();
    const category = String(tool.category ?? '').toLowerCase();
    const categoryMatch = filter === 'all' ||
      (filter === 'image' && category.includes('image')) ||
      (filter === 'ai' && category.includes('ai')) ||
      (filter === 'files' && (category.includes('file') || category.includes('pdf'))) ||
      (filter === 'utilities' && (category.includes('utility') || category.includes('converter')));
    return (!q || haystack.includes(q)) && categoryMatch;
  }), [locale, query, filter]);

  return (
    <main className="tools-modern" lang={locale} dir={ar ? 'rtl' : 'ltr'}>
      <header className="tools-modern-nav">
        <Link className="tools-modern-brand" to={ar ? '/ar' : '/'} aria-label="FLIXO">
          <img src="/flixo-brand-mark.webp" alt="" width={36} height={36} /><span>FLIXO</span>
        </Link>
        <Link className="tools-modern-back" to={ar ? '/ar' : '/'}>{ar ? 'العودة للرئيسية' : 'Back home'}</Link>
      </header>
      <div className="tools-modern-container">
        <section className="tools-modern-hero" aria-labelledby="tools-title">
          <div className="tools-modern-hero-topline"><span>WORKSPACE · MANUAL TOOLS</span><span>{tools.length} {ar ? 'متاحة الآن' : 'available now'}</span></div>
          <div>
            <h1 id="tools-title">{ar ? 'مساحة الأدوات.' : 'Tool workspace.'}</h1>
            <p>{ar ? 'سطح واحد لاكتشاف وتشغيل الأدوات اليدوية المنشورة فعليًا في FLIXO. لا أدوات وهمية، ولا مسار وكيل.' : 'One surface for discovering and launching the tools actually published in FLIXO. No phantom tools, no agent execution path.'}</p>
          </div>
          <div className="tools-modern-search-wrap">
            <SlidersHorizontal aria-hidden="true" />
            <input aria-label={ar ? 'البحث عن أداة' : 'Search tools'} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ar ? 'ابحث بالاسم أو الوظيفة…' : 'Search by name or task…'} />
          </div>
        </section>
        <div className="tools-modern-filters" role="tablist" aria-label={ar ? 'تصفية الأدوات' : 'Tool filters'}>
          {FILTERS.map(([id, arLabel, enLabel]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>{ar ? arLabel : enLabel}</button>
          ))}
        </div>
        <section className="tools-modern-tool-grid" aria-label={ar ? 'الأدوات المنشورة' : 'Published tools'}>
          {tools.map((tool) => {
            const Icon = getToolIcon(tool.id);
            return <Link key={tool.id} to={tool.path} className="tools-modern-tool">
              <span className="tools-modern-tool__icon"><Icon aria-hidden="true" /></span>
              <span className="tools-modern-tool__meta">{ar ? 'جاهزة للتشغيل' : 'READY TO RUN'}</span>
              <span className="tools-modern-tool__title">{tool.title}</span>
              <span className="tools-modern-tool__description">{tool.description}</span>
              <span className="tools-modern-tool__hint">{ar ? 'فتح الأداة ↗' : 'Open tool ↗'}</span>
            </Link>;
          })}
        </section>
        {tools.length === 0 && <div className="tools-modern-empty">{ar ? 'لا توجد أدوات مطابقة.' : 'No matching tools.'}</div>}
        <nav className="tools-modern-foot-nav" aria-label={ar ? 'تنقل الأدوات' : 'Tool navigation'}>
          <Link to={ar ? '/ar' : '/'}>{ar ? 'الرئيسية' : 'Home'}</Link>
          <span className="is-active">{ar ? 'مساحة الأدوات' : 'Tool workspace'}</span>
          <span>{ar ? 'التنفيذ داخل كل أداة' : 'Execution stays inside each tool'}</span>
        </nav>
      </div>
    </main>
  );
}
