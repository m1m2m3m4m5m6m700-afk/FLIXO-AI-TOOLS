import type { Locale } from './config';
import { isLocale, LOCALE_METADATA } from './config';

const LOCALE_PATH_RE = /^\/([^/]+)(?:\/|$)/u;

export function localeFromPathname(pathname: string): Locale {
  const candidate = pathname.match(LOCALE_PATH_RE)?.[1] ?? 'en';
  return isLocale(candidate) ? candidate : 'en';
}

/** Canonical document-locale writer: synchronous, idempotent, and lifecycle-local. */
export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;

  const metadata = LOCALE_METADATA[locale];
  if (!metadata) return;

  const html = document.documentElement;
  const { languageTag, direction } = metadata;

  if (html.getAttribute('lang') !== languageTag) html.setAttribute('lang', languageTag);
  if (html.getAttribute('dir') !== direction) html.setAttribute('dir', direction);
  if (html.getAttribute('data-flixo-locale') !== locale) html.setAttribute('data-flixo-locale', locale);

  document.querySelectorAll<HTMLElement>('main').forEach((main) => {
    if (main.getAttribute('lang') !== languageTag) main.setAttribute('lang', languageTag);
    if (main.getAttribute('dir') !== direction) main.setAttribute('dir', direction);
  });
}
