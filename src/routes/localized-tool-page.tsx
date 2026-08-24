import { Suspense, type ComponentType } from 'react';
import { useParams } from '@tanstack/react-router';
import { LOCALES, isLocale, type Locale } from '../lib/i18n';
import { getToolSeo } from '../lib/seo/tool-seo';
import { TOOL_UI_I18N } from '../data/tool-ui-i18n';
import '../tool-page-modern.css';

export function LocalizedToolPage() {
  const params = useParams({ strict: false });
  const locale = typeof params.locale === 'string' && isLocale(params.locale) ? params.locale : 'en';
  const copy = TOOL_UI_I18N[locale];
  const isRtl = locale === 'ar' || locale === 'ur';

  if (typeof params.locale !== 'string' || typeof params.tool !== 'string' || !isLocale(params.locale) || !LOCALES.includes(params.locale)) {
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

  const seo = getToolSeo(params.locale, params.tool);
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
  const homeUrl = `/${locale}`;
  const englishToolUrl = `/en/${seo.tool.id}`;
  const arabicToolUrl = `/ar/${seo.tool.id}`;
  const alternateUrl = locale === 'ar' ? englishToolUrl : arabicToolUrl;
  const alternateLabel = locale === 'ar' ? 'English' : 'العربية';
  const capabilities = seo.tool.description.split(' ').slice(0, 0);

  return (
    <main lang={seo.languageTag} dir={seo.direction} className="tool-page-modern">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ ...seo.structuredData, keywords: seo.keywords }).replace(/</g, '\\u003c') }}
      />

      <nav className="tool-page-modern__nav" aria-label="FLIXO tool navigation">
        <div className="tool-page-modern__nav-inner">
          <a className="tool-page-modern__brand" href={homeUrl} aria-label="FLIXO home">
            <span className="tool-page-modern__brand-mark">F</span>
            FLIXO
          </a>
          <div className="tool-page-modern__nav-actions">
            <a className="tool-page-modern__nav-link" href={homeUrl}>← {copy.about === 'حول هذه الأداة' ? 'الرئيسية' : 'Home'}</a>
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
                  <span className="tool-page-modern__badge"><span className="tool-page-modern__badge-dot" /> {copy.loading.replace('…', '') === 'Loading FLIXO tool' ? 'Browser-first' : 'FLIXO'}</span>
                  <span className="tool-page-modern__chip">{seo.languageTag}</span>
                  <span className="tool-page-modern__chip">{seo.tool.category}</span>
                  <span className="tool-page-modern__chip">{capabilities.length === 0 ? 'Ready' : 'Ready'}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="tool-page-modern__workspace" aria-label={seo.tool.title}>
          <div className="tool-page-modern__workspace-bar">
            <span className="tool-page-modern__status"><span className="tool-page-modern__status-led" /> FLIXO TOOL WORKSPACE</span>
            <span>{seo.languageTag} · {seo.tool.id}</span>
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
