import type { CanonicalLocale } from './config';
import { DEFAULT_LOCALE, isLocale, LOCALE_METADATA } from './config';

const LOCALE_PATH_RE = /^\/([^/]+)(?:\/|$)/u;
const LOCALE_RUNTIME_EVENT = 'flixo:document-locale-path-change';

type PatchedHistory = History & {
  __flixoLocalePatched?: boolean;
};

function canonicalLocale(value: string | null | undefined): CanonicalLocale {
  const candidate = value?.trim().toLowerCase() ?? '';
  return isLocale(candidate) ? candidate : DEFAULT_LOCALE;
}

export function localeFromPathname(pathname: string): CanonicalLocale {
  const candidate = pathname?.match(LOCALE_PATH_RE)?.[1] ?? '';
  return canonicalLocale(candidate);
}

export function applyDocumentLocale(locale: CanonicalLocale): void {
  if (typeof document === 'undefined') return;

  const html = document.documentElement;
  const safeLocale = canonicalLocale(locale);
  const metadata = LOCALE_METADATA[safeLocale];
  if (!metadata) return;

  const languageTag = metadata.languageTag.trim();
  const direction = metadata.direction;
  if (!languageTag) return;

  if (html.getAttribute('lang') !== languageTag) html.setAttribute('lang', languageTag);
  if (html.getAttribute('dir') !== direction) html.setAttribute('dir', direction);
  if (html.getAttribute('data-flixo-locale') !== safeLocale) html.setAttribute('data-flixo-locale', safeLocale);

  document.querySelectorAll<HTMLElement>('main').forEach((main) => {
    if (main.getAttribute('lang') !== languageTag) main.setAttribute('lang', languageTag);
    if (main.getAttribute('dir') !== direction) main.setAttribute('dir', direction);
  });
}

export function installDocumentLocaleContract(getPathname: () => string): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;

  const readPathname = () => {
    try {
      const pathname = getPathname();
      return typeof pathname === 'string' ? pathname : '/';
    } catch {
      return '/';
    }
  };

  const apply = () => applyDocumentLocale(localeFromPathname(readPathname()));
  const scheduleApply = () => {
    apply();
    queueMicrotask(apply);
    window.requestAnimationFrame(apply);
    window.setTimeout(apply, 0);
  };
  const onPathChange = () => scheduleApply();

  scheduleApply();
  window.addEventListener('popstate', onPathChange);
  window.addEventListener('hashchange', onPathChange);
  window.addEventListener(LOCALE_RUNTIME_EVENT, onPathChange);
  document.addEventListener('DOMContentLoaded', scheduleApply, { once: true });
  window.addEventListener('load', scheduleApply, { once: true });

  const htmlObserver = new MutationObserver(() => scheduleApply());
  htmlObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang', 'dir', 'data-flixo-locale'],
  });

  const documentObserver = new MutationObserver(() => {
    if (document.documentElement) scheduleApply();
  });
  documentObserver.observe(document, {
    childList: true,
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
    document.removeEventListener('DOMContentLoaded', scheduleApply);
    window.removeEventListener('load', scheduleApply);
    htmlObserver.disconnect();
    documentObserver.disconnect();
    restoreHistory();
  };
}
