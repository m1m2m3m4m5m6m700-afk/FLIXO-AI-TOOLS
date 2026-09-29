import type { Locale } from './config';

type Apply = (root: Element, locale: Locale) => void;

const ROOT_SELECTOR = '[data-flixo-i18n-root]';

/**
 * Legacy-runtime compatibility boundary: observes only declared i18n roots,
 * batches mutations into one animation-frame, and never owns the whole body.
 */
export function installScopedRuntimeObserver(apply: Apply): () => void {
  if (typeof document === 'undefined') return () => undefined;

  const roots = (): Element[] => Array.from(document.querySelectorAll(ROOT_SELECTOR));
  const getLocale = (): Locale => (document.documentElement.lang.split('-')[0] || 'en') as Locale;
  let frame: number | null = null;
  let disposed = false;

  const flush = (): void => {
    frame = null;
    if (disposed) return;
    const locale = getLocale();
    if (locale === 'en') return;
    for (const root of roots()) apply(root, locale);
  };

  const schedule = (): void => {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(flush);
  };

  schedule();
  const observer = new MutationObserver((records) => {
    if (records.some((record) => Array.from(record.addedNodes).some((node) => {
      return node.nodeType === Node.ELEMENT_NODE && (node as Element).matches(ROOT_SELECTOR);
    }))) {
      schedule();
      return;
    }
    if (records.some((record) => {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      return !!target?.closest(ROOT_SELECTOR);
    })) schedule();
  });

  const observeRoot = document.getElementById('root');
  if (!observeRoot) return () => undefined;
  observer.observe(observeRoot, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });

  return () => {
    disposed = true;
    observer.disconnect();
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
  };
}
