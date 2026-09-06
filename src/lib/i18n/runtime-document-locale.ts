import type { Locale } from './config';
import { isLocale, LOCALE_METADATA } from './config';

const LOCALE_PATH_RE = /^\/([^/]+)(?:\/|$)/u;
const LOCALE_RUNTIME_EVENT = 'flixo:document-locale-path-change';

type PatchedHistory = History & {
  __flixoLocalePatched?: boolean;
};

export function localeFromPathname(pathname: string): Locale {
  const candidate = pathname.match(LOCALE_PATH_RE)?.[1]?.toLowerCase() ?? 'en';
  return isLocale(candidate) ? candidate : 'en';
}

export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;

  const html = document.documentElement;
  const metadata = LOCALE_METADATA[locale];
  if (!metadata) return;

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

export function installDocumentLocaleContract(getPathname: () => string): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;

  const apply = () => applyDocumentLocale(localeFromPathname(getPathname()));
  const onPathChange = () => apply();

  apply();
  window.addEventListener('popstate', onPathChange);
  window.addEventListener('hashchange', onPathChange);
  window.addEventListener(LOCALE_RUNTIME_EVENT, onPathChange);
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  window.addEventListener('load', apply, { once: true });

  const htmlObserver = new MutationObserver(() => apply());
  htmlObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang', 'dir', 'data-flixo-locale'],
  });

  const history = window.history as PatchedHistory;
  let restoreHistory = () => undefined;

  if (!history.__flixoLocalePatched) {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function pushState(...args) {
      const result = originalPushState.apply(this, args);
      window.dispatchEvent(new Event(LOCALE_RUNTIME_EVENT));
      return result;
    };
    history.replaceState = function replaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      window.dispatchEvent(new Event(LOCALE_RUNTIME_EVENT));
      return result;
    };

    history.__flixoLocalePatched = true;
    restoreHistory = () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      delete history.__flixoLocalePatched;
    };
  }

  const interval = window.setInterval(apply, 250);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener('popstate', onPathChange);
    window.removeEventListener('hashchange', onPathChange);
    window.removeEventListener(LOCALE_RUNTIME_EVENT, onPathChange);
    document.removeEventListener('DOMContentLoaded', apply);
    window.removeEventListener('load', apply);
    htmlObserver.disconnect();
    restoreHistory();
  };
}
