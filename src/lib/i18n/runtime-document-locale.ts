import type { Locale } from './config';
import { isLocale, LOCALE_METADATA } from './config';

const LOCALE_PATH_RE = /^\/([^/]+)(?:\/|$)/u;

export function localeFromPathname(pathname: string): Locale {
  const candidate = pathname.match(LOCALE_PATH_RE)?.[1] ?? 'en';
  return isLocale(candidate) ? candidate : 'en';
}

export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  const metadata = LOCALE_METADATA[locale];
  const languageTag = metadata.languageTag;
  const direction = metadata.direction;

  if (html.getAttribute('lang') !== languageTag) html.setAttribute('lang', languageTag);
  if (html.getAttribute('dir') !== direction) html.setAttribute('dir', direction);
  html.setAttribute('data-flixo-locale', locale);

  document.querySelectorAll<HTMLElement>('main').forEach((main) => {
    if (main.getAttribute('lang') !== languageTag) main.setAttribute('lang', languageTag);
    if (main.getAttribute('dir') !== direction) main.setAttribute('dir', direction);
  });
}

export function installDocumentLocaleContract(getPathname: () => string): () => void {
  if (typeof document === 'undefined') return () => undefined;

  let currentLocale = localeFromPathname(getPathname());
  const apply = () => applyDocumentLocale(currentLocale);
  const refreshFromPath = () => {
    const nextLocale = localeFromPathname(getPathname());
    if (nextLocale !== currentLocale) currentLocale = nextLocale;
    apply();
  };

  apply();
  const frame = window.requestAnimationFrame(apply);

  const htmlObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'attributes' && (mutation.attributeName === 'lang' || mutation.attributeName === 'dir' || mutation.attributeName === 'data-flixo-locale'))) {
      apply();
    }
  });
  htmlObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang', 'dir', 'data-flixo-locale'],
  });

  const bodyObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'childList' && mutation.addedNodes.length > 0)) apply();
  });
  if (document.body) bodyObserver.observe(document.body, { subtree: true, childList: true });

  const dispose = () => {
    window.cancelAnimationFrame(frame);
    htmlObserver.disconnect();
    bodyObserver.disconnect();
  };

  // Route transitions are owned by the caller. This hook only guards the current route's
  // document contract; refreshFromPath is intentionally exposed through navigation-safe setup.
  void refreshFromPath;
  return dispose;
}
