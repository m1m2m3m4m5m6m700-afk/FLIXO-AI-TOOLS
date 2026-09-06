import type { Locale } from './config';

const UI: Readonly<Record<'ms' | 'uk', Readonly<Record<string, string>>>> = {
  ms: {
    Open: 'Buka',
    'Generate captions': 'Jana sari kata',
    'Media file': 'Fail media',
    'Inference device': 'Peranti inferens',
  },
  uk: {
    Open: 'Відкрити',
    'Generate captions': 'Створити субтитри',
    'Media file': 'Медіафайл',
    'Inference device': 'Пристрій інференсу',
  },
};

const TOOL_CHAIN_STEPS: Readonly<Record<'ms' | 'uk', string>> = {
  ms: 'langkah',
  uk: 'кроків',
};

function translateValue(locale: 'ms' | 'uk', value: string): string {
  const toolChain = value.match(/^Tool Chain (\d+)\/(\d+) steps Open$/);
  if (toolChain) {
    const [, completed, total] = toolChain;
    const chain = locale === 'ms' ? 'Rangkaian alat' : 'Ланцюжок інструментів';
    const open = UI[locale].Open;
    return `${chain} ${completed}/${total} ${TOOL_CHAIN_STEPS[locale]} ${open}`;
  }
  return UI[locale][value] ?? value;
}

function translateRoot(root: ParentNode, locale: 'ms' | 'uk'): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!node.nodeValue?.trim() || !parent || parent.closest('script,style,pre,textarea,[contenteditable="true"],[data-no-auto-i18n]')) continue;
    nodes.push(node);
  }
  for (const node of nodes) {
    const next = translateValue(locale, node.nodeValue ?? '');
    if (next !== node.nodeValue) node.nodeValue = next;
  }
  root.querySelectorAll?.<HTMLElement>('[aria-label],[title],[placeholder]')?.forEach((element) => {
    if (element.matches('[data-no-auto-i18n]')) return;
    for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const next = translateValue(locale, value);
      if (next !== value) element.setAttribute(attribute, next);
    }
  });
}

export function installToolUiMsUkLocalization(): () => void {
  if (typeof document === 'undefined' || !document.body) return () => undefined;
  const apply = () => {
    const locale = document.documentElement.lang.split('-')[0] as Locale;
    if (locale === 'ms' || locale === 'uk') translateRoot(document.body, locale);
  };
  apply();
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });
  return () => observer.disconnect();
}
