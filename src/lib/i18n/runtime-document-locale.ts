import type { Locale } from './config';
import { isLocale, LOCALE_METADATA } from './config';

const LOCALE_PATH_RE = /^\/([^/]+)(?:\/|$)/u;
const LOCALE_RUNTIME_EVENT = 'flixo:document-locale-path-change';

type HistoryMethod = 'pushState' | 'replaceState';

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

  html.lang = languageTag;
  html.dir = direction;
  html.dataset.flixoLocale = locale;

  document.querySelectorAll<HTMLElement>('main').forEach((main) => {
    main.lang = languageTag;
    main.dir = direction;
  });

  if (
    html.getAttribute('lang') !== languageTag ||
    html.getAttribute('dir') !== direction ||
    html.getAttribute('data-flixo-locale') !== locale
  ) {
    html.setAttribute('lang', languageTag);
    html.setAttribute('dir', direction);
    html.setAttribute('data-flixo-locale', locale);
  }
}

export function installDocumentLocaleContract(getPathname: () => string): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;

  const apply = () => applyDocumentLocale(localeFromPathname(getPathname()));
  const scheduleApply = () => {
    apply();
    window.requestAnimationFrame(apply);
    window.setTimeout(apply, 0);
  };

  scheduleApply();

  const onPathChange = () => scheduleApply();
  window.addEventListener('popstate', onPathChange);
  window.addEventListener('hashchange', onPathChange);
  window.addEventListener(LOCALE_RUNTIME_EVENT, onPathChange);
  document.addEventListener('DOMContentLoaded', scheduleApply, { once: true });
  window.addEventListener('load', scheduleApply, { once: true });

  const htmlObserver = new MutationObserver(() => {
    scheduleApply();
  });
  htmlObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang', 'dir', 'data-flixo-locale'],
  });

  const history = window.history as PatchedHistory;
  let restoreHistory = () => undefined;
  if (!history.__flixoLocalePatched) {
    const originalMethods: Record<HistoryMethod, History[HistoryMethod]> = {
      pushState: history.pushState,
      replaceState: history.replaceState,
    };

    const dispatchPathChange = () => window.dispatchEvent(new Event(LOCALE_RUNTIME_EVENT));

    for (const method of ['pushState', 'replaceState'] as const) {
      const original = originalMethods[method];
      history[method] = function (this: History, ...args: Parameters<History[typeof method]>) {
        const result = original.apply(this, args);
        dispatchPathChange();
        return result;
      } as History[typeof method];
    }

    history.__flixoLocalePatched = true;
    restoreHistory = () => {
      for (const method of ['pushState', 'replaceState'] as const) {
        history[method] = originalMethods[method];
      }
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
    restoreHistory();
  };
}
