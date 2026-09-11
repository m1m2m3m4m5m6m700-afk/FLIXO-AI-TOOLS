import { translateValue } from './tool-ui-runtime-completeness';
import type { Locale } from './config';

type Apply = (root: Element, locale: Locale) => void;

const ROOT_SELECTOR = '[data-flixo-i18n-root]';
const LOCALIZED_ATTRIBUTES = ['aria-label', 'title', 'placeholder'] as const;

/**
 * Apply the legacy-compatible localization map only inside an explicitly
 * declared tool root. This is intentionally scoped and batched; it never
 * observes or rewrites document.body.
 */
export function localizeScopedRoot(root: Element, locale: Locale, toolId: string): void {
  if (locale === 'en') return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    if (parent && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE') textNodes.push(node as Text);
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const next = translateValue(locale, textNode.nodeValue ?? '', toolId);
    if (next !== textNode.nodeValue) textNode.nodeValue = next;
  }

  root.querySelectorAll<HTMLElement>('*').forEach((element) => {
    for (const attribute of LOCALIZED_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (value === null) continue;
      const next = translateValue(locale, value, toolId);
      if (next !== value) element.setAttribute(attribute, next);
    }
  });
}

/**
 * Compatibility boundary for tool surfaces that still contain legacy literal
 * UI copy. Only declared i18n roots are processed, and mutations are batched
 * into one animation frame.
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
