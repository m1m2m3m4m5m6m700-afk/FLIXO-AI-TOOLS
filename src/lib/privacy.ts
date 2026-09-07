import type { Locale } from './i18n/config';
import { getToolConfig } from '../config/tools';

export type ProcessingMode = 'local' | 'remote';

type PrivacyCopy = Readonly<{
  localLabel: string;
  localDetail: (title: string) => string;
  remoteLabel: string;
  remoteDetail: (title: string) => string;
}>;

const REMOTE_TOOL_IDS = new Set(['ai-image-generator']);

const PRIVACY_COPY: Readonly<Record<Locale, PrivacyCopy>> = {
  ar: {
    localLabel: 'معالجة محلية',
    localDetail: (title) => `تتم معالجة الملفات والمدخلات لأداة ${title} داخل متصفحك عندما تسمح طبيعة الأداة بذلك.`,
    remoteLabel: 'معالجة خارجية',
    remoteDetail: (title) => `تستخدم أداة ${title} نقطة معالجة خارجية. لا تُعرض كأداة معالجة محلية.`,
  },
  en: {
    localLabel: 'Local processing',
    localDetail: (title) => `Inputs for ${title} are processed in your browser when supported by the tool.`,
    remoteLabel: 'External processing',
    remoteDetail: (title) => `${title} uses a configured external processing endpoint and is not presented as local-only.`,
  },
  es: {
    localLabel: 'Procesamiento local',
    localDetail: (title) => `Las entradas de ${title} se procesan en tu navegador cuando la herramienta lo admite.`,
    remoteLabel: 'Procesamiento externo',
    remoteDetail: (title) => `${title} utiliza un punto de procesamiento externo configurado y no se presenta como una herramienta solo local.`,
  },
  fr: {
    localLabel: 'Traitement local',
    localDetail: (title) => `Les entrées de ${title} sont traitées dans votre navigateur lorsque l’outil le permet.`,
    remoteLabel: 'Traitement externe',
    remoteDetail: (title) => `${title} utilise un point de traitement externe configuré et n’est pas présenté comme un outil exclusivement local.`,
  },
  de: {
    localLabel: 'Lokale Verarbeitung',
    localDetail: (title) => `Eingaben für ${title} werden in deinem Browser verarbeitet, wenn das Tool dies unterstützt.`,
    remoteLabel: 'Externe Verarbeitung',
    remoteDetail: (title) => `${title} verwendet einen konfigurierten externen Verarbeitungsendpunkt und wird nicht als rein lokale Verarbeitung dargestellt.`,
  },
  hi: {
    localLabel: 'स्थानीय प्रोसेसिंग',
    localDetail: (title) => `जहाँ टूल इसका समर्थन करता है, ${title} के इनपुट आपके ब्राउज़र में संसाधित होते हैं।`,
    remoteLabel: 'बाहरी प्रोसेसिंग',
    remoteDetail: (title) => `${title} एक कॉन्फ़िगर किए गए बाहरी प्रोसेसिंग एंडपॉइंट का उपयोग करता है और इसे केवल स्थानीय के रूप में प्रस्तुत नहीं किया जाता।`,
  },
  id: {
    localLabel: 'Pemrosesan lokal',
    localDetail: (title) => `Input untuk ${title} diproses di browser Anda jika alat ini mendukungnya.`,
    remoteLabel: 'Pemrosesan eksternal',
    remoteDetail: (title) => `${title} menggunakan endpoint pemrosesan eksternal yang dikonfigurasi dan tidak disajikan sebagai pemrosesan lokal saja.`,
  },
  it: {
    localLabel: 'Elaborazione locale',
    localDetail: (title) => `Gli input per ${title} vengono elaborati nel browser quando lo strumento lo supporta.`,
    remoteLabel: 'Elaborazione esterna',
    remoteDetail: (title) => `${title} usa un endpoint di elaborazione esterno configurato e non viene presentato come elaborazione esclusivamente locale.`,
  },
  ja: {
    localLabel: 'ローカル処理',
    localDetail: (title) => `${title} の入力は、ツールが対応している場合、ブラウザ内で処理されます。`,
    remoteLabel: '外部処理',
    remoteDetail: (title) => `${title} は設定済みの外部処理エンドポイントを使用し、完全なローカル処理としては表示されません。`,
  },
  ko: {
    localLabel: '로컬 처리',
    localDetail: (title) => `${title}의 입력은 도구가 지원하는 경우 브라우저에서 처리됩니다.`,
    remoteLabel: '외부 처리',
    remoteDetail: (title) => `${title}은(는) 구성된 외부 처리 엔드포인트를 사용하며 완전한 로컬 처리로 표시되지 않습니다.`,
  },
  ms: {
    localLabel: 'Pemprosesan tempatan',
    localDetail: (title) => `Input untuk ${title} diproses dalam pelayar anda apabila alat ini menyokongnya.`,
    remoteLabel: 'Pemprosesan luaran',
    remoteDetail: (title) => `${title} menggunakan titik akhir pemprosesan luaran yang dikonfigurasikan dan tidak dipaparkan sebagai pemprosesan tempatan sahaja.`,
  },
  nl: {
    localLabel: 'Lokale verwerking',
    localDetail: (title) => `Invoer voor ${title} wordt in je browser verwerkt wanneer de tool dit ondersteunt.`,
    remoteLabel: 'Externe verwerking',
    remoteDetail: (title) => `${title} gebruikt een geconfigureerd extern verwerkingseindpunt en wordt niet als uitsluitend lokaal gepresenteerd.`,
  },
  pl: {
    localLabel: 'Przetwarzanie lokalne',
    localDetail: (title) => `Dane wejściowe dla ${title} są przetwarzane w przeglądarce, gdy narzędzie to obsługuje.`,
    remoteLabel: 'Przetwarzanie zewnętrzne',
    remoteDetail: (title) => `${title} korzysta ze skonfigurowanego zewnętrznego punktu przetwarzania i nie jest przedstawiane jako narzędzie wyłącznie lokalne.`,
  },
  pt: {
    localLabel: 'Processamento local',
    localDetail: (title) => `As entradas de ${title} são processadas no seu navegador quando a ferramenta oferece suporte.`,
    remoteLabel: 'Processamento externo',
    remoteDetail: (title) => `${title} usa um endpoint externo de processamento configurado e não é apresentado como uma ferramenta exclusivamente local.`,
  },
  ru: {
    localLabel: 'Локальная обработка',
    localDetail: (title) => `Входные данные для ${title} обрабатываются в вашем браузере, если инструмент это поддерживает.`,
    remoteLabel: 'Внешняя обработка',
    remoteDetail: (title) => `${title} использует настроенную внешнюю точку обработки и не представляется как инструмент только с локальной обработкой.`,
  },
  sv: {
    localLabel: 'Lokal bearbetning',
    localDetail: (title) => `Indata för ${title} bearbetas i din webbläsare när verktyget stöder det.`,
    remoteLabel: 'Extern bearbetning',
    remoteDetail: (title) => `${title} använder en konfigurerad extern bearbetningspunkt och presenteras inte som enbart lokal.`,
  },
  th: {
    localLabel: 'การประมวลผลภายในเครื่อง',
    localDetail: (title) => `อินพุตสำหรับ ${title} จะประมวลผลในเบราว์เซอร์ของคุณเมื่อเครื่องมือรองรับ`,
    remoteLabel: 'การประมวลผลภายนอก',
    remoteDetail: (title) => `${title} ใช้จุดประมวลผลภายนอกที่กำหนดค่าไว้และไม่ได้แสดงว่าเป็นการประมวลผลภายในเครื่องเท่านั้น`,
  },
  tr: {
    localLabel: 'Yerel işleme',
    localDetail: (title) => `${title} için girdiler, araç desteklediğinde tarayıcınızda işlenir.`,
    remoteLabel: 'Harici işleme',
    remoteDetail: (title) => `${title}, yapılandırılmış bir harici işleme uç noktası kullanır ve yalnızca yerel işleme olarak sunulmaz.`,
  },
  uk: {
    localLabel: 'Локальна обробка',
    localDetail: (title) => `Вхідні дані для ${title} обробляються у вашому браузері, якщо інструмент це підтримує.`,
    remoteLabel: 'Зовнішня обробка',
    remoteDetail: (title) => `${title} використовує налаштовану зовнішню точку обробки й не подається як інструмент лише з локальною обробкою.`,
  },
  vi: {
    localLabel: 'Xử lý cục bộ',
    localDetail: (title) => `Dữ liệu đầu vào cho ${title} được xử lý trong trình duyệt của bạn khi công cụ hỗ trợ.`,
    remoteLabel: 'Xử lý bên ngoài',
    remoteDetail: (title) => `${title} sử dụng một điểm cuối xử lý bên ngoài đã cấu hình và không được trình bày là chỉ xử lý cục bộ.`,
  },
};

export function getToolProcessingMode(toolId: string): ProcessingMode {
  return REMOTE_TOOL_IDS.has(toolId) ? 'remote' : 'local';
}

export function getToolPrivacyCopy(toolId: string, locale: Locale): {
  label: string;
  detail: string;
  mode: ProcessingMode;
} {
  const mode = getToolProcessingMode(toolId);
  const tool = getToolConfig(toolId);
  const title = tool?.title ?? toolId;
  const copy = PRIVACY_COPY[locale];

  return mode === 'local'
    ? { mode, label: copy.localLabel, detail: copy.localDetail(title) }
    : { mode, label: copy.remoteLabel, detail: copy.remoteDetail(title) };
}
