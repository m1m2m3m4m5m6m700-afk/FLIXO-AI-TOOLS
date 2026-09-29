import type { Locale } from './config';
import { isLocale, LOCALE_METADATA } from './config';

const LOCALE_PATH_RE = /^\/([^/]+)(?:\/|$)/u;

export function localeFromPathname(pathname: string): Locale {
  const candidate = pathname.match(LOCALE_PATH_RE)?.[1] ?? 'en';
  return isLocale(candidate) ? candidate : 'en';
}

/**
 * Canonical and only application-owned writer for document-level locale state.
 * Runtime locale values are validated and resolved through LOCALE_METADATA
 * before any DOM mutation is allowed.
 */
export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;

  const metadata = LOCALE_METADATA[locale];
  if (!metadata || !metadata.languageTag || !metadata.direction) return;

  const html = document.documentElement;
  const { languageTag, direction } = metadata;

  if (!languageTag.trim()) return;

  if (html.getAttribute('lang') !== languageTag) {
    html.setAttribute('lang', languageTag);
  }
  if (html.getAttribute('dir') !== direction) {
    html.setAttribute('dir', direction);
  }
  if (html.getAttribute('data-flixo-locale') !== locale) {
    html.setAttribute('data-flixo-locale', locale);
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
 * Installs the document-level locale integrity contract around the router
 * lifecycle. The guards are registered before the first repair so a later
 * synchronous DOM writer cannot create an unobserved locale drift window.
 */
export function installDocumentLocaleContract(
  getPathname: () => string,
): () => void {
  if (
    typeof document === 'undefined' ||
    typeof MutationObserver === 'undefined'
  ) {
    return () => undefined;
  }

  let disposed = false;
  let scheduled = false;
  let repairing = false;

  const repair = () => {
    if (disposed || repairing) return;

    const locale = localeFromPathname(getPathname());
    repairing = true;
    try {
      applyDocumentLocale(locale);
    } finally {
      repairing = false;
    }
  };

  const schedule = () => {
    if (disposed || scheduled) return;

    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      repair();
    });
  };

  const htmlObserver = new MutationObserver((mutations) => {
    if (disposed || repairing) return;

    if (
      mutations.some(
        (mutation) =>
          mutation.type === 'attributes' &&
          (mutation.attributeName === 'lang' ||
            mutation.attributeName === 'dir' ||
            mutation.attributeName === 'data-flixo-locale'),
      )
    ) {
      schedule();
    }
  });

  htmlObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang', 'dir', 'data-flixo-locale'],
  });

  const bodyObserver = new MutationObserver((mutations) => {
    if (disposed || repairing) return;

    if (
      mutations.some(
        (mutation) =>
          mutation.type === 'childList' &&
          mutation.addedNodes.length > 0,
      )
    ) {
      schedule();
    }
  });

  if (document.body) {
    bodyObserver.observe(document.body, {
      subtree: true,
      childList: true,
    });
  }

  // Initial repair occurs only after both guards are active. This closes the
  // apply-before-observe race identified by the G4 runtime failure.
  repair();

  return () => {
    disposed = true;
    scheduled = false;
    htmlObserver.disconnect();
    bodyObserver.disconnect();
  };
}
