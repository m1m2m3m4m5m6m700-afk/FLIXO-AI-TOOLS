import { Suspense, useEffect, useState, type ComponentType } from 'react';
import { useParams } from '@tanstack/react-router';
import { LOCALES, isLocale, type Locale } from '../lib/i18n';
import { getToolSeo } from '../lib/seo/tool-seo';
import { TOOL_UI_I18N } from '../data/tool-ui-i18n';
import { getToolPrivacyCopy } from '../lib/privacy';
import { getFavorites, recordRecentTool, toggleFavorite } from '../lib/local-workspace';
import '../tool-page-modern.css';

export function LocalizedToolPage() {
  const params = useParams({ strict: false });
  const locale = typeof params.locale === 'string' && isLocale(params.locale) ? params.locale : 'en';
  const toolId = typeof params.tool === 'string' ? params.tool : '';
  const copy = TOOL_UI_I18N[locale];
  const isRtl = locale === 'ar' || locale === 'ur';
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    if (!toolId) return;
    setFavorite(getFavorites().includes(toolId));
    recordRecentTool(toolId);
  }, [toolId]);

  if (typeof params.locale !== 'string' || !toolId || !isLocale(params.locale) || !LOCALES.includes(params.locale)) {
    return (
      <main lang={locale} dir={isRtl ? 'rtl' : 'ltr'} className="tool-page-modern">
        <div className="tool-page-modern__body">
          <section className="tool-page-modern__hero">
            <p className="tool-page-modern__eyebrow">FLIXO · TOOLS</p>
            <h1 className="tool-page-modern__title">{copy.notFound}</h1>
          </section>
        </div>
      </main>
    );
  }

  const seo = getToolSeo(params.locale, toolId);
  if (!seo) {
    return (
      <main lang={locale} dir={isRtl ? 'rtl' : 'ltr'} className="tool-page-modern">
        <div className="tool-page-modern__body">
          <section className="tool-page-modern__hero">
            <p className="tool-page-modern__eyebrow">FLIXO · TOOLS</p>
            <h1 className="tool-page-modern__title">{copy.notFound}</h1>
          </section>
        </div>
      </main>
    );
  }

  const ToolComponent = seo.tool.component as unknown as ComponentType<{ locale?: Locale }>;
  const privacy = getToolPrivacyCopy(seo.tool.id, locale);
  const homeUrl = `/${locale}`;
  const englishToolUrl = `/en/${seo.tool.id}`;
  const arabicToolUrl = `/ar/${seo.tool.id}`;
  const alternateUrl = locale === 'ar' ? englishToolUrl : arabicToolUrl;
  const alternateLabel = locale === 'ar' ? 'English' : 'العربية';
  const homeLabel = locale === 'ar' || locale === 'ur' ? 'الرئيسية' : 'Home';
  const readyLabel = locale === 'ar' ? 'جاهزة' : 'Ready';
  const workspaceLabel = locale === 'ar' ? 'مساحة عمل الأداة' : 'Tool workspace';
  const favoriteLabel = locale === 'ar' ? 'المفضلة' : 'Favorite';

  const onToggleFavorite = () => {
    const next = toggleFavorite(seo.tool.id);
    setFavorite(next.includes(seo.tool.id));
  };

  return (
    <main lang={seo.languageTag} dir={seo.direction} className="tool-page-modern">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ ...seo.structuredData, keywords: seo.keywords }).replace(/</g, '\\u003c') }}
      />

      <nav className="tool-page-modern__nav" aria-label="FLIXO tool navigation">
        <div className="tool-page-modern__nav-inner">
          <a className="tool-page-modern__brand" href={homeUrl} aria-label="FLIXO home">
            <img className="tool-page-modern__brand-logo" src="/flixo-logo.svg" width="44" height="44" alt="FLIXO" decoding="async" />
          </a>
          <div className="tool-page-modern__nav-actions">
            <button className={`tool-page-modern__favorite ${favorite ? 'is-active' : ''}`} type="button" onClick={onToggleFavorite} aria-pressed={favorite} title={favoriteLabel}>
              <span aria-hidden="true">{favorite ? '★' : '☆'}</span> {favoriteLabel}
            </button>
            <a className="tool-page-modern__nav-link" href={homeUrl}>← {homeLabel}</a>
            <a className="tool-page-modern__lang" href={alternateUrl} lang={locale === 'ar' ? 'en' : 'ar'}>{alternateLabel}</a>
          </div>
        </div>
      </nav>

      <div className="tool-page-modern__body">
        <div className="tool-page-modern__breadcrumbs" aria-label={copy.about}>
          <a className="tool-page-modern__crumb" href={homeUrl}>FLIXO</a>
          <span className="tool-page-modern__crumb-sep">/</span>
          <span className="tool-page-modern__crumb">{seo.tool.category}</span>
          <span className="tool-page-modern__crumb-sep">/</span>
          <span className="tool-page-modern__crumb" aria-current="page">{seo.tool.title}</span>
        </div>

        <header className="tool-page-modern__hero">
          <div className="tool-page-modern__hero-grid">
            <div>
              <p className="tool-page-modern__eyebrow">FLIXO · {seo.tool.category.toUpperCase()}</p>
              <h1 className="tool-page-modern__title">{seo.title.replace(' | FLIXO', '')}</h1>
              <p className="tool-page-modern__description">{seo.description}</p>
              <div className="tool-page-modern__meta">
                <div className="tool-page-modern__meta-row">
                  <span className="tool-page-modern__badge"><span className="tool-page-modern__badge-dot" /> {readyLabel}</span>
                  <span className="tool-page-modern__chip">{copy.language}: {seo.languageTag}</span>
                  <span className="tool-page-modern__chip">{seo.tool.category}</span>
                </div>
                <div className={`tool-page-modern__privacy ${privacy.mode === 'local' ? 'tool-page-modern__privacy--local' : 'tool-page-modern__privacy--remote'}`} role="status" aria-label={privacy.label}>
                  <span aria-hidden="true">{privacy.mode === 'local' ? '●' : '↗'}</span>
                  <strong>{privacy.label}</strong>
                  <span>{privacy.detail}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="tool-page-modern__workspace" aria-label={seo.tool.title}>
          <div className="tool-page-modern__workspace-bar">
            <span className="tool-page-modern__status"><span className="tool-page-modern__status-led" /> {workspaceLabel}</span>
            <span>{seo.tool.id}</span>
          </div>
          <div className="tool-page-modern__tool-host">
            <Suspense fallback={<div className="tool-page-modern__loading">{copy.loading}</div>}>
              <ToolComponent locale={locale} />
            </Suspense>
          </div>
        </section>

        <section className="tool-page-modern__seo" aria-label={copy.about}>
          <article className="tool-page-modern__seo-card">
            <h2>{copy.about}</h2>
            <p>{seo.intro}</p>
            <h3>{copy.howTo}</h3>
            <ol>{seo.howTo.map((step) => <li key={step}>{step}</li>)}</ol>
          </article>
          <article className="tool-page-modern__seo-card">
            <h2>{copy.features}</h2>
            <ul>{seo.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
          </article>
        </section>
      </div>
    </main>
  );
}
