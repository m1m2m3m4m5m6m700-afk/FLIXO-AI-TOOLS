import { getToolConfig } from '../config/tools';

export type ProcessingMode = 'local' | 'remote';

type PrivacyLocaleCopy = Readonly<{
  local: string;
  remote: string;
  localDetail: (title: string) => string;
  remoteDetail: (title: string) => string;
}>;

const REMOTE_TOOL_IDS = new Set(['ai-image-generator']);

const PRIVACY_COPY: Record<string, PrivacyLocaleCopy> = {
  ar: {
    local: 'معالجة محلية',
    remote: 'معالجة خارجية',
    localDetail: (title) => `تتم معالجة الملفات والمدخلات لأداة ${title} داخل متصفحك عندما تسمح طبيعة الأداة بذلك.`,
    remoteDetail: (title) => `تستخدم أداة ${title} نقطة معالجة خارجية. لا تُعرض كأداة معالجة محلية.`,
  },
  en: {
    local: 'Local processing',
    remote: 'External processing',
    localDetail: (title) => `Inputs for ${title} are processed in your browser when supported by the tool.`,
    remoteDetail: (title) => `${title} uses a configured external processing endpoint and is not presented as local-only.`,
  },
  es: { local: 'Procesamiento local', remote: 'Procesamiento externo', localDetail: (title) => `Las entradas de ${title} se procesan en tu navegador cuando la herramienta lo admite.`, remoteDetail: (title) => `${title} utiliza un punto de procesamiento externo configurado y no se presenta como una herramienta exclusivamente local.` },
  fr: { local: 'Traitement local', remote: 'Traitement externe', localDetail: (title) => `Les entrées de ${title} sont traitées dans votre navigateur lorsque l’outil le permet.`, remoteDetail: (title) => `${title} utilise un point de traitement externe configuré et n’est pas présenté comme un outil uniquement local.` },
  de: { local: 'Lokale Verarbeitung', remote: 'Externe Verarbeitung', localDetail: (title) => `Eingaben für ${title} werden im Browser verarbeitet, sofern das Tool dies unterstützt.`, remoteDetail: (title) => `${title} verwendet einen konfigurierten externen Verarbeitungspunkt und wird nicht als rein lokales Tool dargestellt.` },
  hi: { local: 'स्थानीय प्रोसेसिंग', remote: 'बाहरी प्रोसेसिंग', localDetail: (title) => `${title} के इनपुट समर्थित होने पर आपके ब्राउज़र में प्रोसेस किए जाते हैं।`, remoteDetail: `${title} एक कॉन्फ़िगर किए गए बाहरी प्रोसेसिंग एंडपॉइंट का उपयोग करता है और इसे केवल स्थानीय टूल के रूप में प्रस्तुत नहीं किया जाता।` },
  id: { local: 'Pemrosesan lokal', remote: 'Pemrosesan eksternal', localDetail: (title) => `Input untuk ${title} diproses di browser Anda jika alat mendukungnya.`, remoteDetail: `${title} menggunakan titik pemrosesan eksternal yang dikonfigurasi dan tidak disajikan sebagai alat yang sepenuhnya lokal.` },
  it: { local: 'Elaborazione locale', remote: 'Elaborazione esterna', localDetail: (title) => `Gli input di ${title} vengono elaborati nel browser quando lo strumento lo supporta.`, remoteDetail: `${title} utilizza un endpoint di elaborazione esterno configurato e non viene presentato come uno strumento esclusivamente locale.` },
  ja: { local: 'ローカル処理', remote: '外部処理', localDetail: (title) => `${title} の入力は、ツールが対応している場合、ブラウザ内で処理されます。`, remoteDetail: `${title} は設定された外部処理エンドポイントを使用し、完全なローカル処理ツールとしては提供されません。` },
  ko: { local: '로컬 처리', remote: '외부 처리', localDetail: (title) => `${title}의 입력은 도구가 지원하는 경우 브라우저에서 처리됩니다.`, remoteDetail: `${title}은(는) 구성된 외부 처리 엔드포인트를 사용하며 로컬 전용 도구로 제공되지 않습니다.` },
  ms: { local: 'Pemprosesan tempatan', remote: 'Pemprosesan luaran', localDetail: (title) => `Input untuk ${title} diproses dalam pelayar anda apabila alat menyokongnya.`, remoteDetail: `${title} menggunakan titik pemprosesan luaran yang dikonfigurasikan dan bukan alat tempatan sepenuhnya.` },
  nl: { local: 'Lokale verwerking', remote: 'Externe verwerking', localDetail: (title) => `Invoer voor ${title} wordt in je browser verwerkt wanneer de tool dit ondersteunt.`, remoteDetail: `${title} gebruikt een geconfigureerd extern verwerkingspunt en wordt niet gepresenteerd als uitsluitend lokaal.` },
  pl: { local: 'Przetwarzanie lokalne', remote: 'Przetwarzanie zewnętrzne', localDetail: (title) => `Dane wejściowe dla ${title} są przetwarzane w przeglądarce, gdy narzędzie to obsługuje.`, remoteDetail: `${title} korzysta ze skonfigurowanego zewnętrznego punktu przetwarzania i nie jest przedstawiane jako narzędzie wyłącznie lokalne.` },
  pt: { local: 'Processamento local', remote: 'Processamento externo', localDetail: (title) => `As entradas de ${title} são processadas no seu navegador quando a ferramenta oferece suporte.`, remoteDetail: `${title} usa um endpoint externo de processamento configurado e não é apresentado como uma ferramenta apenas local.` },
  ru: { local: 'Локальная обработка', remote: 'Внешняя обработка', localDetail: (title) => `Входные данные ${title} обрабатываются в браузере, если инструмент это поддерживает.`, remoteDetail: `${title} использует настроенную внешнюю точку обработки и не позиционируется как полностью локальный инструмент.` },
  sv: { local: 'Lokal bearbetning', remote: 'Extern bearbetning', localDetail: (title) => `Indata för ${title} bearbetas i din webbläsare när verktyget stöder det.`, remoteDetail: `${title} använder en konfigurerad extern bearbetningspunkt och presenteras inte som enbart lokal.` },
  th: { local: 'ประมวลผลภายในเครื่อง', remote: 'ประมวลผลภายนอก', localDetail: (title) => `อินพุตสำหรับ ${title} จะถูกประมวลผลในเบราว์เซอร์ของคุณเมื่อเครื่องมือรองรับ`, remoteDetail: `${title} ใช้จุดประมวลผลภายนอกที่กำหนดค่าไว้ และไม่ได้แสดงเป็นเครื่องมือที่ประมวลผลภายในเครื่องเท่านั้น` },
  tr: { local: 'Yerel işleme', remote: 'Harici işleme', localDetail: (title) => `${title} için girdiler, araç desteklediğinde tarayıcınızda işlenir.`, remoteDetail: `${title}, yapılandırılmış bir harici işleme uç noktası kullanır ve yalnızca yerel bir araç olarak sunulmaz.` },
  uk: { local: 'Локальна обробка', remote: 'Зовнішня обробка', localDetail: (title) => `Вхідні дані ${title} обробляються у вашому браузері, якщо інструмент це підтримує.`, remoteDetail: `${title} використовує налаштовану зовнішню точку обробки та не подається як суто локальний інструмент.` },
  vi: { local: 'Xử lý cục bộ', remote: 'Xử lý bên ngoài', localDetail: (title) => `Dữ liệu đầu vào của ${title} được xử lý trong trình duyệt khi công cụ hỗ trợ.`, remoteDetail: `${title} sử dụng điểm xử lý bên ngoài đã cấu hình và không được cung cấp như một công cụ chỉ xử lý cục bộ.` },
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
  const tool = getToolConfig(toolId);
  const title = tool?.title ?? toolId;
  const copy = PRIVACY_COPY[locale] ?? PRIVACY_COPY.en;

  return mode === 'local'
    ? { mode, label: copy.local, detail: copy.localDetail(title) }
    : { mode, label: copy.remote, detail: copy.remoteDetail(title) };
}
