import { Suspense, useEffect, useLayoutEffect } from 'react';
import { HeadContent, Scripts, Outlet, createRootRoute, useLocation } from '@tanstack/react-router';
import { FlixoGlobalLogo } from '../components/FlixoGlobalLogo';
import { CommandPalette } from '../components/command-palette';
import { installCoreWebVitalsDiagnostics } from '../lib/diagnostics/performance';
import { applyDocumentLocale, localeFromPathname } from '../lib/i18n/runtime-document-locale';
import { SITE_ORIGIN } from '../lib/i18n';

const GLOBAL_STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE_ORIGIN}/#organization`, name: 'FLIXO', url: SITE_ORIGIN, logo: `${SITE_ORIGIN}/flixo-logo.svg` },
    { '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, name: 'FLIXO', url: SITE_ORIGIN, publisher: { '@id': `${SITE_ORIGIN}/#organization` },
  ],
} as const;

function RouteContent() {
  return <Suspense fallback={<div role="status" aria-live="polite">Loading…</div>}><Outlet /></Suspense>;
}

export const rootRoute = createRootRoute({
  component: function RootLayout() {
    const { pathname } = useLocation();
    useEffect(() => installCoreWebVitalsDiagnostics(), []);
    useLayoutEffect(() => {
      applyDocumentLocale(localeFromPathname(pathname));
    }, [pathname]);
    return <><HeadContent /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(GLOBAL_STRUCTURED_DATA).replace(/</g, '\\u003c') }} /><FlixoGlobalLogo /><CommandPalette /><RouteContent /><Scripts /></>;
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#090d12' },
      { name: 'description', content: 'FLIXO AI Tools — fast browser-first productivity tools with privacy-focused local processing.' },
      { name: 'robots', content: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' },
      { property: 'og:site_name', content: 'FLIXO' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'FLIXO — Fast browser-first tools' },
      { property: 'og:description', content: 'Fast browser-first tools for images, PDFs, audio, video, text, and everyday productivity.' },
      { property: 'og:url', content: SITE_ORIGIN },
      { property: 'og:image', content: `${SITE_ORIGIN}/flixo-logo.svg` },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'FLIXO — Fast browser-first tools' },
      { name: 'twitter:description', content: 'Fast browser-first tools for images, PDFs, audio, video, text, and everyday productivity.' },
      { name: 'twitter:image', content: `${SITE_ORIGIN}/flixo-logo.svg` },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'alternate icon', href: '/logo.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/flixo-logo.svg' },
    ],
  }),
});
