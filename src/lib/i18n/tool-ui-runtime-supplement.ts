import type { Locale } from './config';

type LocaleMap = Readonly<Partial<Record<Locale, string>>>;

const UI_SUPPLEMENT: Readonly<Record<string, LocaleMap>> = {
  'A cinematic sunset over Cairo...': {
    ar: 'غروب سينمائي فوق القاهرة...',
    de: 'Ein filmischer Sonnenuntergang über Kairo …',
    es: 'Una puesta de sol cinematográfica sobre El Cairo...',
    fr: 'Un coucher de soleil cinématographique sur Le Caire...',
    ru: 'Кинематографичный закат над Каиром…',
    zh: '开罗上空的电影感日落……',
    hi: 'काहिरा के ऊपर सिनेमाई सूर्यास्त...',
    id: 'Matahari terbenam sinematik di atas Kairo...',
    ur: 'قاہرہ کے اوپر ایک سنیماٹک غروبِ آفتاب...',
    ja: 'カイロの上に広がる映画のような夕日…',
    pt: 'Um pôr do sol cinematográfico sobre o Cairo...',
    it: 'Un tramonto cinematografico sul Cairo...',
    ko: '카이로 위의 영화 같은 일몰…',
    nl: 'Een filmische zonsondergang boven Caïro...',
    pl: 'Kinowy zachód słońca nad Kairem...',
    tr: 'Kahire üzerinde sinematik bir gün batımı...',
    vi: 'Hoàng hôn điện ảnh trên Cairo...',
    th: 'พระอาทิตย์ตกเหนือไคโรในแบบภาพยนตร์...',
    sv: 'En filmisk solnedgång över Kairo...'
  },
  'WebGPU WASM CPU': {
    ar: 'WebGPU · WASM · CPU',
    de: 'WebGPU · WASM · CPU',
    es: 'WebGPU · WASM · CPU',
    fr: 'WebGPU · WASM · CPU',
    ru: 'WebGPU · WASM · CPU',
    zh: 'WebGPU · WASM · CPU',
    hi: 'WebGPU · WASM · CPU',
    id: 'WebGPU · WASM · CPU',
    ur: 'WebGPU · WASM · CPU',
    ja: 'WebGPU · WASM · CPU',
    pt: 'WebGPU · WASM · CPU',
    it: 'WebGPU · WASM · CPU',
    ko: 'WebGPU · WASM · CPU',
    nl: 'WebGPU · WASM · CPU',
    pl: 'WebGPU · WASM · CPU',
    tr: 'WebGPU · WASM · CPU',
    vi: 'WebGPU · WASM · CPU',
    th: 'WebGPU · WASM · CPU',
    sv: 'WebGPU · WASM · CPU'
  },
  'Separate vocals / instrumental': {
    ar: 'فصل الغناء / الموسيقى',
    de: 'Gesang / Instrumental trennen',
    es: 'Separar voz / instrumental',
    fr: 'Séparer voix / instrumental',
    ru: 'Разделить вокал / инструментал',
    zh: '分离人声 / 伴奏',
    hi: 'वोकल / इंस्ट्रुमेंटल अलग करें',
    id: 'Pisahkan vokal / instrumental',
    ur: 'آواز / ساز الگ کریں',
    ja: 'ボーカル / インストゥルメンタルを分離',
    pt: 'Separar vocais / instrumental',
    it: 'Separa voce / strumentale',
    ko: '보컬 / 반주 분리',
    nl: 'Vocalen / instrumentaal scheiden',
    pl: 'Oddziel wokal / instrumental',
    tr: 'Vokal / enstrümantal ayır',
    vi: 'Tách giọng hát / nhạc nền',
    th: 'แยกเสียงร้อง / ดนตรี',
    sv: 'Separera sång / instrumental'
  },
  'Audio waveform': {
    ar: 'الموجة الصوتية',
    de: 'Audio-Wellenform',
    es: 'Forma de onda de audio',
    fr: 'Forme d’onde audio',
    ru: 'Аудиоволна',
    zh: '音频波形',
    hi: 'ऑडियो वेवफ़ॉर्म',
    id: 'Bentuk gelombang audio',
    ur: 'آڈیو موجی شکل',
    ja: 'オーディオ波形',
    pt: 'Forma de onda de áudio',
    it: 'Forma d’onda audio',
    ko: '오디오 파형',
    nl: 'Audiogolfvorm',
    pl: 'Fala audio',
    tr: 'Ses dalga biçimi',
    vi: 'Dạng sóng âm thanh',
    th: 'รูปคลื่นเสียง',
    sv: 'Ljudvågform'
  },
  Encode: {
    ar: 'ترميز', de: 'Kodieren', es: 'Codificar', fr: 'Encoder', ru: 'Кодировать', zh: '编码', hi: 'एन्कोड करें', id: 'Enkode', ur: 'انکوڈ کریں', ja: 'エンコード', pt: 'Codificar', it: 'Codifica', ko: '인코딩', nl: 'Coderen', pl: 'Koduj', tr: 'Kodla', vi: 'Mã hóa', th: 'เข้ารหัส', sv: 'Koda'
  },
  Decode: {
    ar: 'فك الترميز', de: 'Dekodieren', es: 'Decodificar', fr: 'Décoder', ru: 'Декодировать', zh: '解码', hi: 'डिकोड करें', id: 'Dekode', ur: 'ڈی کوڈ کریں', ja: 'デコード', pt: 'Decodificar', it: 'Decodifica', ko: '디코딩', nl: 'Decoderen', pl: 'Dekoduj', tr: 'Kodu çöz', vi: 'Giải mã', th: 'ถอดรหัส', sv: 'Avkoda'
  },
  'Preview Data URI': {
    ar: 'معاينة Data URI',
    de: 'Data-URI-Vorschau',
    es: 'Vista previa de Data URI',
    fr: 'Aperçu de Data URI',
    ru: 'Предпросмотр Data URI',
    zh: '预览 Data URI',
    hi: 'Data URI पूर्वावलोकन',
    id: 'Pratinjau Data URI',
    ur: 'Data URI پیش منظر',
    ja: 'Data URI をプレビュー',
    pt: 'Pré-visualizar Data URI',
    it: 'Anteprima Data URI',
    ko: 'Data URI 미리보기',
    nl: 'Data URI-voorbeeld',
    pl: 'Podgląd Data URI',
    tr: 'Data URI önizlemesi',
    vi: 'Xem trước Data URI',
    th: 'ดูตัวอย่าง Data URI',
    sv: 'Förhandsvisa Data URI'
  }
};

export function translateSupplement(locale: Locale, value: string): string {
  if (locale === 'en') return value;
  const replacement = UI_SUPPLEMENT[value.trim()]?.[locale];
  return replacement ? value.replace(value.trim(), replacement) : value;
}

export function installToolUiRuntimeSupplement(): () => void {
  const translate = () => {
    const locale = document.documentElement.lang.split('-')[0] as Locale;
    if (!locale || locale === 'en' || !document.body) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const parent = node.parentElement;
      if (!node.nodeValue?.trim() || !parent || parent.closest('script,style,pre,textarea,[contenteditable="true"],[data-no-auto-i18n]')) continue;
      const next = translateSupplement(locale, node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
    document.body.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((element) => {
      if (element.matches('[data-no-auto-i18n]')) return;
      for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
        const value = element.getAttribute(attribute);
        if (!value) continue;
        const next = translateSupplement(locale, value);
        if (next !== value) element.setAttribute(attribute, next);
      }
    });
  };
  const observer = new MutationObserver(translate);
  translate();
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });
  return () => observer.disconnect();
}
