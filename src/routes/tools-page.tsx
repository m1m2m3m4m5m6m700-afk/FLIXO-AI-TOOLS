import { useMemo, useState } from 'react';
import {
  Blend,
  Camera,
  Crop,
  Eraser,
  FileImage,
  Grid2X2,
  ImageDown,
  ImageUp,
  Layers2,
  MonitorSmartphone,
  Palette,
  RotateCw,
  ScanText,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  Type,
  Wand2,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { TOOLS_REGISTRY } from '@/config/tools';
import { getAuthoritativeToolSeoName } from '@/config/tool-seo-name-resolver';
import { localizeToolDescription } from '@/lib/i18n/tool-localization';
import type { Locale } from '@/lib/i18n';
import '../components/tools-modern.css';

const TOOL_ICONS = {
  'filter-mask': Camera,
  'image-compressor': ImageDown,
  'background-remover': Eraser,
  'image-upscaler': ImageUp,
  'image-converter': FileImage,
  'object-remover': Wand2,
  'watermark-remover': Stamp,
  'image-cropper': Crop,
  'image-to-svg': FileImage,
  'image-ocr': ScanText,
  'background-blur': SlidersHorizontal,
  'passport-photo-maker': Camera,
  'watermark-adder': Stamp,
  'meme-generator': Type,
  'collage-maker': Grid2X2,
  'image-effects': Sparkles,
  'exif-cleaner': Settings2,
  'svg-optimizer': Blend,
  'mockup-generator': MonitorSmartphone,
  seed: SlidersHorizontal,
  pix: Layers2,
  'ai-image-generator': Sparkles,
  'photo-colorizer': Palette,
} as const;

function getToolIcon(toolId: string) {
  return TOOL_ICONS[toolId as keyof typeof TOOL_ICONS] ?? Settings2;
}

export function ToolsPage({ locale = 'en' as Locale }: { locale?: Locale }) {
  const [query, setQuery] = useState('');
  const ready = useMemo(() => TOOLS_REGISTRY.filter((tool) => tool.isReady), []);
  const tools = useMemo(() => ready.map((tool) => {
    const title = getAuthoritativeToolSeoName(tool, locale) ?? tool.title;
    return {
      ...tool,
      title,
      description: localizeToolDescription(locale, title, tool.category),
      path: tool.path.replace(/^\/en\//, locale === 'ar' ? '/ar/' : '/en/'),
    };
  }).filter((tool) => {
    const haystack = (tool.id + ' ' + tool.title + ' ' + tool.description).toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  }), [ready, locale, query]);

  const ar = locale === 'ar';

  return (
    <main className="tools-modern" lang={locale} dir={ar ? 'rtl' : 'ltr'}>
      <header className="tools-modern-nav">
        <Link className="tools-modern-brand" to={ar ? '/ar' : '/'} aria-label="FLIXO">FLIXO</Link>
        <Link className="tools-modern-back" to={ar ? '/ar' : '/'}>{ar ? 'الرئيسية' : 'Home'}</Link>
      </header>

      <div className="tools-modern-container">
        <section className="tools-modern-hero" aria-labelledby="tools-title">
          <div className="tools-modern-hero-topline">
            <span>{ar ? 'تعديل الصور' : 'IMAGE EDITING'}</span>
            <span>{tools.length} {ar ? 'أداة' : 'tools'}</span>
          </div>
          <h1 id="tools-title">{ar ? 'الأدوات' : 'Tools'}</h1>
          <p>{ar ? 'كل أدوات FLIXO في مساحة بسيطة وسريعة الوصول.' : 'Every FLIXO image tool in one calm, fast workspace.'}</p>
          <div className="tools-modern-search-wrap">
            <SlidersHorizontal aria-hidden="true" />
            <input
              aria-label={ar ? 'البحث عن أداة' : 'Search tools'}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={ar ? 'ابحث عن أداة…' : 'Search tools…'}
            />
          </div>
        </section>

        <section className="tools-modern-tool-grid" aria-label={ar ? 'أدوات تعديل الصور' : 'Image tools'}>
          {tools.map((tool) => {
            const Icon = getToolIcon(tool.id);
            return (
              <Link key={tool.id} to={tool.path} className="tools-modern-tool">
                <span className="tools-modern-tool__icon"><Icon aria-hidden="true" /></span>
                <span className="tools-modern-tool__title">{tool.title}</span>
                <span className="tools-modern-tool__hint">{ar ? 'فتح' : 'Open'}</span>
              </Link>
            );
          })}
        </section>

        {tools.length === 0 && <div className="tools-modern-empty">{ar ? 'لا توجد أدوات مطابقة.' : 'No matching tools.'}</div>}

        <nav className="tools-modern-foot-nav" aria-label={ar ? 'تنقل الأدوات' : 'Tool navigation'}>
          <Link to={ar ? '/ar' : '/'}>{ar ? 'الرئيسية' : 'Home'}</Link>
          <span className="is-active">{ar ? 'الأدوات' : 'Tools'}</span>
          <span>{ar ? 'التصدير من داخل الأداة' : 'Export inside each tool'}</span>
        </nav>
      </div>
    </main>
  );
}
