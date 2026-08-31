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
  if (html.getAttribute('data-flixo-locale') !== locale) html.setAttribute('data-flixo-locale', locale);

  document.querySelectorAll<HTMLElement>('main').forEach((main) => {
    if (main.getAttribute('lang') !== languageTag) main.setAttribute('lang', languageTag);
    if (main.getAttribute('dir') !== direction) main.setAttribute('dir', direction);
  });
}

/**
 * Installs the document-level locale contract outside React's lifecycle.
 * The pathname is evaluated on every enforcement pass so the observer remains
 * correct across client-side navigation and DOM replacement.
 */
export function installDocumentLocaleContract(getPathname: () => string): () => void {
  if (typeof document === 'undefined') return () => undefined;

  const apply = () => applyDocumentLocale(localeFromPathname(getPathname()));
  apply();

  const frame = window.requestAnimationFrame(apply);
  const interval = window.setInterval(apply, 250);

  const htmlObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'attributes' && (mutation.attributeName === 'lang' || mutation.attributeName === 'dir' || mutation.attributeName === 'data-flixo-locale'))) {
      apply();
    }
  });
  htmlObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang', 'dir', 'data-flixo-locale'],
  });

  const documentObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'childList')) apply();
  });
  documentObserver.observe(document, { childList: true, subtree: false });

  const bodyObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => {
      if (mutation.type === 'childList') return mutation.addedNodes.length > 0;
      if (mutation.type === 'attributes') return mutation.target instanceof HTMLElement && mutation.target.tagName === 'MAIN';
      return false;
    })) {
      apply();
    }
  });
  if (document.body) {
    bodyObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['lang', 'dir'],
    });
  }

  return () => {
    window.cancelAnimationFrame(frame);
    window.clearInterval(interval);
    htmlObserver.disconnect();
    documentObserver.disconnect();
    bodyObserver.disconnect();
  };
}
