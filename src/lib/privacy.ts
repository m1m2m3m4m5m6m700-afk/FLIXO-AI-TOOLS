import type { Locale } from './i18n/config';

type PrivacyCopy = {
  localLabel: string;
  localDetail: string;
  remoteLabel: string;
  remoteDetail: string;
};

export type ProcessingMode = 'local' | 'remote';

const REMOTE_TOOL_IDS = new Set(['ai-image-generator']);

const PRIVACY_COPY: Record<Locale, PrivacyCopy> = {
  en: {
    localLabel: 'Local processing',
    localDetail: 'Inputs are processed in your browser when supported by the tool.',
    remoteLabel: 'External processing',
    remoteDetail: 'This tool uses a configured external processing endpoint and is not presented as local-only.',
  },
  ar: {
    localLabel: 'معالجة محلية',
    localDetail: 'تتم معالجة المدخلات داخل متصفحك عندما تسمح طبيعة الأداة بذلك.',
    remoteLabel: 'معالجة خارجية',
    remoteDetail: 'تستخدم هذه الأداة نقطة معالجة خارجية مُهيأة، ولا تُعرض كأداة معالجة محلية فقط.',
  },
  de: {
    localLabel: 'Lokale Verarbeitung',
    localDetail: 'Eingaben werden direkt im Browser verarbeitet, wenn das Tool dies unterstützt.',
    remoteLabel: 'Externe Verarbeitung',
    remoteDetail: 'Dieses Tool verwendet einen konfigurierten externen Verarbeitungsendpunkt und wird nicht als rein lokal verarbeitet dargestellt.',
  },
  es: {
    localLabel: 'Procesamiento local',
    localDetail: 'Las entradas se procesan en tu navegador cuando la herramienta lo admite.',
    remoteLabel: 'Procesamiento externo',
    remoteDetail: 'Esta herramienta utiliza un punto de procesamiento externo configurado y no se presenta como de procesamiento exclusivamente local.',
  },
  fr: {
    localLabel: 'Traitement local',
    localDetail: 'Les entrées sont traitées dans votre navigateur lorsque l’outil le permet.',
    remoteLabel: 'Traitement externe',
    remoteDetail: 'Cet outil utilise un point de traitement externe configuré et n’est pas présenté comme étant uniquement local.',
  },
  ru: {
    localLabel: 'Локальная обработка',
    localDetail: 'Входные данные обрабатываются в браузере, если инструмент это поддерживает.',
    remoteLabel: 'Внешняя обработка',
    remoteDetail: 'Этот инструмент использует настроенную внешнюю конечную точку обработки и не представлен как полностью локальный.',
  },
  zh: {
    localLabel: '本地处理',
    localDetail: '在工具支持的情况下，输入内容会在浏览器中处理。',
    remoteLabel: '外部处理',
    remoteDetail: '此工具使用已配置的外部处理端点，并不会被呈现为仅本地处理。',
  },
  hi: {
    localLabel: 'स्थानीय प्रोसेसिंग',
    localDetail: 'टूल द्वारा समर्थित होने पर इनपुट आपके ब्राउज़र में प्रोसेस किए जाते हैं।',
    remoteLabel: 'बाहरी प्रोसेसिंग',
    remoteDetail: 'यह टूल कॉन्फ़िगर किए गए बाहरी प्रोसेसिंग एंडपॉइंट का उपयोग करता है और इसे केवल स्थानीय प्रोसेसिंग के रूप में प्रस्तुत नहीं किया जाता।',
  },
  id: {
    localLabel: 'Pemrosesan lokal',
    localDetail: 'Input diproses di browser Anda jika alat mendukungnya.',
    remoteLabel: 'Pemrosesan eksternal',
    remoteDetail: 'Alat ini menggunakan endpoint pemrosesan eksternal yang telah dikonfigurasi dan tidak disajikan sebagai pemrosesan lokal saja.',
  },
  ur: {
    localLabel: 'مقامی پروسیسنگ',
    localDetail: 'اگر ٹول سپورٹ کرے تو ان پٹس آپ کے براؤزر میں پروسیس ہوتے ہیں۔',
    remoteLabel: 'بیرونی پروسیسنگ',
    remoteDetail: 'یہ ٹول ایک ترتیب دیے گئے بیرونی پروسیسنگ اینڈ پوائنٹ کو استعمال کرتا ہے اور اسے صرف مقامی پروسیسنگ کے طور پر پیش نہیں کیا جاتا۔',
  },
  ja: {
    localLabel: 'ローカル処理',
    localDetail: 'ツールが対応している場合、入力はブラウザ内で処理されます。',
    remoteLabel: '外部処理',
    remoteDetail: 'このツールは設定済みの外部処理エンドポイントを使用し、ローカル処理のみとして表示されません。',
  },
  pt: {
    localLabel: 'Processamento local',
    localDetail: 'As entradas são processadas no navegador quando a ferramenta oferece suporte.',
    remoteLabel: 'Processamento externo',
    remoteDetail: 'Esta ferramenta usa um endpoint externo de processamento configurado e não é apresentada como exclusivamente local.',
  },
  it: {
    localLabel: 'Elaborazione locale',
    localDetail: 'Gli input vengono elaborati nel browser quando lo strumento lo supporta.',
    remoteLabel: 'Elaborazione esterna',
    remoteDetail: 'Questo strumento usa un endpoint esterno configurato e non viene presentato come elaborazione esclusivamente locale.',
  },
  ko: {
    localLabel: '로컬 처리',
    localDetail: '도구에서 지원하는 경우 입력 데이터는 브라우저에서 처리됩니다.',
    remoteLabel: '외부 처리',
    remoteDetail: '이 도구는 구성된 외부 처리 엔드포인트를 사용하며 로컬 전용 처리로 표시되지 않습니다.',
  },
  nl: {
    localLabel: 'Lokale verwerking',
    localDetail: 'Invoer wordt in je browser verwerkt wanneer de tool dit ondersteunt.',
    remoteLabel: 'Externe verwerking',
    remoteDetail: 'Deze tool gebruikt een geconfigureerd extern verwerkingseindpunt en wordt niet als uitsluitend lokaal verwerkt gepresenteerd.',
  },
  pl: {
    localLabel: 'Przetwarzanie lokalne',
    localDetail: 'Dane wejściowe są przetwarzane w przeglądarce, gdy narzędzie to obsługuje.',
    remoteLabel: 'Przetwarzanie zewnętrzne',
    remoteDetail: 'To narzędzie korzysta ze skonfigurowanego zewnętrznego punktu przetwarzania i nie jest przedstawiane jako wyłącznie lokalne.',
  },
  tr: {
    localLabel: 'Yerel işleme',
    localDetail: 'Araç desteklediğinde girdiler tarayıcınızda işlenir.',
    remoteLabel: 'Harici işleme',
    remoteDetail: 'Bu araç yapılandırılmış bir harici işleme uç noktası kullanır ve yalnızca yerel işleme olarak sunulmaz.',
  },
  vi: {
    localLabel: 'Xử lý cục bộ',
    localDetail: 'Dữ liệu đầu vào được xử lý trong trình duyệt khi công cụ hỗ trợ.',
    remoteLabel: 'Xử lý bên ngoài',
    remoteDetail: 'Công cụ này sử dụng điểm cuối xử lý bên ngoài đã cấu hình và không được trình bày là chỉ xử lý cục bộ.',
  },
  th: {
    localLabel: 'ประมวลผลภายในเครื่อง',
    localDetail: 'อินพุตจะถูกประมวลผลในเบราว์เซอร์เมื่อเครื่องมือรองรับ',
    remoteLabel: 'ประมวลผลภายนอก',
    remoteDetail: 'เครื่องมือนี้ใช้ปลายทางการประมวลผลภายนอกที่กำหนดค่าไว้ และไม่ได้แสดงว่าเป็นการประมวลผลภายในเครื่องเท่านั้น',
  },
  sv: {
    localLabel: 'Lokal bearbetning',
    localDetail: 'Indata bearbetas i webbläsaren när verktyget stöder det.',
    remoteLabel: 'Extern bearbetning',
    remoteDetail: 'Det här verktyget använder en konfigurerad extern bearbetningsendpoint och presenteras inte som enbart lokal bearbetning.',
  },
  ms: {
    localLabel: 'Pemprosesan setempat',
    localDetail: 'Input diproses dalam pelayar anda apabila alat menyokongnya.',
    remoteLabel: 'Pemprosesan luaran',
    remoteDetail: 'Alat ini menggunakan titik akhir pemprosesan luaran yang dikonfigurasikan dan tidak dipaparkan sebagai pemprosesan setempat sahaja.',
  },
  uk: {
    localLabel: 'Локальна обробка',
    localDetail: 'Вхідні дані обробляються у браузері, якщо інструмент це підтримує.',
    remoteLabel: 'Зовнішня обробка',
    remoteDetail: 'Цей інструмент використовує налаштовану зовнішню кінцеву точку обробки й не подається як суто локальний.',
  },
};

export function getToolProcessingMode(toolId: string): ProcessingMode {
  return REMOTE_TOOL_IDS.has(toolId) ? 'remote' : 'local';
}

export function getToolPrivacyCopy(toolId: string, locale: string): {
  label: string;
  detail: string;
  mode: ProcessingMode;
} {
  const mode = getToolProcessingMode(toolId);
  const localeKey = locale.split('-')[0] as Locale;
  const copy = PRIVACY_COPY[localeKey] ?? PRIVACY_COPY.en;

  return mode === 'local'
    ? { mode, label: copy.localLabel, detail: copy.localDetail }
    : { mode, label: copy.remoteLabel, detail: copy.remoteDetail };
}
