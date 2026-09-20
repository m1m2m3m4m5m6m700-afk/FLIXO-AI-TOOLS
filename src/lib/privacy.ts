import { getToolConfig } from '../config/tools';

export type ProcessingMode = 'local' | 'remote';

type PrivacyLocaleCopy = Readonly<{
  local: string;
  remote: string;
  localDetail: (title: string) => string;
  remoteDetail: (title: string) => string;
}>;

const REMOTE_TOOL_IDS = new Set(['ai-image-generator']);

const definePrivacyCopy = (
  local: string,
  remote: string,
  localDetail: (title: string) => string,
  remoteDetail: (title: string) => string,
): PrivacyLocaleCopy => ({ local, remote, localDetail, remoteDetail });

const PRIVACY_COPY: Record<string, PrivacyLocaleCopy> = {
  ar: definePrivacyCopy('معالجة محلية', 'معالجة خارجية', (title) => `تتم معالجة الملفات والمدخلات لأداة ${title} داخل متصفحك عندما تسمح طبيعة الأداة بذلك.`, (title) => `تستخدم أداة ${title} نقطة معالجة خارجية. لا تُعرض كأداة معالجة محلية.`),
  en: definePrivacyCopy('Local processing', 'External processing', (title) => `Inputs for ${title} are processed in your browser when supported by the tool.`, (title) => `${title} uses a configured external processing endpoint and is not presented as local-only.`),
  es: definePrivacyCopy('Procesamiento local', 'Procesamiento externo', (title) => `Las entradas de ${title} se procesan en tu navegador cuando la herramienta lo admite.`, (title) => `${title} utiliza un punto de procesamiento externo configurado y no se presenta como una herramienta exclusivamente local.`),
  fr: definePrivacyCopy('Traitement local', 'Traitement externe', (title) => `Les entrées de ${title} sont traitées dans votre navigateur lorsque l’outil le permet.`, (title) => `${title} utilise un point de traitement externe configuré et n’est pas présenté comme un outil uniquement local.`),
  de: definePrivacyCopy('Lokale Verarbeitung', 'Externe Verarbeitung', (title) => `Eingaben für ${title} werden im Browser verarbeitet, sofern das Tool dies unterstützt.`, (title) => `${title} verwendet einen konfigurierten externen Verarbeitungspunkt und wird nicht als rein lokales Tool dargestellt.`),
  hi: definePrivacyCopy('स्थानीय प्रोसेसिंग', 'बाहरी प्रोसेसिंग', (title) => `${title} के इनपुट समर्थित होने पर आपके ब्राउज़र में प्रोसेस किए जाते हैं।`, (title) => `${title} एक कॉन्फ़िगर किए गए बाहरी प्रोसेसिंग एंडपॉइंट का उपयोग करता है और इसे केवल स्थानीय टूल के रूप में प्रस्तुत नहीं किया जाता।`),
  id: definePrivacyCopy('Pemrosesan lokal', 'Pemrosesan eksternal', (title) => `Input untuk ${title} diproses di browser Anda jika alat mendukungnya.`, (title) => `${title} menggunakan titik pemrosesan eksternal yang dikonfigurasi dan tidak disajikan sebagai alat yang sepenuhnya lokal.`),
  it: definePrivacyCopy('Elaborazione locale', 'Elaborazione esterna', (title) => `Gli input di ${title} vengono elaborati nel browser quando lo strumento lo supporta.`, (title) => `${title} utilizza un endpoint di elaborazione esterno configurato e non viene presentato come uno strumento esclusivamente locale.`),
  ja: definePrivacyCopy('ローカル処理', '外部処理', (title) => `${title} の入力は、ツールが対応している場合、ブラウザ内で処理されます。`, (title) => `${title} は設定された外部処理エンドポイントを使用し、完全なローカル処理ツールとしては提供されません。`),
  ko: definePrivacyCopy('로컬 처리', '외부 처리', (title) => `${title}의 입력은 도구가 지원하는 경우 브라우저에서 처리됩니다.`, (title) => `${title}은(는) 구성된 외부 처리 엔드포인트를 사용하며 로컬 전용 도구로 제공되지 않습니다.`),
  ms: definePrivacyCopy('Pemprosesan tempatan', 'Pemprosesan luaran', (title) => `Input untuk ${title} diproses dalam pelayar anda apabila alat menyokongnya.`, (title) => `${title} menggunakan titik pemprosesan luaran yang dikonfigurasikan dan bukan alat tempatan sepenuhnya.`),
  nl: definePrivacyCopy('Lokale verwerking', 'Externe verwerking', (title) => `Invoer voor ${title} wordt in je browser verwerkt wanneer de tool dit ondersteunt.`, (title) => `${title} gebruikt een geconfigureerd extern verwerkingspunt en wordt niet gepresenteerd als uitsluitend lokaal.`),
  pl: definePrivacyCopy('Przetwarzanie lokalne', 'Przetwarzanie zewnętrzne', (title) => `Dane wejściowe dla ${title} są przetwarzane w przeglądarce, gdy narzędzie to obsługuje.`, (title) => `${title} korzysta ze skonfigurowanego zewnętrznego punktu przetwarzania i nie jest przedstawiane jako narzędzie wyłącznie lokalne.`),
  pt: definePrivacyCopy('Processamento local', 'Processamento externo', (title) => `As entradas de ${title} são processadas no seu navegador quando a ferramenta oferece suporte.`, (title) => `${title} usa um endpoint externo de processamento configurado e não é apresentado como uma ferramenta apenas local.`),
  ru: definePrivacyCopy('Локальная обработка', 'Внешняя обработка', (title) => `Входные данные ${title} обрабатываются в браузере, если инструмент это поддерживает.`, (title) => `${title} использует настроенную внешнюю точку обработки и не позиционируется как полностью локальный инструмент.`),
  sv: definePrivacyCopy('Lokal bearbetning', 'Extern bearbetning', (title) => `Indata för ${title} bearbetas i din webbläsare när verktyget stöder det.`, (title) => `${title} använder en konfigurerad extern bearbetningspunkt och presenteras inte som enbart lokal.`),
  th: definePrivacyCopy('ประมวลผลภายในเครื่อง', 'ประมวลผลภายนอก', (title) => `อินพุตสำหรับ ${title} จะถูกประมวลผลในเบราว์เซอร์ของคุณเมื่อเครื่องมือรองรับ`, (title) => `${title} ใช้จุดประมวลผลภายนอกที่กำหนดค่าไว้ และไม่ได้แสดงเป็นเครื่องมือที่ประมวลผลภายในเครื่องเท่านั้น`),
  tr: definePrivacyCopy('Yerel işleme', 'Harici işleme', (title) => `${title} için girdiler, araç desteklediğinde tarayıcınızda işlenir.`, (title) => `${title}, yapılandırılmış bir harici işleme uç noktası kullanır ve yalnızca yerel bir araç olarak sunulmaz.`),
  uk: definePrivacyCopy('Локальна обробка', 'Зовнішня обробка', (title) => `Вхідні дані ${title} обробляються у вашому браузері, якщо інструмент це підтримує.`, (title) => `${title} використовує налаштовану зовнішню точку обробки та не подається як суто локальний інструмент.`),
  vi: definePrivacyCopy('Xử lý cục bộ', 'Xử lý bên ngoài', (title) => `Dữ liệu đầu vào của ${title} được xử lý trong trình duyệt khi công cụ hỗ trợ.`, (title) => `${title} sử dụng điểm xử lý bên ngoài đã cấu hình và không được cung cấp như một công cụ chỉ xử lý cục bộ.`),
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
