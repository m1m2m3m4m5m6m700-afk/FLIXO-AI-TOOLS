import { Suspense, type ComponentType } from 'react';
import { useParams } from '@tanstack/react-router';
import { LOCALES, isLocale, type Locale } from '../lib/i18n';
import { getToolSeo } from '../lib/seo/tool-seo';
import { TOOL_UI_I18N } from '../data/tool-ui-i18n';

export function LocalizedToolPage() {
  const params = useParams({ strict: false });
  const locale = typeof params.locale === 'string' && isLocale(params.locale) ? params.locale : 'en';
  const copy = TOOL_UI_I18N[locale];

  if (typeof params.locale !== 'string' || typeof params.tool !== 'string' || !isLocale(params.locale) || !LOCALES.includes(params.locale)) {
    return <main lang={locale} dir={locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr'}><h1>{copy.notFound}</h1></main>;
  }

  const seo = getToolSeo(params.locale, params.tool);
  if (!seo) return <main lang={locale} dir={locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr'}><h1>{copy.notFound}</h1></main>;

  const ToolComponent = seo.tool.component as unknown as ComponentType<{ locale?: Locale }>;

  return (
    <main lang={seo.languageTag} dir={seo.direction}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ ...seo.structuredData, keywords: seo.keywords }) .replace(/</g, '\\u003c') }} />
      <Suspense fallback={<p>{copy.loading}</p>}>
        <ToolComponent locale={locale} />
      </Suspense>
      <section className="tool-seo-content" aria-label={copy.about}>
        <h2>{copy.about}</h2>
        <p>{seo.intro}</p>
        <h3>{copy.howTo}</h3>
        <ol>{seo.howTo.map((step) => <li key={step}>{step}</li>)}</ol>
        <h3>{copy.features}</h3>
        <ul>{seo.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
      </section>
    </main>
  );
}
