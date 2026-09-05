import type { Locale } from '@/lib/i18n';
import { LOCALES, LOCALE_METADATA } from '@/lib/i18n';
import type { LocalizedToolSeo, ToolManifest } from './tool-manifest';

type ToolSeoInput = Readonly<{
  id: string;
  title: string;
  path: string;
  description: string;
  category: 'Images' | 'AI' | 'Other';
  isReady: boolean;
}>;

const CORE: Record<Locale, {
  online: string;
  intro: string;
  step1: string;
  step2: string;
  step3: string;
  step4: string;
  features: string[];
  alt: string;
}> = {
  en: { online: 'Online tool', intro: 'Use FLIXO’s {title} directly in your browser with a fast, privacy-first workflow.', step1: 'Open the tool and choose your input.', step2: 'Adjust the available options for the desired output.', step3: 'Run the tool and review the result in your browser.', step4: 'Download or copy the finished result.', features: ['Browser-first processing', 'No account required', 'Fast local workflow'], alt: '{title} interface in FLIXO' },
  ar: { online: 'أداة عبر الإنترنت', intro: 'استخدم {title} من FLIXO مباشرة داخل المتصفح مع تجربة سريعة وتركّز على الخصوصية.', step1: 'افتح الأداة واختر المدخلات المطلوبة.', step2: 'اضبط الخيارات المتاحة للحصول على النتيجة المطلوبة.', step3: 'شغّل الأداة وراجع النتيجة داخل المتصفح.', step4: 'نزّل النتيجة النهائية أو انسخها.', features: ['معالجة أولًا داخل المتصفح', 'بدون حساب', 'سير عمل محلي سريع'], alt: 'واجهة {title} في FLIXO' },
  es: { online: 'Herramienta en línea', intro: 'Usa {title} de FLIXO directamente en tu navegador con un flujo rápido y centrado en la privacidad.', step1: 'Abre la herramienta y elige la entrada.', step2: 'Ajusta las opciones disponibles.', step3: 'Ejecuta la herramienta y revisa el resultado.', step4: 'Descarga o copia el resultado final.', features: ['Procesamiento en el navegador', 'Sin cuenta', 'Flujo local rápido'], alt: 'Interfaz de {title} en FLIXO' },
  fr: { online: 'Outil en ligne', intro: 'Utilisez {title} de FLIXO directement dans votre navigateur avec un flux rapide et axé sur la confidentialité.', step1: 'Ouvrez l’outil et choisissez l’entrée.', step2: 'Réglez les options disponibles.', step3: 'Lancez l’outil et vérifiez le résultat.', step4: 'Téléchargez ou copiez le résultat final.', features: ['Traitement dans le navigateur', 'Sans compte', 'Flux local rapide'], alt: 'Interface {title} dans FLIXO' },
  de: { online: 'Online-Tool', intro: 'Nutzen Sie {title} von FLIXO direkt im Browser mit einem schnellen, datenschutzorientierten Ablauf.', step1: 'Öffnen Sie das Tool und wählen Sie die Eingabe.', step2: 'Passen Sie die verfügbaren Optionen an.', step3: 'Starten Sie das Tool und prüfen Sie das Ergebnis.', step4: 'Laden Sie das Ergebnis herunter oder kopieren Sie es.', features: ['Verarbeitung im Browser', 'Kein Konto erforderlich', 'Schneller lokaler Ablauf'], alt: '{title}-Oberfläche in FLIXO' },
  ru: { online: 'Онлайн-инструмент', intro: 'Используйте {title} от FLIXO прямо в браузере с быстрым и ориентированным на приватность процессом.', step1: 'Откройте инструмент и выберите входные данные.', step2: 'Настройте доступные параметры.', step3: 'Запустите инструмент и проверьте результат.', step4: 'Скачайте или скопируйте готовый результат.', features: ['Обработка в браузере', 'Без аккаунта', 'Быстрый локальный процесс'], alt: 'Интерфейс {title} в FLIXO' },
  zh: { online: '在线工具', intro: '直接在浏览器中使用 FLIXO 的 {title}，体验快速且注重隐私的工作流程。', step1: '打开工具并选择输入内容。', step2: '调整可用选项以获得所需输出。', step3: '运行工具并在浏览器中查看结果。', step4: '下载或复制最终结果。', features: ['浏览器本地处理', '无需账号', '快速本地工作流'], alt: 'FLIXO 中的 {title} 界面' },
  hi: { online: 'ऑनलाइन टूल', intro: 'तेज़ और गोपनीयता-केंद्रित अनुभव के साथ सीधे ब्राउज़र में FLIXO का {title} इस्तेमाल करें।', step1: 'टूल खोलें और इनपुट चुनें।', step2: 'आवश्यक आउटपुट के लिए विकल्प समायोजित करें।', step3: 'टूल चलाएँ और परिणाम देखें।', step4: 'अंतिम परिणाम डाउनलोड या कॉपी करें।', features: ['ब्राउज़र-आधारित प्रोसेसिंग', 'खाते की आवश्यकता नहीं', 'तेज़ लोकल वर्कफ़्लो'], alt: 'FLIXO में {title} इंटरफ़ेस' },
  id: { online: 'Alat online', intro: 'Gunakan {title} dari FLIXO langsung di browser dengan alur cepat yang mengutamakan privasi.', step1: 'Buka alat dan pilih input.', step2: 'Sesuaikan opsi yang tersedia.', step3: 'Jalankan alat dan periksa hasilnya.', step4: 'Unduh atau salin hasil akhir.', features: ['Pemrosesan di browser', 'Tanpa akun', 'Alur lokal cepat'], alt: 'Antarmuka {title} di FLIXO' },
  ur: { online: 'آن لائن ٹول', intro: 'تیز اور پرائیویسی پر مبنی ورک فلو کے ساتھ FLIXO کا {title} براہِ راست براؤزر میں استعمال کریں۔', step1: 'ٹول کھولیں اور ان پٹ منتخب کریں۔', step2: 'مطلوبہ نتیجے کے لیے دستیاب اختیارات ترتیب دیں۔', step3: 'ٹول چلائیں اور نتیجہ دیکھیں۔', step4: 'حتمی نتیجہ ڈاؤن لوڈ یا کاپی کریں۔', features: ['براؤزر میں پراسیسنگ', 'اکاؤنٹ کی ضرورت نہیں', 'تیز مقامی ورک فلو'], alt: 'FLIXO میں {title} کا انٹرفیس' },
  ja: { online: 'オンラインツール', intro: '高速でプライバシーを重視したワークフローで、FLIXO の {title} をブラウザから直接利用できます。', step1: 'ツールを開いて入力を選択します。', step2: '必要な出力に合わせて設定を調整します。', step3: 'ツールを実行して結果を確認します。', step4: '完成した結果をダウンロードまたはコピーします。', features: ['ブラウザ内処理', 'アカウント不要', '高速なローカル処理'], alt: 'FLIXO の {title} インターフェース' },
  pt: { online: 'Ferramenta online', intro: 'Use o {title} da FLIXO diretamente no navegador com um fluxo rápido e focado em privacidade.', step1: 'Abra a ferramenta e escolha a entrada.', step2: 'Ajuste as opções disponíveis.', step3: 'Execute a ferramenta e confira o resultado.', step4: 'Baixe ou copie o resultado final.', features: ['Processamento no navegador', 'Sem conta', 'Fluxo local rápido'], alt: 'Interface de {title} no FLIXO' },
  it: { online: 'Strumento online', intro: 'Usa {title} di FLIXO direttamente nel browser con un flusso rapido e attento alla privacy.', step1: 'Apri lo strumento e scegli l’input.', step2: 'Regola le opzioni disponibili.', step3: 'Esegui lo strumento e controlla il risultato.', step4: 'Scarica o copia il risultato finale.', features: ['Elaborazione nel browser', 'Nessun account', 'Flusso locale rapido'], alt: 'Interfaccia {title} in FLIXO' },
  ko: { online: '온라인 도구', intro: '빠르고 개인정보 보호를 우선하는 작업 흐름으로 브라우저에서 FLIXO의 {title}을(를) 바로 사용하세요.', step1: '도구를 열고 입력을 선택합니다.', step2: '원하는 결과에 맞게 옵션을 조정합니다.', step3: '도구를 실행하고 결과를 확인합니다.', step4: '완성된 결과를 다운로드하거나 복사합니다.', features: ['브라우저 내 처리', '계정 불필요', '빠른 로컬 작업 흐름'], alt: 'FLIXO의 {title} 인터페이스' },
  nl: { online: 'Online tool', intro: 'Gebruik {title} van FLIXO direct in je browser met een snelle workflow die privacy vooropstelt.', step1: 'Open de tool en kies invoer.', step2: 'Pas de beschikbare opties aan.', step3: 'Voer de tool uit en controleer het resultaat.', step4: 'Download of kopieer het eindresultaat.', features: ['Verwerking in de browser', 'Geen account', 'Snelle lokale workflow'], alt: '{title}-interface in FLIXO' },
  pl: { online: 'Narzędzie online', intro: 'Używaj {title} FLIXO bezpośrednio w przeglądarce, korzystając z szybkiego przepływu pracy z naciskiem na prywatność.', step1: 'Otwórz narzędzie i wybierz dane wejściowe.', step2: 'Dostosuj dostępne opcje.', step3: 'Uruchom narzędzie i sprawdź wynik.', step4: 'Pobierz lub skopiuj gotowy wynik.', features: ['Przetwarzanie w przeglądarce', 'Bez konta', 'Szybki lokalny przepływ pracy'], alt: 'Interfejs {title} w FLIXO' },
  tr: { online: 'Çevrimiçi araç', intro: 'Hızlı ve gizlilik odaklı bir iş akışıyla FLIXO {title} aracını doğrudan tarayıcıda kullanın.', step1: 'Aracı açın ve girdiyi seçin.', step2: 'Kullanılabilir seçenekleri ayarlayın.', step3: 'Aracı çalıştırın ve sonucu inceleyin.', step4: 'Sonucu indirin veya kopyalayın.', features: ['Tarayıcıda işleme', 'Hesap gerekmez', 'Hızlı yerel iş akışı'], alt: 'FLIXO {title} arayüzü' },
  vi: { online: 'Công cụ trực tuyến', intro: 'Sử dụng {title} của FLIXO ngay trong trình duyệt với quy trình nhanh và ưu tiên quyền riêng tư.', step1: 'Mở công cụ và chọn dữ liệu đầu vào.', step2: 'Điều chỉnh các tùy chọn cần thiết.', step3: 'Chạy công cụ và kiểm tra kết quả.', step4: 'Tải xuống hoặc sao chép kết quả cuối cùng.', features: ['Xử lý ngay trong trình duyệt', 'Không cần tài khoản', 'Quy trình cục bộ nhanh'], alt: 'Giao diện {title} trong FLIXO' },
  th: { online: 'เครื่องมือออนไลน์', intro: 'ใช้ {title} ของ FLIXO ได้โดยตรงในเบราว์เซอร์ พร้อมขั้นตอนการทำงานที่รวดเร็วและเน้นความเป็นส่วนตัว', step1: 'เปิดเครื่องมือและเลือกข้อมูลนำเข้า', step2: 'ปรับตัวเลือกตามผลลัพธ์ที่ต้องการ', step3: 'เรียกใช้เครื่องมือและตรวจสอบผลลัพธ์', step4: 'ดาวน์โหลดหรือคัดลอกผลลัพธ์', features: ['ประมวลผลในเบราว์เซอร์', 'ไม่ต้องมีบัญชี', 'เวิร์กโฟลว์ภายในเครื่องที่รวดเร็ว'], alt: 'อินเทอร์เฟซ {title} ใน FLIXO' },
  sv: { online: 'Onlineverktyg', intro: 'Använd FLIXO:s {title} direkt i webbläsaren med ett snabbt arbetsflöde som prioriterar integritet.', step1: 'Öppna verktyget och välj indata.', step2: 'Justera tillgängliga alternativ.', step3: 'Kör verktyget och granska resultatet.', step4: 'Ladda ner eller kopiera resultatet.', features: ['Bearbetning i webbläsaren', 'Inget konto krävs', 'Snabbt lokalt arbetsflöde'], alt: '{title}-gränssnitt i FLIXO' },
};

function splitTitle(title: string): string[] {
  return title.replace(/[&/]/g, ' ').split(/\s+/).filter(Boolean);
}

const TERM_MAPS: Record<Locale, Record<string, string>> = {
  en: {}, ar: { Compressor: 'ضاغط الصور', Converter: 'محول', Image: 'الصور', Video: 'الفيديو', Audio: 'الصوت', Text: 'النص', AI: 'ذكاء اصطناعي', Remover: 'إزالة', Generator: 'مولد' },
  es: { Compressor: 'Compresor', Converter: 'Convertidor', Image: 'Imágenes', Video: 'Vídeo', Audio: 'Audio', Text: 'Texto', AI: 'IA', Remover: 'Eliminación', Generator: 'Generador' },
  fr: { Compressor: 'Compresseur', Converter: 'Convertisseur', Image: 'Images', Video: 'Vidéo', Audio: 'Audio', Text: 'Texte', AI: 'IA', Remover: 'Suppression', Generator: 'Générateur' },
  de: { Compressor: 'Kompressor', Converter: 'Konverter', Image: 'Bilder', Video: 'Video', Audio: 'Audio', Text: 'Text', AI: 'KI', Remover: 'Entfernung', Generator: 'Generator' },
  ru: { Compressor: 'Компрессор', Converter: 'Конвертер', Image: 'Изображения', Video: 'Видео', Audio: 'Аудио', Text: 'Текст', AI: 'ИИ', Remover: 'Удаление', Generator: 'Генератор' },
  zh: { Compressor: '压缩器', Converter: '转换器', Image: '图像', Video: '视频', Audio: '音频', Text: '文本', AI: '人工智能', Remover: '移除', Generator: '生成器' },
  hi: { Compressor: 'कंप्रेसर', Converter: 'कन्वर्टर', Image: 'इमेज', Video: 'वीडियो', Audio: 'ऑडियो', Text: 'टेक्स्ट', AI: 'एआई', Remover: 'रिमूवर', Generator: 'जनरेटर' },
  id: { Compressor: 'Kompresor', Converter: 'Konverter', Image: 'Gambar', Video: 'Video', Audio: 'Audio', Text: 'Teks', AI: 'AI', Remover: 'Penghapus', Generator: 'Generator' },
  ur: { Compressor: 'کمپریسر', Converter: 'کنورٹر', Image: 'تصاویر', Video: 'ویڈیو', Audio: 'آڈیو', Text: 'متن', AI: 'اے آئی', Remover: 'حذف', Generator: 'جنریٹر' },
  ja: { Compressor: '圧縮', Converter: '変換', Image: '画像', Video: '動画', Audio: '音声', Text: 'テキスト', AI: 'AI', Remover: '削除', Generator: '生成' },
  pt: { Compressor: 'Compressor', Converter: 'Conversor', Image: 'Imagens', Video: 'Vídeo', Audio: 'Áudio', Text: 'Texto', AI: 'IA', Remover: 'Remoção', Generator: 'Gerador' },
  it: { Compressor: 'Compressore', Converter: 'Convertitore', Image: 'Immagini', Video: 'Video', Audio: 'Audio', Text: 'Testo', AI: 'IA', Remover: 'Rimozione', Generator: 'Generatore' },
  ko: { Compressor: '압축기', Converter: '변환기', Image: '이미지', Video: '비디오', Audio: '오디오', Text: '텍스트', AI: 'AI', Remover: '제거', Generator: '생성기' },
  nl: { Compressor: 'Compressor', Converter: 'Converter', Image: 'Afbeeldingen', Video: 'Video', Audio: 'Audio', Text: 'Tekst', AI: 'AI', Remover: 'Verwijdering', Generator: 'Generator' },
  pl: { Compressor: 'Kompresor', Converter: 'Konwerter', Image: 'Obrazy', Video: 'Wideo', Audio: 'Audio', Text: 'Tekst', AI: 'AI', Remover: 'Usuwanie', Generator: 'Generator' },
  tr: { Compressor: 'Sıkıştırıcı', Converter: 'Dönüştürücü', Image: 'Görüntüler', Video: 'Video', Audio: 'Ses', Text: 'Metin', AI: 'Yapay zekâ', Remover: 'Kaldırma', Generator: 'Oluşturucu' },
  vi: { Compressor: 'Trình nén', Converter: 'Trình chuyển đổi', Image: 'Hình ảnh', Video: 'Video', Audio: 'Âm thanh', Text: 'Văn bản', AI: 'AI', Remover: 'Xóa', Generator: 'Trình tạo' },
  th: { Compressor: 'ตัวบีบอัด', Converter: 'ตัวแปลง', Image: 'รูปภาพ', Video: 'วิดีโอ', Audio: 'เสียง', Text: 'ข้อความ', AI: 'AI', Remover: 'ลบ', Generator: 'ตัวสร้าง' },
  sv: { Compressor: 'Kompressor', Converter: 'Konverterare', Image: 'Bilder', Video: 'Video', Audio: 'Ljud', Text: 'Text', AI: 'AI', Remover: 'Borttagning', Generator: 'Generator' },
};

function localizeTitle(locale: Locale, title: string): string {
  if (locale === 'en') return title;
  const map = TERM_MAPS[locale];
  return splitTitle(title).map((token) => map[token] ?? token).join(' ');
}

function capabilitiesFor(tool: ToolSeoInput, locale: Locale): string[] {
  const text = `${tool.id} ${tool.title}`.toLowerCase();
  const localized = TERM_MAPS[locale];
  const caps: string[] = [];
  const add = (value: string) => { if (!caps.includes(value)) caps.push(value); };
  if (text.includes('compress')) add(localized.Compressor ?? 'Compression');
  if (text.includes('convert')) add(localized.Converter ?? 'Conversion');
  if (text.includes('image') || text.includes('photo')) add(localized.Image ?? 'Images');
  if (text.includes('pdf')) add('PDF');
  if (text.includes('video')) add(localized.Video ?? 'Video');
  if (text.includes('audio')) add(localized.Audio ?? 'Audio');
  if (text.includes('text') || text.includes('word') || text.includes('ocr')) add(localized.Text ?? 'Text');
  if (text.includes('ai')) add(localized.AI ?? 'AI');
  if (text.includes('remove')) add(localized.Remover ?? 'Removal');
  if (text.includes('generator') || text.includes('maker')) add(localized.Generator ?? 'Generation');
  if (!caps.length) add(tool.category);
  return caps;
}

export function buildLocalizedToolSeo(tool: ToolSeoInput, locale: Locale): LocalizedToolSeo {
  const core = CORE[locale];
  const title = localizeTitle(locale, tool.title);
  const capabilities = capabilitiesFor(tool, locale);
  const intro = core.intro.replace('{title}', title);
  const description = locale === 'en'
    ? `${tool.description} FLIXO provides a browser-first workflow designed for speed, privacy, and simple exports.`
    : `${title} — ${core.online}. ${intro} ${capabilities.join(' · ')}.`;
  return {
    title: `${title} | FLIXO`,
    description,
    intro,
    keywords: Object.freeze([title, 'FLIXO', core.online, ...capabilities]),
    howTo: Object.freeze([core.step1, core.step2, core.step3, core.step4]),
    features: Object.freeze([...core.features, ...capabilities]),
    altText: Object.freeze([core.alt.replace('{title}', title)]),
  };
}

export function buildToolSeoManifest(tool: ToolSeoInput): ToolManifest {
  const seoLocales = Object.fromEntries(LOCALES.map((locale) => [locale, buildLocalizedToolSeo(tool, locale)])) as Record<Locale, LocalizedToolSeo>;
  return Object.freeze({
    toolId: tool.id,
    slug: tool.id,
    status: 'ready',
    seoStatus: 'complete',
    capabilities: Object.freeze([...capabilitiesFor(tool, 'en')]),
    seoLocales: Object.freeze(seoLocales),
  });
}

export function buildAllToolSeoManifests(tools: readonly ToolSeoInput[]): readonly ToolManifest[] {
  return Object.freeze(tools.filter((tool) => tool.isReady).map(buildToolSeoManifest));
}

export function getLocalizedSeoLanguage(locale: Locale): string {
  return LOCALE_METADATA[locale].languageTag;
}
