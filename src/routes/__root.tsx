import { HeadContent, Scripts, Outlet, createRootRoute, useLocation } from '@tanstack/react-router';
import { useEffect } from 'react';
import { FlixoGlobalLogo } from '../components/FlixoGlobalLogo';
import { CommandPalette } from '../components/command-palette';
import { installCoreWebVitalsDiagnostics } from '../lib/diagnostics/performance';
import { LOCALES, LOCALE_METADATA, isLocale, SITE_ORIGIN } from '../lib/i18n';

const GLOBAL_STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'FLIXO',
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/flixo-logo.svg`,
    },
    {
      '@type': 'WebSite',
      name: 'FLIXO',
      url: SITE_ORIGIN,
    },
  ],
};

function RuntimeHeadNormalization() {
  const location = useLocation();

  useEffect(() => {
    const canonicalPath = location.pathname === '/' ? '/' : location.pathname.replace(/\/+$/u, '');
    const firstSegment = canonicalPath.split('/').filter(Boolean)[0] ?? '';
    const localizedPath = isLocale(firstSegment)
      ? canonicalPath.slice(firstSegment.length + 1) || '/'
      : canonicalPath;
    const expectedCanonical = `${SITE_ORIGIN}${canonicalPath}`;
    const expectedAlternates = [
      ...LOCALES.map((locale) => ({
        hreflang: LOCALE_METADATA[locale].languageTag,
        href: `${SITE_ORIGIN}/${locale}${localizedPath === '/' ? '' : localizedPath}`,
      })),
      {
        hreflang: 'x-default',
        href: `${SITE_ORIGIN}/${LOCALES[0]}${localizedPath === '/' ? '' : localizedPath}`,
      },
    ];

    const normalize = () => {
      const canonicals = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'));
      const matching = canonicals.filter((canonical) => canonical.href === expectedCanonical);
      if (canonicals.length !== 1 || matching.length !== 1) {
        for (const canonical of canonicals) canonical.remove();
        const canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        canonical.setAttribute('href', expectedCanonical);
        document.head.appendChild(canonical);
      }

      const alternates = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]'));
      const current = new Map(alternates.map((link) => [
        `${link.getAttribute('hreflang') ?? ''}|${link.href}`,
        link,
      ]));
      const complete = alternates.length === expectedAlternates.length && expectedAlternates.every(({ hreflang, href }) => current.has(`${hreflang}|${href}`));

      if (!complete) {
        for (const alternate of alternates) alternate.remove();
        for (const { hreflang, href } of expectedAlternates) {
          const alternate = document.createElement('link');
          alternate.setAttribute('rel', 'alternate');
          alternate.setAttribute('hreflang', hreflang);
          alternate.setAttribute('href', href);
          document.head.appendChild(alternate);
        }
      }

      const descriptions = Array.from(document.head.querySelectorAll<HTMLMetaElement>('meta[name="description"]'));
      if (descriptions.length > 1) {
        for (const description of descriptions.slice(0, -1)) description.remove();
      }
    };

    normalize();
    const observer = new MutationObserver(normalize);
    observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'content'] });
    return () => observer.disconnect();
  }, [location.pathname]);

  return null;
}

export const rootRoute = createRootRoute({
  component: () => {
    useEffect(() => installCoreWebVitalsDiagnostics(), []);
    return (
      <>
        <head>
          <title>FLIXO AI Tools</title>
          <meta name="description" content="Fast, private browser-based AI and utility tools." />
          <script type="application/ld+json">{JSON.stringify(GLOBAL_STRUCTURED_DATA)}</script>
        </head>
        <RuntimeHeadNormalization />
        <header><FlixoGlobalLogo /></header>
        <CommandPalette />
        <main><Outlet /></main>
        <Scripts />
      </>
    );
  },
});
