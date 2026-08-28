import { getReadyToolConfigs, getToolConfig, type ToolConfig } from '../../config/tools';
import { LOCALES, LOCALE_METADATA, SITE_ORIGIN, type Locale, normalizeLocale } from '../i18n';
import { getToolSeoName } from '../i18n/tool-seo-localization';

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'Online tool', ar: 'أداة عبر الإنترنت', es: 'Herramienta en línea', fr: 'Outil en ligne',
  de: 'Online-Tool', ru: 'Онлайн-инструмент', zh: '在线工具', hi: 'ऑनलाइन टूल', id: 'Alat online',
  ur: 'آن لائن ٹول', ja: 'オンラインツール', pt: 'Ferramenta online', it: 'Strumento online',
  ko: '온라인 도구', nl: 'Online tool', pl: 'Narzędzie online', tr: 'Çevrimiçi araç',
  vi: 'Công cụ trực tuyến', th: 'เครื่องมือออนไลน์', sv: 'Onlineverktyg',
};

const CATEGORY_LABELS: Record<Locale, Record<'Images' | 'AI' | 'Other', string>> = {
  en: { Images: 'Images', AI: 'AI', Other: 'Other' },
  ar: { Images: 'الصور', AI: 'الذكاء الاصطناعي', Other: 'أخرى' },
  es: { Images: 'Imágenes', AI: 'IA', Other: 'Otros' },
  fr: { Images: 'Images', AI: 'IA', Other: 'Autres' },
  de: { Images: 'Bilder', AI: 'KI', Other: 'Andere' },
  ru: { Images: 'Изображения', AI: 'ИИ', Other: 'Другое' },
  zh: { Images: '图像', AI: '人工智能', Other: '其他' },
  hi: { Images: 'छवियाँ', AI: 'एआई', Other: 'अन्य' },
  id: { Images: 'Gambar', AI: 'AI', Other: 'Lainnya' },
  ur: { Images: 'تصاویر', AI: 'اے آئی', Other: 'دیگر' },
  ja: { Images: '画像', AI: 'AI', Other: 'その他' },
  pt: { Images: 'Imagens', AI: 'IA', Other: 'Outros' },
  it: { Images: 'Immagini', AI: 'IA', Other: 'Altro' },
  ko: { Images: '이미지', AI: 'AI', Other: '기타' },
  nl: { Images: 'Afbeeldingen', AI: 'AI', Other: 'Overig' },
  pl: { Images: 'Obrazy', AI: 'AI', Other: 'Inne' },
  tr: { Images: 'Görseller', AI: 'YZ', Other: 'Diğer' },
  vi: { Images: 'Hình ảnh', AI: 'AI', Other: 'Khác' },
  th: { Images: 'รูปภาพ', AI: 'AI', Other: 'อื่นๆ' },
  sv: { Images: 'Bilder', AI: 'AI', Other: 'Övrigt' },
};

const RUNTIME_COPY: Record<Locale, Readonly<{
  intro: string;
  open: string;
  configure: string;
  run: string;
  download: string;
  browser: string;
  interface: string;
}>> = {
  en: { intro: 'Use {title} directly in your browser with a fast workflow focused on privacy and simple exports.', open: 'Open the tool.', configure: 'Configure the available options.', run: 'Run the tool.', download: 'Download the result.', browser: 'Browser-first processing', interface: 'interface' },
  ar: { intro: 'استخدم {title} مباشرة داخل المتصفح مع تجربة سريعة تركز على الخصوصية وسهولة استخراج النتائج.', open: 'افتح الأداة.', configure: 'اضبط الخيارات المتاحة.', run: 'شغّل الأداة.', download: 'نزّل النتيجة.', browser: 'معالجة محلية أولًا داخل المتصفح', interface: 'الواجهة' },
  es: { intro: 'Usa {title} directamente en tu navegador con un flujo rápido centrado en la privacidad y exportaciones sencillas.', open: 'Abre la herramienta.', configure: 'Configura las opciones disponibles.', run: 'Ejecuta la herramienta.', download: 'Descarga el resultado.', browser: 'Procesamiento prioritario en el navegador', interface: 'interfaz' },
  fr: { intro: 'Utilisez {title} directement dans votre navigateur avec un flux rapide axé sur la confidentialité et des exports simples.', open: 'Ouvrez l’outil.', configure: 'Configurez les options disponibles.', run: 'Exécutez l’outil.', download: 'Téléchargez le résultat.', browser: 'Traitement prioritaire dans le navigateur', interface: 'interface' },
  de: { intro: 'Nutzen Sie {title} direkt im Browser mit einem schnellen, datenschutzorientierten Ablauf und einfachen Exporten.', open: 'Öffnen Sie das Tool.', configure: 'Konfigurieren Sie die verfügbaren Optionen.', run: 'Führen Sie das Tool aus.', download: 'Laden Sie das Ergebnis herunter.', browser: 'Browserbasierte Verarbeitung', interface: 'Oberfläche' },
  ru: { intro: 'Используйте {title} прямо в браузере с быстрым процессом, ориентированным на приватность и простой экспорт.', open: 'Откройте инструмент.', configure: 'Настройте доступные параметры.', run: 'Запустите инструмент.', download: 'Скачайте результат.', browser: 'Обработка в браузере', interface: 'интерфейс' },
  zh: { intro: '直接在浏览器中使用 {title}，享受快速、注重隐私并支持简单导出的工作流程。', open: '打开工具。', configure: '配置可用选项。', run: '运行工具。', download: '下载结果。', browser: '优先在浏览器中处理', interface: '界面' },
  hi: { intro: 'गोपनीयता और आसान निर्यात पर केंद्रित तेज़ वर्कफ़्लो के साथ सीधे ब्राउज़र में FLIXO का {title} इस्तेमाल करें।', open: 'टूल खोलें।', configure: 'उपलब्ध विकल्प कॉन्फ़िगर करें।', run: 'टूल चलाएँ।', download: 'परिणाम डाउनलोड करें।', browser: 'ब्राउज़र-प्राथमिक प्रोसेसिंग', interface: 'इंटरफ़ेस' },
  id: { intro: 'Gunakan {title} langsung di browser dengan alur cepat yang mengutamakan privasi dan ekspor sederhana.', open: 'Buka alat.', configure: 'Atur opsi yang tersedia.', run: 'Jalankan alat.', download: 'Unduh hasilnya.', browser: 'Pemrosesan berbasis browser', interface: 'antarmuka' },
  ur: { intro: 'رازداری اور آسان برآمد پر توجہ دینے والے تیز ورک فلو کے ساتھ FLIXO کا {title} براہِ راست براؤزر میں استعمال کریں۔', open: 'ٹول کھولیں۔', configure: 'دستیاب اختیارات ترتیب دیں۔', run: 'ٹول چلائیں۔', download: 'نتیجہ ڈاؤن لوڈ کریں۔', browser: 'براؤزر میں ترجیحی پراسیسنگ', interface: 'انٹرفیس' },
  ja: { intro: 'プライバシーと簡単な書き出しを重視した高速なワークフローで、FLIXO の {title} をブラウザから直接利用できます。', open: 'ツールを開きます。', configure: '利用可能なオプションを設定します。', run: 'ツールを実行します。', download: '結果をダウンロードします。', browser: 'ブラウザ優先の処理', interface: 'インターフェース' },
  pt: { intro: 'Use o {title} diretamente no navegador com um fluxo rápido, focado em privacidade e exportações simples.', open: 'Abra a ferramenta.', configure: 'Configure as opções disponíveis.', run: 'Execute a ferramenta.', download: 'Baixe o resultado.', browser: 'Processamento prioritário no navegador', interface: 'interface' },
  it: { intro: 'Usa {title} direttamente nel browser con un flusso rapido, attento alla privacy e a esportazioni semplici.', open: 'Apri lo strumento.', configure: 'Configura le opzioni disponibili.', run: 'Esegui lo strumento.', download: 'Scarica il risultato.', browser: 'Elaborazione prioritaria nel browser', interface: 'interfaccia' },
  ko: { intro: '개인정보 보호와 간편한 내보내기를 중시하는 빠른 작업 흐름으로 브라우저에서 FLIXO의 {title}을(를) 바로 사용하세요.', open: '도구를 엽니다.', configure: '사용 가능한 옵션을 설정합니다.', run: '도구를 실행합니다.', download: '결과를 다운로드합니다.', browser: '브라우저 우선 처리', interface: '인터페이스' },
  nl: { intro: 'Gebruik {title} van FLIXO direct in je browser met een snelle workflow die privacy en eenvoudige exports vooropstelt.', open: 'Open de tool.', configure: 'Configureer de beschikbare opties.', run: 'Voer de tool uit.', download: 'Download het resultaat.', browser: 'Browsergerichte verwerking', interface: 'interface' },
  pl: { intro: 'Używaj {title} FLIXO bezpośrednio w przeglądarce, korzystając z szybkiego przepływu pracy z naciskiem na prywatność i proste eksporty.', open: 'Otwórz narzędzie.', configure: 'Skonfiguruj dostępne opcje.', run: 'Uruchom narzędzie.', download: 'Pobierz wynik.', browser: 'Przetwarzanie w przeglądarce', interface: 'interfejs' },
  tr: { intro: 'Gizliliğe ve kolay dışa aktarmaya odaklanan hızlı bir iş akışıyla FLIXO {title} aracını doğrudan tarayıcıda kullanın.', open: 'Aracı açın.', configure: 'Mevcut seçenekleri yapılandırın.', run: 'Aracı çalıştırın.', download: 'Sonucu indirin.', browser: 'Tarayıcı öncelikli işleme', interface: 'arayüz' },
  vi: { intro: 'Sử dụng {title} của FLIXO ngay trong trình duyệt với quy trình nhanh, ưu tiên quyền riêng tư và xuất kết quả đơn giản.', open: 'Mở công cụ.', configure: 'Cấu hình các tùy chọn có sẵn.', run: 'Chạy công cụ.', download: 'Tải kết quả xuống.', browser: 'Xử lý ưu tiên trong trình duyệt', interface: 'giao diện' },
  th: { intro: 'ใช้ {title} ของ FLIXO ได้โดยตรงในเบราว์เซอร์ ด้วยเวิร์กโฟลว์ที่รวดเร็ว เน้นความเป็นส่วนตัว และส่งออกผลลัพธ์ได้ง่าย', open: 'เปิดเครื่องมือ', configure: 'กำหนดค่าตัวเลือกที่มี', run: 'เรียกใช้เครื่องมือ', download: 'ดาวน์โหลดผลลัพธ์', browser: 'ประมวลผลในเบราว์เซอร์เป็นหลัก', interface: 'อินเทอร์เฟซ' },
  sv: { intro: 'Använd FLIXO:s {title} direkt i webbläsaren med ett snabbt arbetsflöde som prioriterar integritet och enkla exporter.', open: 'Öppna verktyget.', configure: 'Konfigurera tillgängliga alternativ.', run: 'Kör verktyget.', download: 'Ladda ner resultatet.', browser: 'Webbläsarbaserad bearbetning', interface: 'gränssnitt' },
};

export const READY_TOOL_IDS = Object.freeze(getReadyToolConfigs().map((tool) => tool.id));

export function getLocalizedToolUrl(locale: Locale, toolId: string): string {
  return `${SITE_ORIGIN}/${locale}/${toolId}`;
}

function localizedName(locale: Locale, tool: ToolConfig): string {
  return getToolSeoName(tool.id, locale) ?? tool.title;
}

export function getToolSeo(localeInput: string, toolId: string) {
  const locale = normalizeLocale(localeInput);
  const tool = getToolConfig(toolId);
  if (!tool || !tool.isReady) return null;

  const name = localizedName(locale, tool);
  const title = `${name} | FLIXO`;
  const url = getLocalizedToolUrl(locale, tool.id);
  const xDefaultUrl = getLocalizedToolUrl('en', tool.id);
  const copy = RUNTIME_COPY[locale];
  const description = copy.intro.replace('{title}', name);
  const localizedCategory = CATEGORY_LABELS[locale][tool.category];

  return {
    locale,
    tool,
    url,
    xDefaultUrl,
    title,
    description,
    intro: description,
    keywords: [name, 'FLIXO', LOCALE_LABELS[locale]],
    howTo: [copy.open, copy.configure, copy.run, copy.download],
    features: [copy.browser],
    altText: [`${name} ${copy.interface}`],
    languageTag: LOCALE_METADATA[locale].languageTag,
    direction: LOCALE_METADATA[locale].direction,
    alternates: LOCALES.map((alternateLocale) => ({
      locale: alternateLocale,
      languageTag: LOCALE_METADATA[alternateLocale].languageTag,
      url: getLocalizedToolUrl(alternateLocale, tool.id),
    })),
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'SoftwareApplication',
          name: title,
          description,
          url,
          inLanguage: LOCALE_METADATA[locale].languageTag,
          applicationCategory: localizedCategory,
          operatingSystem: 'Any',
          keywords: [name, 'FLIXO', LOCALE_LABELS[locale]].join(', '),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'FLIXO', item: `${SITE_ORIGIN}/${locale}` },
            { '@type': 'ListItem', position: 2, name: localizedCategory },
            { '@type': 'ListItem', position: 3, name: title, item: url },
          ],
        },
      ],
    },
  } as const;
}

export function getReadyToolsForSeo(): readonly ToolConfig[] {
  return getReadyToolConfigs();
}
