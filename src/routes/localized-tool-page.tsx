import { Suspense } from 'react';
import { useParams } from '@tanstack/react-router';
import { LOCALES, isLocale } from '../lib/i18n';
import { getToolSeo } from '../lib/seo/tool-seo';
import { TOOL_UI_I18N } from '../data/tool-ui-i18n';

export function LocalizedToolPage() {
  const params = useParams({ strict: false });
  const locale = typeof params.locale === 'string' && isLocale(params.locale) ? params.locale : 'en';
  const copy = locale === 'ar' ? TOOL_UI_I18N.ar : TOOL_UI_I18N.en;

  if (typeof params.locale !== 'string' || typeof params.tool !== 'string' || !isLocale(params.locale) || !LOCALES.includes(params.locale)) {
    return <main lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}><h1>{copy.notFound}</h1></main>;
  }

  const seo = getToolSeo(params.locale, params.tool);
  if (!seo) return <main lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}><h1>{copy.notFound}</h1></main>;

  const ToolComponent = seo.tool.component;

  return (
    <main lang={seo.languageTag} dir={seo.direction}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.structuredData).replace(/</g, '\\u003c') }} />
      <Suspense fallback={<p>{copy.loading}</p>}>
        <ToolComponent />
      </Suspense>
    </main>
  );
}
