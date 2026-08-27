import { getReadyToolConfigs, getToolConfig, type ToolConfig } from '../../config/tools';
import { LOCALES, LOCALE_METADATA, SITE_ORIGIN, type Locale, normalizeLocale } from '../i18n';
import { localizeToolCategory, localizeToolDescription, localizeToolTitle } from '../i18n/tool-localization';
import { getToolSeoManifest } from './tool-manifests';

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'Online tool', ar: 'أداة عبر الإنترنت', es: 'Herramienta en línea', fr: 'Outil en ligne',
  de: 'Online-Tool', ru: 'Онлайн-инструмент', zh: '在线工具', hi: 'ऑनलाइन टूल', id: 'Alat online',
  ur: 'آن لائن ٹول', ja: 'オンラインツール', pt: 'Ferramenta online', it: 'Strumento online',
  ko: '온라인 도구', nl: 'Online tool', pl: 'Narzędzie online', tr: 'Çevrimiçi araç',
  vi: 'Công cụ trực tuyến', th: 'เครื่องมือออนไลน์', sv: 'Onlineverktyg',
};

const FALLBACK_COPY: Record<Locale, Readonly<{ open: string; configure: string; run: string; download: string; browser: string; interface: string }>> = {
  en: { open: 'Open the tool.', configure: 'Configure the available options.', run: 'Run the tool.', download: 'Download the result.', browser: 'Browser-first processing', interface: 'interface' },
  ar: { open: 'افتح الأداة.', configure: 'اضبط الخيارات المتاحة.', run: 'شغّل الأداة.', download: 'نزّل النتيجة.', browser: 'معالجة محلية أولًا داخل المتصفح', interface: 'الواجهة' },
  es: { open: 'Abre la herramienta.', configure: 'Configura las opciones disponibles.', run: 'Ejecuta la herramienta.', download: 'Descarga el resultado.', browser: 'Procesamiento prioritario en el navegador', interface: 'interfaz' },
  fr: { open: 'Ouvrez l’outil.', configure: 'Configurez les options disponibles.', run: 'Exécutez l’outil.', download: 'Téléchargez le résultat.', browser: 'Traitement prioritaire dans le navigateur', interface: 'interface' },
  de: { open: 'Öffnen Sie das Tool.', configure: 'Konfigurieren Sie die verfügbaren Optionen.', run: 'Führen Sie das Tool aus.', download: 'Laden Sie das Ergebnis herunter.', browser: 'Browserbasierte Verarbeitung', interface: 'Oberfläche' },
  ru: { open: 'Откройте инструмент.', configure: 'Настройте доступные параметры.', run: 'Запустите инструмент.', download: 'Скачайте результат.', browser: 'Обработка в браузере', interface: 'интерфейс' },
  zh: { open: '打开工具。', configure: '配置可用选项。', run: '运行工具。', download: '下载结果。', browser: '优先在浏览器中处理', interface: '界面' },
  hi: { open: 'टूल खोलें।', configure: 'उपलब्ध विकल्प कॉन्फ़िगर करें।', run: 'टूल चलाएँ।', download: 'परिणाम डाउनलोड करें।', browser: 'ब्राउज़र-प्राथमिक प्रोसेसिंग', interface: 'इंटरफ़ेस' },
  id: { open: 'Buka alat.', configure: 'Atur opsi yang tersedia.', run: 'Jalankan alat.', download: 'Unduh hasilnya.', browser: 'Pemrosesan berbasis browser', interface: 'antarmuka' },
  ur: { open: 'ٹول کھولیں۔', configure: 'دستیاب اختیارات ترتیب دیں۔', run: 'ٹول چلائیں۔', download: 'نتیجہ ڈاؤن لوڈ کریں۔', browser: 'براؤزر میں ترجیحی پراسیسنگ', interface: 'انٹرفیس' },
  ja: { open: 'ツールを開きます。', configure: '利用可能なオプションを設定します。', run: 'ツールを実行します。', download: '結果をダウンロードします。', browser: 'ブラウザ優先の処理', interface: 'インターフェース' },
  pt: { open: 'Abra a ferramenta.', configure: 'Configure as opções disponíveis.', run: 'Execute a ferramenta.', download: 'Baixe o resultado.', browser: 'Processamento prioritário no navegador', interface: 'interface' },
  it: { open: 'Apri lo strumento.', configure: 'Configura le opzioni disponibili.', run: 'Esegui lo strumento.', download: 'Scarica il risultato.', browser: 'Elaborazione prioritaria nel browser', interface: 'interfaccia' },
  ko: { open: '도구를 엽니다.', configure: '사용 가능한 옵션을 설정합니다.', run: '도구를 실행합니다.', download: '결과를 다운로드합니다.', browser: '브라우저 우선 처리', interface: '인터페이스' },
  nl: { open: 'Open de tool.', configure: 'Configureer de beschikbare opties.', run: 'Voer de tool uit.', download: 'Download het resultaat.', browser: 'Browsergerichte verwerking', interface: 'interface' },
  pl: { open: 'Otwórz narzędzie.', configure: 'Skonfiguruj dostępne opcje.', run: 'Uruchom narzędzie.', download: 'Pobierz wynik.', browser: 'Przetwarzanie w przeglądarce', interface: 'interfejs' },
  tr: { open: 'Aracı açın.', configure: 'Mevcut seçenekleri yapılandırın.', run: 'Aracı çalıştırın.', download: 'Sonucu indirin.', browser: 'Tarayıcı öncelikli işleme', interface: 'arayüz' },
  vi: { open: 'Mở công cụ.', configure: 'Cấu hình các tùy chọn có sẵn.', run: 'Chạy công cụ.', download: 'Tải kết quả xuống.', browser: 'Xử lý ưu tiên trong trình duyệt', interface: 'giao diện' },
  th: { open: 'เปิดเครื่องมือ', configure: 'กำหนดค่าตัวเลือกที่มี', run: 'เรียกใช้เครื่องมือ', download: 'ดาวน์โหลดผลลัพธ์', browser: 'ประมวลผลในเบราว์เซอร์เป็นหลัก', interface: 'อินเทอร์เฟซ' },
  sv: { open: 'Öppna verktyget.', configure: 'Konfigurera tillgängliga alternativ.', run: 'Kör verktyget.', download: 'Ladda ner resultatet.', browser: 'Webbläsarbaserad bearbetning', interface: 'gränssnitt' },
};

export const READY_TOOL_IDS = Object.freeze(getReadyToolConfigs().map((tool) => tool.id));

export function getLocalizedToolUrl(locale: Locale, toolId: string): string {
  return `${SITE_ORIGIN}/${locale}/${toolId}`;
}

export function getToolSeo(localeInput: string, toolId: string) {
  const locale = normalizeLocale(localeInput);
  const tool = getToolConfig(toolId);

  if (!tool || !tool.isReady) return null;

  const label = LOCALE_LABELS[locale];
  const url = getLocalizedToolUrl(locale, tool.id);
  const xDefaultUrl = getLocalizedToolUrl('en', tool.id);
  const manifest = getToolSeoManifest(tool.id);
  const manifestSeo = manifest?.seoLocales[locale];
  const localizedTitle = localizeToolTitle(locale, tool.title, tool.category);
  const localizedDescription = localizeToolDescription(locale, tool.title, tool.category);
  const title = manifestSeo?.title ?? `${localizedTitle} | FLIXO`;
  const description = manifestSeo?.description ?? localizedDescription;
  const fallback = FALLBACK_COPY[locale];
  const localizedCategory = localizeToolCategory(locale, tool.category);
  const localizedPayload = manifestSeo ?? {
    title,
    description,
    intro: description,
    keywords: [localizedTitle, 'FLIXO', label],
    howTo: [fallback.open, fallback.configure, fallback.run, fallback.download],
    features: [fallback.browser],
    altText: [`${localizedTitle} ${fallback.interface}`],
  };

  return {
    locale,
    tool,
    url,
    xDefaultUrl,
    title,
    description,
    intro: localizedPayload.intro,
    keywords: localizedPayload.keywords,
    howTo: localizedPayload.howTo,
    features: localizedPayload.features,
    altText: localizedPayload.altText,
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
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'Any',
          keywords: localizedPayload.keywords.join(', '),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'FLIXO',
              item: `${SITE_ORIGIN}/${locale}`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: localizedCategory,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: title,
              item: getLocalizedToolUrl(locale, tool.id),
            },
          ],
        },
      ],
    },
  } as const;
}

export function getReadyToolsForSeo(): readonly ToolConfig[] {
  return getReadyToolConfigs();
}
