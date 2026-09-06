import type { Locale } from './config';

const LABELS: Readonly<Partial<Record<Locale, string>>> = {
  ar: 'جهاز الاستدلال',
  de: 'Inferenzgerät',
  es: 'Dispositivo de inferencia',
  fr: 'Appareil d’inférence',
  ru: 'Устройство вывода',
  zh: '推理设备',
  hi: 'इन्फरेंस डिवाइस',
  id: 'Perangkat inferensi',
  ur: 'استدلالی آلہ',
  ja: '推論デバイス',
  pt: 'Dispositivo de inferência',
  it: 'Dispositivo di inferenza',
  ko: '추론 장치',
  nl: 'Inferentieapparaat',
  pl: 'Urządzenie inferencyjne',
  tr: 'Çıkarım cihazı',
  vi: 'Thiết bị suy luận',
  th: 'อุปกรณ์อนุมาน',
  sv: 'Inferensenhet',
  ms: 'Peranti inferens',
  uk: 'Пристрій інференсу',
};

export function installToolUiInferenceDeviceLocalization(): () => void {
  if (typeof document === 'undefined' || !document.body) return () => undefined;
  const apply = () => {
    const locale = document.documentElement.lang.split('-')[0] as Locale;
    const translated = LABELS[locale];
    if (!translated) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.nodeValue?.trim() === 'Inference device') nodes.push(node);
    }
    for (const node of nodes) node.nodeValue = translated;
    document.body.querySelectorAll<HTMLElement>('[aria-label="Inference device"]').forEach((element) => element.setAttribute('aria-label', translated));
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
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label'] });
  return () => observer.disconnect();
}
