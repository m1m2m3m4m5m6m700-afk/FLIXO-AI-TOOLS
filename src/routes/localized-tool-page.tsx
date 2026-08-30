import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { useParams } from '@tanstack/react-router';
import { LOCALES, isLocale, type Locale, LOCALE_METADATA } from '../lib/i18n';
import { getToolSeo } from '../lib/seo/tool-seo';
import { TOOL_UI_I18N } from '../data/tool-ui-i18n';
import { AutoLocalizedToolSurface } from '../components/auto-localized-tool-surface';
import { getFavorites, recordRecentTool, toggleFavorite } from '../lib/local-workspace';
import '../tool-page-modern.css';

const LazyToolChainPanel = lazy(() => import('../components/tool-chain-panel').then((module) => ({ default: module.ToolChainPanel })));

export function LocalizedToolPage() {
  const params = useParams({ strict: false });
  const locale = (typeof params.locale === 'string' && isLocale(params.locale) ? params.locale : 'en') as Locale;
  const copy = TOOL_UI_I18N[locale];
  const direction = LOCALE_METADATA[locale].direction;
  const toolId = typeof params.tool === 'string' && LOCALES.includes(locale) ? params.tool : null;
  const [favorite, setFavorite] = useState(() => (toolId ? getFavorites().includes(toolId) : false));

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    if (toolId) recordRecentTool(toolId);
    return () => {
      document.documentElement.lang = 'en';
      document.documentElement.dir = 'ltr';
    };
  }, [locale, direction, toolId]);

  if (typeof params.locale !== 'string' || typeof params.tool !== 'string' || !isLocale(params.locale) || !LOCALES.includes(params.locale)) {
    return <main lang={locale} dir={direction} className="tool-page-modern"><div className="tool-page-modern__body"><p className="tool-page-modern__eyebrow">FLIXO · {copy.navigation}</p><h1>{copy.notFound}</h1></div></main>;
  }

  const seo = getToolSeo(params.locale, params.tool);
  if (!seo) {
    return <main lang={locale} dir={direction} className="tool-page-modern"><div className="tool-page-modern__body"><p className="tool-page-modern__eyebrow">FLIXO · {copy.navigation}</p><h1>{copy.notFound}</h1></div></main>;
  }

  const ToolComponent = seo.tool.component as unknown as ComponentType<{ locale?: Locale }>;
  const homeUrl = `/${locale}`;
  const alternateUrl = locale === 'ar' ? `/en/${seo.tool.id}` : `/ar/${seo.tool.id}`;
  const alternateLabel = locale === 'ar' ? copy.english : copy.arabic;
  const onToggleFavorite = () => {
    const next = toggleFavorite(seo.tool.id);
    setFavorite(next.includes(seo.tool.id));
  };

  return (
    <div className="tool-page-modern">
      <nav className="tool-page-modern__nav" aria-label={copy.navigation}>
        <div className="tool-page-modern__nav-inner">
          <a className="tool-page-modern__brand" href={homeUrl} aria-label={copy.home}>
            <img className="tool-page-modern__brand-logo" src="/flixo-logo.svg" width="44" height="44" alt="FLIXO" decoding="async" />
          </a>
          <div className="tool-page-modern__nav-actions">
            <button className={`tool-page-modern__favorite ${favorite ? 'is-active' : ''}`} type="button" onClick={onToggleFavorite} aria-pressed={favorite} title={copy.favorite}>
              <span aria-hidden="true">{favorite ? '★' : '☆'}</span> {copy.favorite}
            </button>
            <a className="tool-page-modern__nav-link" href={homeUrl}>← {copy.home}</a>
            <a className="tool-page-modern__lang" href={alternateUrl} lang={locale === 'ar' ? 'en' : 'ar'}>{alternateLabel}</a>
          </div>
        </div>
      </nav>
      <div className="tool-page-modern__body">
        <Suspense fallback={<div className="tool-page-modern__loading" role="status" aria-live="polite">{copy.loading}</div>}>
          <LazyToolChainPanel currentToolId={seo.tool.id} />
        </Suspense>
        <Suspense fallback={<div className="tool-page-modern__loading" role="status" aria-live="polite">{copy.loading}</div>}>
          <AutoLocalizedToolSurface locale={locale}>
            <ToolComponent locale={locale} />
          </AutoLocalizedToolSurface>
        </Suspense>
      </div>
    </div>
  );
}
