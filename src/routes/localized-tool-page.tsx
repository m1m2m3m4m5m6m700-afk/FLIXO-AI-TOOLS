import { Children, cloneElement, createElement, lazy, Suspense, useEffect, useRef, useState, isValidElement, type ComponentType, type ReactNode } from 'react';
import { useParams } from '@tanstack/react-router';
import { LOCALES, isLocale, type Locale, LOCALE_METADATA } from '../lib/i18n';
import { assertToolCategory, getToolSeo } from '../lib/seo/tool-seo';
import { getAuthoritativeToolSeoName } from '../config/tool-seo-name-resolver';
import { TOOL_UI_I18N } from '../data/tool-ui-i18n';
import { localizeMsUkCategory, localizeMsUkDescription } from '../lib/i18n/ms-uk-category';
import { localizeToolCategory, localizeToolDescription } from '../lib/i18n/tool-localization';
import { AutoLocalizedToolSurface } from '../components/auto-localized-tool-surface';
import { getToolPrivacyCopy } from '../lib/privacy';
import { getFavorites, recordRecentTool, toggleFavorite } from '../lib/local-workspace';
import '../tool-page-modern.css';

const LazyToolChainPanel = lazy(() => import('../components/tool-chain-panel').then((module) => ({ default: module.ToolChainPanel })));

function demoteNestedPageLandmarks(node: ReactNode): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;
    const props = child.props as Record<string, unknown> & { children?: ReactNode };
    const normalizedChildren = props.children === undefined ? undefined : demoteNestedPageLandmarks(props.children);
    const replacement = child.type === 'main' ? 'div' : child.type === 'h1' ? 'h2' : null;

    if (replacement) {
      const safeProps = { ...props };
      delete safeProps.children;
      delete safeProps.ref;
      return createElement(replacement, { ...safeProps, 'data-flixo-semantic-boundary': 'demoted', key: child.key ?? undefined }, normalizedChildren);
    }

    if (normalizedChildren === props.children) return child;
    return cloneElement(child, undefined, normalizedChildren);
  });
}

function ToolSurfaceSemanticBoundary({ children }: { children: ReactNode }) {
  return <>{demoteNestedPageLandmarks(children)}</>;
}

export function LocalizedToolPage() {
  const params = useParams({ strict: false });
  const locale = (typeof params.locale === 'string' && isLocale(params.locale) ? params.locale : 'en') as Locale;
  const copy = TOOL_UI_I18N[locale];
  const direction = LOCALE_METADATA[locale].direction;
  const toolId = typeof params.tool === 'string' && isLocale(locale) && LOCALES.includes(locale) ? params.tool : null;
  const [favorite, setFavorite] = useState(() => (toolId ? getFavorites().includes(toolId) : false));
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (toolId) recordRecentTool(toolId);
    headingRef.current?.focus({ preventScroll: true });
  }, [toolId, locale]);

  if (typeof params.locale !== 'string' || typeof params.tool !== 'string' || !isLocale(params.locale) || !LOCALES.includes(params.locale)) {
    return <main lang={locale} dir={direction} className="tool-page-modern"><div className="tool-page-modern__body"><section className="tool-page-modern__hero"><p className="tool-page-modern__eyebrow">FLIXO · {copy.navigation}</p><h1 ref={headingRef} tabIndex={-1} className="tool-page-modern__title">{copy.notFound}</h1></section></div></main>;
  }

  const seo = getToolSeo(params.locale, params.tool);
  if (!seo) {
    return <main lang={locale} dir={direction} className="tool-page-modern"><div className="tool-page-modern__body"><section className="tool-page-modern__hero"><p className="tool-page-modern__eyebrow">FLIXO · {copy.navigation}</p><h1 ref={headingRef} tabIndex={-1} className="tool-page-modern__title">{copy.notFound}</h1></section></div></main>;
  }

  const category = assertToolCategory(seo.tool.category);
  const localizedTitle = getAuthoritativeToolSeoName(seo.tool, locale) ?? seo.tool.title;
  const localizedCategory = localizeMsUkCategory(locale, category) ?? localizeToolCategory(locale, category);
  const localizedDescription = locale === 'en' ? seo.tool.description : localizeMsUkDescription(locale, localizedTitle) ?? localizeToolDescription(locale, localizedTitle, category);
  const ToolComponent = seo.tool.component as unknown as ComponentType<{ locale?: Locale }>;
  const privacy = getToolPrivacyCopy(seo.tool.id, locale);
  const homeUrl = `/${locale}`;
  const alternateLocale = locale === 'en' ? 'ar' : 'en';
  const alternateUrl = `/${alternateLocale}/${seo.tool.id}`;
  const alternateLabel = alternateLocale === 'ar' ? copy.arabic : copy.english;
  const onToggleFavorite = () => {
    const next = toggleFavorite(seo.tool.id);
    setFavorite(next.includes(seo.tool.id));
  };

  return (
    <main lang={seo.languageTag} dir={direction} className="tool-page-modern">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ ...seo.structuredData, keywords: seo.keywords }).replace(/</g, '\\u003c') }} />
      <nav className="tool-page-modern__nav" aria-label={copy.navigation}>
        <div className="tool-page-modern__nav-inner">
          <a className="tool-page-modern__brand" href={homeUrl} aria-label={copy.home}><img className="tool-page-modern__brand-logo" src="/flixo-logo.svg" width="44" height="44" alt="FLIXO" decoding="async" /></a>
          <div className="tool-page-modern__nav-actions">
            <button className={`tool-page-modern__favorite ${favorite ? 'is-active' : ''}`} type="button" onClick={onToggleFavorite} aria-pressed={favorite} title={copy.favorite}><span aria-hidden="true">{favorite ? '★' : '☆'}</span> {copy.favorite}</button>
            <a className="tool-page-modern__nav-link" href={homeUrl}>← {copy.home}</a>
            <a className="tool-page-modern__lang" href={alternateUrl} lang={alternateLocale}>{alternateLabel}</a>
          </div>
        </div>
      </nav>
      <div className="tool-page-modern__body">
        <Suspense fallback={<div className="tool-page-modern__loading" role="status" aria-live="polite">{copy.loading}</div>}><LazyToolChainPanel currentToolId={seo.tool.id} /></Suspense>
        <div className="tool-page-modern__breadcrumbs" aria-label={copy.about}><a className="tool-page-modern__crumb" href={homeUrl}>FLIXO</a><span className="tool-page-modern__crumb-sep">/</span><span className="tool-page-modern__crumb">{localizedCategory}</span><span className="tool-page-modern__crumb-sep">/</span><span className="tool-page-modern__crumb" aria-current="page">{localizedTitle}</span></div>
        <header className="tool-page-modern__hero"><div className="tool-page-modern__hero-grid"><div><p className="tool-page-modern__eyebrow">FLIXO · {localizedCategory.toUpperCase()}</p><h1 ref={headingRef} tabIndex={-1} className="tool-page-modern__title">{localizedTitle}</h1><p className="tool-page-modern__description">{localizedDescription}</p><div className="tool-page-modern__meta"><div className="tool-page-modern__meta-row"><span className="tool-page-modern__badge"><span className="tool-page-modern__badge-dot" /> {copy.ready}</span><span className="tool-page-modern__chip">{copy.language}: {seo.languageTag}</span><span className="tool-page-modern__chip">{localizedCategory}</span></div><div className={`tool-page-modern__privacy ${privacy.mode === 'local' ? 'tool-page-modern__privacy--local' : 'tool-page-modern__privacy--remote'}`} role="status" aria-label={privacy.label}><span aria-hidden="true">{privacy.mode === 'local' ? '●' : '↗'}</span><strong>{privacy.label}</strong><span>{privacy.detail}</span></div></div></div></div></header>
        <section className="tool-page-modern__workspace" aria-label={localizedTitle} aria-busy="false"><div className="tool-page-modern__workspace-bar"><span className="tool-page-modern__status"><span className="tool-page-modern__status-led" /> {copy.workspace}</span><span>{seo.tool.id}</span></div><div className="tool-page-modern__tool-host" aria-live="polite"><Suspense fallback={<div className="tool-page-modern__loading" role="status" aria-live="polite">{copy.loading}</div>}><AutoLocalizedToolSurface locale={locale} toolId={seo.tool.id}><ToolSurfaceSemanticBoundary><ToolComponent locale={locale} /></ToolSurfaceSemanticBoundary></AutoLocalizedToolSurface></Suspense></div></section>
        <section className="tool-page-modern__seo" aria-label={copy.about}><article className="tool-page-modern__seo-card"><h2>{copy.about}</h2><p>{seo.intro}</p><h3>{copy.howTo}</h3><ol>{seo.howTo.map((step) => <li key={step}>{step}</li>)}</ol></article><article className="tool-page-modern__seo-card"><h2>{copy.features}</h2><ul>{seo.features.map((feature) => <li key={feature}>{feature}</li>)}</ul></article></section>
      </div>
    </main>
  );
}
