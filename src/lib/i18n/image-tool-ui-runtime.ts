import type { Locale } from './config';
import { IMAGE_TOOL_PREFIXES, IMAGE_TOOL_UI } from './image-tool-ui-i18n';

function translateValue(locale: Locale, value: string): string {
  if (locale === 'en') return value;
  const trimmed = value.trim();
  const exact = IMAGE_TOOL_UI[trimmed]?.[locale];
  if (exact) return value.replace(trimmed, exact);
  for (const [prefix, map] of IMAGE_TOOL_PREFIXES) {
    if (value.startsWith(prefix)) return `${map[locale] ?? prefix}${value.slice(prefix.length)}`;
  }
  return value;
}

function translateRoot(root: ParentNode, locale: Locale): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!node.nodeValue?.trim() || !parent || parent.closest('script,style,pre,textarea,[contenteditable="true"],[data-no-auto-i18n]')) continue;
    nodes.push(node);
  }
  for (const node of nodes) {
    const current = node.nodeValue ?? '';
    const next = translateValue(locale, current);
    if (next !== current) node.nodeValue = next;
  }
  root.querySelectorAll?.<HTMLElement>('[aria-label],[title],[placeholder]')?.forEach((element) => {
    if (element.matches('[data-no-auto-i18n]')) return;
    for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const next = translateValue(locale, current);
      if (next !== current) element.setAttribute(attribute, next);
    }
  });
}

export function installImageToolUiRuntimeLocalization(): () => void {
  if (typeof document === 'undefined' || !document.body) return () => undefined;
  const apply = () => {
    const locale = (document.documentElement.lang.split('-')[0] || 'en') as Locale;
    if (locale !== 'en') translateRoot(document.body, locale);
  };
  apply();
  const observer = new MutationObserver(apply);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });
  return () => observer.disconnect();
}
