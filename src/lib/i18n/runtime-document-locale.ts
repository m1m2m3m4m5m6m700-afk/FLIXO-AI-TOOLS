import type { Locale } from './config';
import { isLocale, LOCALE_METADATA } from './config';

const LOCALE_PATH_RE = /^\/([^/]+)(?:\/|$)/u;

export function localeFromPathname(pathname: string): Locale {
  const candidate = pathname.match(LOCALE_PATH_RE)?.[1] ?? 'en';
  return isLocale(candidate) ? candidate : 'en';
}

/**
 * Canonical and only application-owned writer for document-level locale state.
 * Rejects invalid/empty runtime values before they can reach the DOM.
 */
export function applyDocumentLocale(locale: string): void {
  if (typeof document === 'undefined') return;

  const normalized = locale.trim().toLowerCase();
  if (!normalized || !isLocale(normalized)) {
    console.warn(`[Flixo Locale Security] Blocked invalid document locale: ${JSON.stringify(locale)}`);
    return;
  }

  const metadata = LOCALE_METADATA[normalized];
  if (!metadata || !metadata.languageTag || !metadata.direction) {
    console.warn(`[Flixo Locale Security] Blocked document locale without valid metadata: ${normalized}`);
    return;
  }

  const html = document.documentElement;
  const { languageTag, direction } = metadata;

  if (!languageTag.trim()) {
    console.warn(`[Flixo Locale Security] Blocked empty languageTag for locale: ${normalized}`);
    return;
  }

  if (html.getAttribute('lang') !== languageTag) {
    html.setAttribute('lang', languageTag);
  }
  if (html.getAttribute('dir') !== direction) {
    html.setAttribute('dir', direction);
  }
  if (html.getAttribute('data-flixo-locale') !== normalized) {
    html.setAttribute('data-flixo-locale', normalized);
  }

  document.querySelectorAll<HTMLElement>('main').forEach((main) => {
    if (main.getAttribute('lang') !== languageTag) {
      main.setAttribute('lang', languageTag);
    }
    if (main.getAttribute('dir') !== direction) {
      main.setAttribute('dir', direction);
    }
  });
}

/**
 * Installs the document-level locale contract around the router lifecycle.
 * This observer is defensive only: all actual locale writes go through
 * applyDocumentLocale(), so third-party/legacy DOM mutations are repaired
 * without introducing another writer.
 */
export function installDocumentLocaleContract(getPathname: () => string): () => void {
  if (typeof document === 'undefined') return () => undefined;

  const apply = () => applyDocumentLocale(localeFromPathname(getPathname()));
  apply();

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      apply();
    });
  };

  const htmlObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) =>
      mutation.type === 'attributes' &&
      (mutation.attributeName === 'lang' ||
        mutation.attributeName === 'dir' ||
        mutation.attributeName === 'data-flixo-locale')
    )) {
      schedule();
    }
  });
  htmlObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang', 'dir', 'data-flixo-locale'],
  });

  const bodyObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'childList' && mutation.addedNodes.length > 0)) {
      schedule();
    }
  });
  if (document.body) {
    bodyObserver.observe(document.body, {
      subtree: true,
      childList: true,
    });
  }

  return () => {
    htmlObserver.disconnect();
    bodyObserver.disconnect();
  };
}
