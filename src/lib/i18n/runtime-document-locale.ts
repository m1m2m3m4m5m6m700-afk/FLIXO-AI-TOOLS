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
 * Keeps the canonical document locale enforced throughout the React/router
 * lifecycle. The contract is event-driven: DOM mutations schedule a single
 * microtask re-application instead of polling at a fixed interval.
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

  const apply = () => {
    if (disposed) return;

    const locale = localeFromPathname(getPathname());
    applyDocumentLocale(locale);
  };

  const schedule = () => {
    if (disposed || scheduled) return;

    scheduled = true;

    queueMicrotask(() => {
      scheduled = false;
      apply();
    });
  };

  apply();

  const htmlObserver = new MutationObserver((mutations) => {
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

  return () => {
    disposed = true;
    htmlObserver.disconnect();
    bodyObserver.disconnect();
  };
}
