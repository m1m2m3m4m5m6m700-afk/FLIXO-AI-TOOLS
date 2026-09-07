import type { Locale } from '@/lib/i18n';
import { LOCALES, LOCALE_METADATA } from '@/lib/i18n';
import { getAuthoritativeToolSeoName } from '@/config/tool-seo-name-resolver';
import type { LocalizedToolSeo, ToolManifest } from './tool-manifest';

type ToolSeoInput = Readonly<{
  id: string;
  title: string;
  path: string;
  description: string;
  category: 'Images';
  isReady: boolean;
}>;

const ONLINE_LABELS: Record<Locale, string> = {
  ar: 'أداة عبر الإنترنت', en: 'Online tool', es: 'Herramienta en línea', fr: 'Outil en ligne', de: 'Online-Tool', ru: 'Онлайн-инструмент', zh: '在线工具', hi: 'ऑनलाइन टूल', id: 'Alat online', ur: 'آن لائن ٹول', ja: 'オンラインツール', pt: 'Ferramenta online', it: 'Strumento online', ko: '온라인 도구', nl: 'Online tool', pl: 'Narzędzie online', tr: 'Çevrimiçi araç', vi: 'Công cụ trực tuyến', th: 'เครื่องมือออนไลน์', sv: 'Onlineverktyg',
};

const COPY: Record<Locale, { open: string; configure: string; run: string; download: string; browser: string; altSuffix: string }> = {
  en: { open: 'Open the tool and choose your input.', configure: 'Adjust the available options.', run: 'Run the tool and review the result.', download: 'Download the finished result.', browser: 'Browser-first processing', altSuffix: 'interface in FLIXO' },
  ar: { open: 'افتح الأداة واختر المدخلات.', configure: 'اضبط الخيارات المتاحة.', run: 'شغّل الأداة وراجع النتيجة.', download: 'نزّل النتيجة النهائية.', browser: 'معالجة أولًا داخل المتصفح', altSuffix: 'واجهة في FLIXO' },
  es: { open: 'Abre la herramienta y elige la entrada.', configure: 'Ajusta las opciones disponibles.', run: 'Ejecuta la herramienta y revisa el resultado.', download: 'Descarga el resultado final.', browser: 'Procesamiento en el navegador', altSuffix: 'interfaz en FLIXO' },
  fr: { open: 'Ouvrez l’outil et choisissez l’entrée.', configure: 'Réglez les options disponibles.', run: 'Lancez l’outil et vérifiez le résultat.', download: 'Téléchargez le résultat final.', browser: 'Traitement dans le navigateur', altSuffix: 'interface dans FLIXO' },
  de: { open: 'Öffnen Sie das Tool und wählen Sie die Eingabe.', configure: 'Passen Sie die verfügbaren Optionen an.', run: 'Starten Sie das Tool und prüfen Sie das Ergebnis.', download: 'Laden Sie das Ergebnis herunter.', browser: 'Verarbeitung im Browser', altSuffix: 'Oberfläche in FLIXO' },
  ru: { open: 'Откройте инструмент и выберите входные данные.', configure: 'Настройте доступные параметры.', run: 'Запустите инструмент и проверьте результат.', download: 'Скачайте готовый результат.', browser: 'Обработка в браузере', altSuffix: 'интерфейс FLIXO' },
  zh: { open: '打开工具并选择输入内容。', configure: '调整可用选项。', run: '运行工具并查看结果。', download: '下载最终结果。', browser: '浏览器优先处理', altSuffix: 'FLIXO 界面' },
  hi: { open: 'टूल खोलें और इनपुट चुनें।', configure: 'उपलब्ध विकल्प समायोजित करें।', run: 'टूल चलाएँ और परिणाम देखें।', download: 'अंतिम परिणाम डाउनलोड करें।', browser: 'ब्राउज़र-प्राथमिक प्रोसेसिंग', altSuffix: 'FLIXO इंटरफ़ेस' },
  id: { open: 'Buka alat dan pilih input.', configure: 'Sesuaikan opsi yang tersedia.', run: 'Jalankan alat dan periksa hasilnya.', download: 'Unduh hasil akhir.', browser: 'Pemrosesan di browser', altSuffix: 'antarmuka FLIXO' },
  ur: { open: 'ٹول کھولیں اور ان پٹ منتخب کریں۔', configure: 'دستیاب اختیارات ترتیب دیں۔', run: 'ٹول چلائیں اور نتیجہ دیکھیں۔', download: 'حتمی نتیجہ ڈاؤن لوڈ کریں۔', browser: 'براؤزر میں پراسیسنگ', altSuffix: 'FLIXO انٹرفیس' },
  ja: { open: 'ツールを開いて入力を選択します。', configure: '利用可能なオプションを調整します。', run: 'ツールを実行して結果を確認します。', download: '結果をダウンロードします。', browser: 'ブラウザ優先処理', altSuffix: 'FLIXO のインターフェース' },
  pt: { open: 'Abra a ferramenta e escolha a entrada.', configure: 'Ajuste as opções disponíveis.', run: 'Execute a ferramenta e confira o resultado.', download: 'Baixe o resultado final.', browser: 'Processamento no navegador', altSuffix: 'interface no FLIXO' },
  it: { open: 'Apri lo strumento e scegli l’input.', configure: 'Regola le opzioni disponibili.', run: 'Esegui lo strumento e controlla il risultato.', download: 'Scarica il risultato finale.', browser: 'Elaborazione nel browser', altSuffix: 'interfaccia FLIXO' },
  ko: { open: '도구를 열고 입력을 선택합니다.', configure: '사용 가능한 옵션을 조정합니다.', run: '도구를 실행하고 결과를 확인합니다.', download: '최종 결과를 다운로드합니다.', browser: '브라우저 우선 처리', altSuffix: 'FLIXO 인터페이스' },
  nl: { open: 'Open de tool en kies invoer.', configure: 'Pas de beschikbare opties aan.', run: 'Voer de tool uit en controleer het resultaat.', download: 'Download het eindresultaat.', browser: 'Verwerking in de browser', altSuffix: 'interface in FLIXO' },
  pl: { open: 'Otwórz narzędzie i wybierz dane wejściowe.', configure: 'Dostosuj dostępne opcje.', run: 'Uruchom narzędzie i sprawdź wynik.', download: 'Pobierz gotowy wynik.', browser: 'Przetwarzanie w przeglądarce', altSuffix: 'interfejs FLIXO' },
  tr: { open: 'Aracı açın ve girdiyi seçin.', configure: 'Kullanılabilir seçenekleri ayarlayın.', run: 'Aracı çalıştırın ve sonucu inceleyin.', download: 'Sonucu indirin.', browser: 'Tarayıcı öncelikli işleme', altSuffix: 'FLIXO arayüzü' },
  vi: { open: 'Mở công cụ và chọn dữ liệu đầu vào.', configure: 'Điều chỉnh các tùy chọn có sẵn.', run: 'Chạy công cụ và kiểm tra kết quả.', download: 'Tải kết quả cuối cùng xuống.', browser: 'Xử lý ưu tiên trong trình duyệt', altSuffix: 'giao diện FLIXO' },
  th: { open: 'เปิดเครื่องมือและเลือกข้อมูลนำเข้า', configure: 'ปรับตัวเลือกที่มี', run: 'เรียกใช้เครื่องมือและตรวจสอบผลลัพธ์', download: 'ดาวน์โหลดผลลัพธ์สุดท้าย', browser: 'ประมวลผลในเบราว์เซอร์เป็นหลัก', altSuffix: 'อินเทอร์เฟซ FLIXO' },
  sv: { open: 'Öppna verktyget och välj indata.', configure: 'Justera tillgängliga alternativ.', run: 'Kör verktyget och granska resultatet.', download: 'Ladda ner slutresultatet.', browser: 'Webbläsarbaserad bearbetning', altSuffix: 'gränssnitt i FLIXO' },
};

function buildLocalizedToolSeo(tool: ToolSeoInput, locale: Locale): LocalizedToolSeo {
  const copy = COPY[locale];
  const localizedTitle = getAuthoritativeToolSeoName(tool, locale) ?? tool.title;
  const description = locale === 'en'
    ? tool.description
    : `${localizedTitle} — ${copy.browser}.`;
  return {
    title: `${localizedTitle} | FLIXO`,
    description,
    intro: description,
    keywords: Object.freeze([localizedTitle, 'FLIXO', ONLINE_LABELS[locale]]),
    howTo: Object.freeze([copy.open, copy.configure, copy.run, copy.download]),
    features: Object.freeze([copy.browser]),
    altText: Object.freeze([`${localizedTitle} ${copy.altSuffix}`]),
  };
}

export function buildToolSeoManifest(tool: ToolSeoInput): ToolManifest {
  const seoLocales = Object.fromEntries(LOCALES.map((locale) => [locale, buildLocalizedToolSeo(tool, locale)])) as Record<Locale, LocalizedToolSeo>;
  return Object.freeze({ toolId: tool.id, slug: tool.id, status: 'ready', seoStatus: 'complete', capabilities: Object.freeze(['Images']), seoLocales: Object.freeze(seoLocales) });
}

export function buildAllToolSeoManifests(tools: readonly ToolSeoInput[]): readonly ToolManifest[] {
  return Object.freeze(tools.filter((tool) => tool.isReady).map(buildToolSeoManifest));
}

export function getLocalizedSeoLanguage(locale: Locale): string {
  return LOCALE_METADATA[locale].languageTag;
}
