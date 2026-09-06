import { getToolConfig } from '../config/tools';
import { getLocalizedToolTitle } from './seo/tool-seo';

export type ProcessingMode = 'local' | 'remote';

const REMOTE_TOOL_IDS = new Set(['ai-image-generator']);

type LocalizedRemoteCopy = Readonly<{ label: string; detail: (title: string) => string }>;

const REMOTE_COPY: Readonly<Record<string, LocalizedRemoteCopy>> = {
  ar: { label: 'معالجة خارجية', detail: (title) => `تستخدم أداة ${title} نقطة معالجة خارجية. لا تُعرض كأداة معالجة محلية.` },
  en: { label: 'External processing', detail: (title) => `${title} uses a configured external processing endpoint and is not presented as local-only.` },
  es: { label: 'Procesamiento externo', detail: (title) => `${title} utiliza un punto de procesamiento externo configurado y no se presenta como una herramienta de procesamiento local.` },
  fr: { label: 'Traitement externe', detail: (title) => `${title} utilise un point de traitement externe configuré et n’est pas présenté comme un outil de traitement local.` },
  de: { label: 'Externe Verarbeitung', detail: (title) => `${title} verwendet einen konfigurierten externen Verarbeitungsendpunkt und wird nicht als lokal arbeitendes Tool dargestellt.` },
  hi: { label: 'बाहरी प्रोसेसिंग', detail: (title) => `${title} एक कॉन्फ़िगर किए गए बाहरी प्रोसेसिंग एंडपॉइंट का उपयोग करता है और इसे केवल स्थानीय प्रोसेसिंग टूल के रूप में प्रस्तुत नहीं किया जाता।` },
  id: { label: 'Pemrosesan eksternal', detail: (title) => `${title} menggunakan titik akhir pemrosesan eksternal yang dikonfigurasi dan tidak disajikan sebagai alat pemrosesan lokal.` },
  it: { label: 'Elaborazione esterna', detail: (title) => `${title} utilizza un endpoint di elaborazione esterno configurato e non viene presentato come strumento di elaborazione locale.` },
  ja: { label: '外部処理', detail: (title) => `${title} は設定された外部処理エンドポイントを使用し、ローカル処理専用のツールとしては表示されません。` },
  ko: { label: '외부 처리', detail: (title) => `${title}은(는) 구성된 외부 처리 엔드포인트를 사용하며 로컬 전용 처리 도구로 표시되지 않습니다.` },
  ms: { label: 'Pemprosesan luaran', detail: (title) => `${title} menggunakan titik akhir pemprosesan luaran yang dikonfigurasikan dan tidak dipaparkan sebagai alat pemprosesan setempat.` },
  nl: { label: 'Externe verwerking', detail: (title) => `${title} gebruikt een geconfigureerd extern verwerkingseindpunt en wordt niet gepresenteerd als een tool die uitsluitend lokaal verwerkt.` },
  pl: { label: 'Przetwarzanie zewnętrzne', detail: (title) => `${title} korzysta ze skonfigurowanego zewnętrznego punktu przetwarzania i nie jest przedstawiane jako narzędzie wyłącznie lokalne.` },
  pt: { label: 'Processamento externo', detail: (title) => `${title} usa um ponto de processamento externo configurado e não é apresentado como uma ferramenta de processamento apenas local.` },
  ru: { label: 'Внешняя обработка', detail: (title) => `${title} использует настроенную внешнюю точку обработки и не представляется как инструмент только для локальной обработки.` },
  sv: { label: 'Extern bearbetning', detail: (title) => `${title} använder en konfigurerad extern bearbetningsendpoint och presenteras inte som ett verktyg för enbart lokal bearbetning.` },
  th: { label: 'การประมวลผลภายนอก', detail: (title) => `${title} ใช้ปลายทางการประมวลผลภายนอกที่กำหนดค่าไว้ และไม่ได้แสดงเป็นเครื่องมือที่ประมวลผลภายในเครื่องเท่านั้น` },
  tr: { label: 'Harici işleme', detail: (title) => `${title}, yapılandırılmış bir harici işleme uç noktası kullanır ve yalnızca yerel işleme yapan bir araç olarak sunulmaz.` },
  uk: { label: 'Зовнішня обробка', detail: (title) => `${title} використовує налаштовану зовнішню точку обробки і не подається як інструмент лише для локальної обробки.` },
  vi: { label: 'Xử lý bên ngoài', detail: (title) => `${title} sử dụng điểm cuối xử lý bên ngoài được cấu hình và không được trình bày như một công cụ chỉ xử lý cục bộ.` },
};

const LOCAL_COPY: Readonly<Record<string, LocalizedRemoteCopy>> = {
  ar: { label: 'معالجة محلية', detail: (title) => `تتم معالجة الملفات والمدخلات لأداة ${title} داخل متصفحك عندما تسمح طبيعة الأداة بذلك.` },
  en: { label: 'Local processing', detail: (title) => `Inputs for ${title} are processed in your browser when supported by the tool.` },
  es: { label: 'Procesamiento local', detail: (title) => `Las entradas de ${title} se procesan en tu navegador cuando la herramienta lo permite.` },
  fr: { label: 'Traitement local', detail: (title) => `Les entrées de ${title} sont traitées dans votre navigateur lorsque l’outil le permet.` },
  de: { label: 'Lokale Verarbeitung', detail: (title) => `Eingaben für ${title} werden in Ihrem Browser verarbeitet, sofern dies vom Tool unterstützt wird.` },
  hi: { label: 'स्थानीय प्रोसेसिंग', detail: (title) => `${title} के इनपुट टूल द्वारा समर्थित होने पर आपके ब्राउज़र में प्रोसेस किए जाते हैं।` },
  id: { label: 'Pemrosesan lokal', detail: (title) => `Input untuk ${title} diproses di browser Anda jika didukung oleh alat tersebut.` },
  it: { label: 'Elaborazione locale', detail: (title) => `Gli input per ${title} vengono elaborati nel browser quando lo strumento lo supporta.` },
  ja: { label: 'ローカル処理', detail: (title) => `${title} の入力は、ツールが対応している場合、ブラウザ内で処理されます。` },
  ko: { label: '로컬 처리', detail: (title) => `${title}의 입력은 도구가 지원하는 경우 브라우저에서 처리됩니다.` },
  ms: { label: 'Pemprosesan setempat', detail: (title) => `Input untuk ${title} diproses dalam pelayar anda apabila disokong oleh alat tersebut.` },
  nl: { label: 'Lokale verwerking', detail: (title) => `Invoer voor ${title} wordt in uw browser verwerkt wanneer de tool dit ondersteunt.` },
  pl: { label: 'Przetwarzanie lokalne', detail: (title) => `Dane wejściowe dla ${title} są przetwarzane w przeglądarce, gdy narzędzie to obsługuje.` },
  pt: { label: 'Processamento local', detail: (title) => `Os dados de entrada de ${title} são processados no navegador quando suportado pela ferramenta.` },
  ru: { label: 'Локальная обработка', detail: (title) => `Входные данные для ${title} обрабатываются в браузере, если инструмент это поддерживает.` },
  sv: { label: 'Lokal bearbetning', detail: (title) => `Indata för ${title} bearbetas i webbläsaren när verktyget stöder det.` },
  th: { label: 'การประมวลผลในเครื่อง', detail: (title) => `อินพุตสำหรับ ${title} จะถูกประมวลผลในเบราว์เซอร์เมื่อเครื่องมือรองรับ` },
  tr: { label: 'Yerel işleme', detail: (title) => `${title} için girdiler, araç destekliyorsa tarayıcınızda işlenir.` },
  uk: { label: 'Локальна обробка', detail: (title) => `Вхідні дані для ${title} обробляються у браузері, якщо інструмент це підтримує.` },
  vi: { label: 'Xử lý cục bộ', detail: (title) => `Dữ liệu đầu vào cho ${title} được xử lý trong trình duyệt khi công cụ hỗ trợ.` },
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
  const fallbackTitle = tool?.title ?? toolId;
  const normalizedLocale = locale.toLowerCase();
  const title = getLocalizedToolTitle(normalizedLocale, toolId, fallbackTitle);
  const copy = (mode === 'remote' ? REMOTE_COPY : LOCAL_COPY)[normalizedLocale] ?? (mode === 'remote' ? REMOTE_COPY.en : LOCAL_COPY.en);

  return {
    mode,
    label: copy.label,
    detail: copy.detail(title),
  };
}
