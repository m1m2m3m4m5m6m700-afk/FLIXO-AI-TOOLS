import { getToolConfig } from '../config/tools';

export type ProcessingMode = 'local' | 'remote';

type PrivacyCopy = Readonly<{
  localLabel: string;
  remoteLabel: string;
  localDetail: string;
  remoteDetail: string;
}>;

const REMOTE_TOOL_IDS = new Set(['ai-image-generator']);

const PRIVACY_COPY: Record<string, PrivacyCopy> = {
  ar: { localLabel: 'معالجة محلية', remoteLabel: 'معالجة خارجية', localDetail: 'تتم معالجة مدخلات {title} داخل متصفحك عندما تسمح طبيعة الأداة بذلك.', remoteDetail: 'تستخدم أداة {title} نقطة معالجة خارجية مهيأة ولا تُعرض كأداة معالجة محلية فقط.' },
  en: { localLabel: 'Local processing', remoteLabel: 'External processing', localDetail: 'Inputs for {title} are processed in your browser when supported by the tool.', remoteDetail: '{title} uses a configured external processing endpoint and is not presented as local-only.' },
  es: { localLabel: 'Procesamiento local', remoteLabel: 'Procesamiento externo', localDetail: 'Las entradas de {title} se procesan en tu navegador cuando la herramienta lo admite.', remoteDetail: '{title} usa un punto de procesamiento externo configurado y no se presenta como exclusiva de procesamiento local.' },
  fr: { localLabel: 'Traitement local', remoteLabel: 'Traitement externe', localDetail: 'Les données de {title} sont traitées dans votre navigateur lorsque l’outil le permet.', remoteDetail: '{title} utilise un point de traitement externe configuré et n’est pas présenté comme exclusivement local.' },
  de: { localLabel: 'Lokale Verarbeitung', remoteLabel: 'Externe Verarbeitung', localDetail: 'Eingaben für {title} werden im Browser verarbeitet, sofern das Tool dies unterstützt.', remoteDetail: '{title} verwendet einen konfigurierten externen Verarbeitungspunkt und wird nicht als ausschließlich lokal dargestellt.' },
  hi: { localLabel: 'स्थानीय प्रोसेसिंग', remoteLabel: 'बाहरी प्रोसेसिंग', localDetail: '{title} के इनपुट, जहाँ समर्थित हों, आपके ब्राउज़र में प्रोसेस होते हैं।', remoteDetail: '{title} एक कॉन्फ़िगर किए गए बाहरी प्रोसेसिंग एंडपॉइंट का उपयोग करता है और इसे केवल स्थानीय प्रोसेसिंग के रूप में प्रस्तुत नहीं किया जाता।' },
  id: { localLabel: 'Pemrosesan lokal', remoteLabel: 'Pemrosesan eksternal', localDetail: 'Input untuk {title} diproses di browser Anda jika alat mendukungnya.', remoteDetail: '{title} menggunakan endpoint pemrosesan eksternal yang dikonfigurasi dan tidak disajikan sebagai pemrosesan lokal saja.' },
  it: { localLabel: 'Elaborazione locale', remoteLabel: 'Elaborazione esterna', localDetail: 'Gli input di {title} vengono elaborati nel browser quando lo strumento lo supporta.', remoteDetail: '{title} usa un endpoint di elaborazione esterno configurato e non viene presentato come esclusivamente locale.' },
  ja: { localLabel: 'ローカル処理', remoteLabel: '外部処理', localDetail: '{title} の入力は、ツールが対応している場合、ブラウザ内で処理されます。', remoteDetail: '{title} は設定済みの外部処理エンドポイントを使用し、ローカル処理専用としては表示されません。' },
  ko: { localLabel: '로컬 처리', remoteLabel: '외부 처리', localDetail: '{title}의 입력은 도구가 지원하는 경우 브라우저에서 처리됩니다.', remoteDetail: '{title}는 구성된 외부 처리 엔드포인트를 사용하며 로컬 전용 처리로 표시되지 않습니다.' },
  ms: { localLabel: 'Pemprosesan tempatan', remoteLabel: 'Pemprosesan luaran', localDetail: 'Input untuk {title} diproses dalam pelayar anda apabila alat menyokongnya.', remoteDetail: '{title} menggunakan titik akhir pemprosesan luaran yang dikonfigurasikan dan tidak dipaparkan sebagai pemprosesan tempatan sahaja.' },
  nl: { localLabel: 'Lokale verwerking', remoteLabel: 'Externe verwerking', localDetail: 'Invoer voor {title} wordt in je browser verwerkt wanneer de tool dit ondersteunt.', remoteDetail: '{title} gebruikt een geconfigureerd extern verwerkingseindpunt en wordt niet als uitsluitend lokaal gepresenteerd.' },
  pl: { localLabel: 'Przetwarzanie lokalne', remoteLabel: 'Przetwarzanie zewnętrzne', localDetail: 'Dane wejściowe dla {title} są przetwarzane w przeglądarce, gdy narzędzie to obsługuje.', remoteDetail: '{title} korzysta ze skonfigurowanego zewnętrznego punktu przetwarzania i nie jest przedstawiane jako wyłącznie lokalne.' },
  pt: { localLabel: 'Processamento local', remoteLabel: 'Processamento externo', localDetail: 'As entradas de {title} são processadas no navegador quando a ferramenta oferece suporte.', remoteDetail: '{title} usa um endpoint externo de processamento configurado e não é apresentada como exclusivamente local.' },
  ru: { localLabel: 'Локальная обработка', remoteLabel: 'Внешняя обработка', localDetail: 'Входные данные {title} обрабатываются в браузере, если инструмент это поддерживает.', remoteDetail: '{title} использует настроенную внешнюю точку обработки и не представлен как исключительно локальный.' },
  sv: { localLabel: 'Lokal bearbetning', remoteLabel: 'Extern bearbetning', localDetail: 'Indata för {title} bearbetas i din webbläsare när verktyget stöder det.', remoteDetail: '{title} använder en konfigurerad extern behandlingspunkt och presenteras inte som enbart lokal bearbetning.' },
  th: { localLabel: 'ประมวลผลในเครื่อง', remoteLabel: 'ประมวลผลภายนอก', localDetail: 'อินพุตของ {title} จะประมวลผลในเบราว์เซอร์ของคุณเมื่อเครื่องมือรองรับ', remoteDetail: '{title} ใช้ปลายทางประมวลผลภายนอกที่กำหนดค่าไว้ และไม่ได้แสดงว่าเป็นการประมวลผลในเครื่องเท่านั้น' },
  tr: { localLabel: 'Yerel işleme', remoteLabel: 'Harici işleme', localDetail: '{title} girdileri, araç destekliyorsa tarayıcınızda işlenir.', remoteDetail: '{title}, yapılandırılmış bir harici işleme uç noktası kullanır ve yalnızca yerel işleme olarak sunulmaz.' },
  uk: { localLabel: 'Локальна обробка', remoteLabel: 'Зовнішня обробка', localDetail: 'Вхідні дані для {title} обробляються у браузері, якщо інструмент це підтримує.', remoteDetail: '{title} використовує налаштовану зовнішню точку обробки і не подається як суто локальний.' },
  vi: { localLabel: 'Xử lý cục bộ', remoteLabel: 'Xử lý bên ngoài', localDetail: 'Dữ liệu đầu vào của {title} được xử lý trong trình duyệt khi công cụ hỗ trợ.', remoteDetail: '{title} sử dụng một điểm cuối xử lý bên ngoài đã cấu hình và không được trình bày là chỉ xử lý cục bộ.' },
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
  const detail = (mode === 'local' ? copy.localDetail : copy.remoteDetail).replace('{title}', title);

  return {
    mode,
    label: mode === 'local' ? copy.localLabel : copy.remoteLabel,
    detail,
  };
}
