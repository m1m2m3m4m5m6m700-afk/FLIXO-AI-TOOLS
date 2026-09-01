import { getToolConfig } from '../config/tools';

export type ProcessingMode = 'local' | 'remote';

type PrivacyCopy = Readonly<{ label: string; localDetail: string; remoteDetail: string }>;

const REMOTE_TOOL_IDS = new Set(['ai-image-generator']);

const PRIVACY_COPY: Record<string, PrivacyCopy> = {
  ar: { label: 'معالجة محلية', localDetail: 'تتم معالجة المدخلات داخل متصفحك عندما تسمح طبيعة الأداة بذلك.', remoteDetail: 'تستخدم الأداة نقطة معالجة خارجية مهيأة ولا تُعرض كأداة معالجة محلية فقط.' },
  en: { label: 'Local processing', localDetail: 'Inputs are processed in your browser when supported by the tool.', remoteDetail: 'The tool uses a configured external processing endpoint and is not presented as local-only.' },
  es: { label: 'Procesamiento local', localDetail: 'Las entradas se procesan en tu navegador cuando la herramienta lo admite.', remoteDetail: 'La herramienta usa un punto de procesamiento externo configurado y no se presenta como exclusiva de procesamiento local.' },
  fr: { label: 'Traitement local', localDetail: 'Les données sont traitées dans votre navigateur lorsque l’outil le permet.', remoteDetail: 'L’outil utilise un point de traitement externe configuré et n’est pas présenté comme exclusivement local.' },
  de: { label: 'Lokale Verarbeitung', localDetail: 'Eingaben werden im Browser verarbeitet, sofern das Tool dies unterstützt.', remoteDetail: 'Das Tool verwendet einen konfigurierten externen Verarbeitungspunkt und wird nicht als ausschließlich lokal dargestellt.' },
  hi: { label: 'स्थानीय प्रोसेसिंग', localDetail: 'जहाँ टूल समर्थित हो, इनपुट आपके ब्राउज़र में प्रोसेस होते हैं।', remoteDetail: 'यह टूल एक कॉन्फ़िगर किया गया बाहरी प्रोसेसिंग एंडपॉइंट उपयोग करता है और इसे केवल स्थानीय प्रोसेसिंग के रूप में प्रस्तुत नहीं किया जाता।' },
  id: { label: 'Pemrosesan lokal', localDetail: 'Input diproses di browser Anda jika alat mendukungnya.', remoteDetail: 'Alat ini menggunakan endpoint pemrosesan eksternal yang dikonfigurasi dan tidak disajikan sebagai pemrosesan lokal saja.' },
  it: { label: 'Elaborazione locale', localDetail: 'Gli input vengono elaborati nel browser quando lo strumento lo supporta.', remoteDetail: 'Lo strumento usa un endpoint di elaborazione esterno configurato e non viene presentato come esclusivamente locale.' },
  ja: { label: 'ローカル処理', localDetail: 'ツールが対応している場合、入力はブラウザ内で処理されます。', remoteDetail: 'このツールは設定済みの外部処理エンドポイントを使用し、ローカル処理専用としては表示されません。' },
  ko: { label: '로컬 처리', localDetail: '도구가 지원하는 경우 입력은 브라우저에서 처리됩니다.', remoteDetail: '이 도구는 구성된 외부 처리 엔드포인트를 사용하며 로컬 전용 처리로 표시되지 않습니다.' },
  ms: { label: 'Pemprosesan tempatan', localDetail: 'Input diproses dalam pelayar anda apabila alat menyokongnya.', remoteDetail: 'Alat ini menggunakan titik akhir pemprosesan luaran yang dikonfigurasikan dan tidak dipaparkan sebagai pemprosesan tempatan sahaja.' },
  nl: { label: 'Lokale verwerking', localDetail: 'Invoer wordt in je browser verwerkt wanneer de tool dit ondersteunt.', remoteDetail: 'De tool gebruikt een geconfigureerd extern verwerkingseindpunt en wordt niet als uitsluitend lokaal gepresenteerd.' },
  pl: { label: 'Przetwarzanie lokalne', localDetail: 'Dane wejściowe są przetwarzane w przeglądarce, gdy narzędzie to obsługuje.', remoteDetail: 'Narzędzie korzysta ze skonfigurowanego zewnętrznego punktu przetwarzania i nie jest przedstawiane jako wyłącznie lokalne.' },
  pt: { label: 'Processamento local', localDetail: 'As entradas são processadas no navegador quando a ferramenta oferece suporte.', remoteDetail: 'A ferramenta usa um endpoint externo de processamento configurado e não é apresentada como exclusivamente local.' },
  ru: { label: 'Локальная обработка', localDetail: 'Входные данные обрабатываются в браузере, если инструмент это поддерживает.', remoteDetail: 'Инструмент использует настроенную внешнюю точку обработки и не представлен как исключительно локальный.' },
  sv: { label: 'Lokal bearbetning', localDetail: 'Indata bearbetas i din webbläsare när verktyget stöder det.', remoteDetail: 'Verktyget använder en konfigurerad extern behandlingspunkt och presenteras inte som enbart lokal bearbetning.' },
  th: { label: 'ประมวลผลในเครื่อง', localDetail: 'อินพุตจะประมวลผลในเบราว์เซอร์ของคุณเมื่อเครื่องมือรองรับ', remoteDetail: 'เครื่องมือนี้ใช้ปลายทางประมวลผลภายนอกที่กำหนดค่าไว้ และไม่ได้แสดงว่าเป็นการประมวลผลในเครื่องเท่านั้น' },
  tr: { label: 'Yerel işleme', localDetail: 'Araç destekliyorsa girdiler tarayıcınızda işlenir.', remoteDetail: 'Araç, yapılandırılmış bir harici işleme uç noktası kullanır ve yalnızca yerel işleme olarak sunulmaz.' },
  uk: { label: 'Локальна обробка', localDetail: 'Вхідні дані обробляються у браузері, якщо інструмент це підтримує.', remoteDetail: 'Інструмент використовує налаштовану зовнішню точку обробки і не подається як суто локальний.' },
  vi: { label: 'Xử lý cục bộ', localDetail: 'Dữ liệu đầu vào được xử lý trong trình duyệt khi công cụ hỗ trợ.', remoteDetail: 'Công cụ sử dụng một điểm cuối xử lý bên ngoài đã cấu hình và không được trình bày là chỉ xử lý cục bộ.' },
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

  return {
    mode,
    label: mode === 'local' ? copy.label : locale === 'en' ? 'External processing' : `${copy.label} · ${locale}`,
    detail: mode === 'local' ? copy.localDetail.replace('the tool', title).replace('la herramienta', title).replace('l’outil', title).replace('das Tool', title) : copy.remoteDetail,
  };
}
