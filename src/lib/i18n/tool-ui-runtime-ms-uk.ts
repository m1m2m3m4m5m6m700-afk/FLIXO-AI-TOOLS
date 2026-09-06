import { TOOL_UI_I18N } from '../../data/tool-ui-i18n';

const LOCALES = ['ms', 'uk'] as const;
type RuntimeLocale = (typeof LOCALES)[number];

const BASE_COPY = TOOL_UI_I18N.en;
const LOCALIZED_COPY = {
  ms: TOOL_UI_I18N.ms,
  uk: TOOL_UI_I18N.uk,
} as const;

const exactTextMaps: Record<RuntimeLocale, ReadonlyMap<string, string>> = {
  ms: new Map(Object.entries(BASE_COPY).map(([key, value]) => [value, LOCALIZED_COPY.ms[key as keyof typeof LOCALIZED_COPY.ms]])),
  uk: new Map(Object.entries(BASE_COPY).map(([key, value]) => [value, LOCALIZED_COPY.uk[key as keyof typeof LOCALIZED_COPY.uk]])),
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function activeLocale(): RuntimeLocale | null {
  if (typeof document === 'undefined') return null;
  const locale = document.documentElement.lang.toLowerCase().split('-')[0];
  return LOCALES.includes(locale as RuntimeLocale) ? locale as RuntimeLocale : null;
}

function translateText(value: string, locale: RuntimeLocale): string {
  const trimmed = normalizeWhitespace(value);
  const translated = exactTextMaps[locale].get(trimmed);
  return translated ? value.replace(trimmed, translated) : value;
}

function translateRoot(root: ParentNode, locale: RuntimeLocale): void {
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
    const next = translateText(current, locale);
    if (next !== current) node.nodeValue = next;
  }
  root.querySelectorAll?.<HTMLElement>('[aria-label],[title],[placeholder]')?.forEach((element) => {
    if (element.matches('[data-no-auto-i18n]')) return;
    for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const next = translateText(value, locale);
      if (next !== value) element.setAttribute(attribute, next);
    }
  });
}

export function installToolUiMsUkRuntimeCoverage(): () => void {
  if (typeof document === 'undefined' || !document.body) return () => undefined;
  const apply = () => {
    const locale = activeLocale();
    if (locale) translateRoot(document.body, locale);
  };
  apply();
  const observer = new MutationObserver(apply);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-label', 'title', 'placeholder'],
  });
  return () => observer.disconnect();
}
