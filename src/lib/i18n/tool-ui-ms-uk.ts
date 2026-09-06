import type { Locale } from './config';

const UI: Readonly<Record<'ms' | 'uk', Readonly<Record<string, string>>>> = {
  ms: {
    Open: 'Buka',
    'Tool Chain': 'Rangkaian alat',
    'Generate captions': 'Jana sari kata',
    'Media file': 'Fail media',
    'Video file': 'Fail video',
    'Inference device': 'Peranti inferens',
    Prompt: 'Arahan',
    'Generate image': 'Jana imej',
    'No result yet.': 'Belum ada hasil.',
    'A cinematic sunset over Cairo...': 'Matahari terbenam sinematik di atas Kaherah...',
  },
  uk: {
    Open: 'Відкрити',
    'Tool Chain': 'Ланцюжок інструментів',
    'Generate captions': 'Створити субтитри',
    'Media file': 'Медіафайл',
    'Video file': 'Відеофайл',
    'Inference device': 'Пристрій інференсу',
    Prompt: 'Запит',
    'Generate image': 'Створити зображення',
    'No result yet.': 'Результату ще немає.',
    'A cinematic sunset over Cairo...': 'Кінематографічний захід сонця над Каїром...',
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
    return `${UI[locale]['Tool Chain']} ${completed}/${total} ${TOOL_CHAIN_STEPS[locale]} ${UI[locale].Open}`;
  }
  const chainStepCount = value.match(/^(\d+)\/8 steps$/);
  if (chainStepCount) return `${chainStepCount[1]}/8 ${TOOL_CHAIN_STEPS[locale]}`;
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
