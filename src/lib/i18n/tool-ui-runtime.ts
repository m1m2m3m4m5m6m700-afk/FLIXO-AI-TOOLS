import type { Locale } from './config';

type LocaleMap = Readonly<Partial<Record<Locale, string>>>;

const UI: Readonly<Record<string, LocaleMap>> = {
  'Tool Chain': { ar: 'سلسلة الأدوات', de: 'Werkzeugkette', es: 'Cadena de herramientas', fr: 'Chaîne d’outils', ru: 'Цепочка инструментов', zh: '工具链', hi: 'टूल चेन', id: 'Rangkaian alat', ur: 'ٹول چین', ja: 'ツールチェーン', pt: 'Cadeia de ferramentas', it: 'Catena di strumenti', ko: '도구 체인', nl: 'Toolketen', pl: 'Łańcuch narzędzi', tr: 'Araç zinciri', vi: 'Chuỗi công cụ', th: 'สายเครื่องมือ', sv: 'Verktygskedja' },
  Open: { ar: 'فتح', de: 'Öffnen', es: 'Abrir', fr: 'Ouvrir', ru: 'Открыть', zh: '打开', hi: 'खोलें', id: 'Buka', ur: 'کھولیں', ja: '開く', pt: 'Abrir', it: 'Apri', ko: '열기', nl: 'Openen', pl: 'Otwórz', tr: 'Aç', vi: 'Mở', th: 'เปิด', sv: 'Öppna' },
  Generate: { ar: 'إنشاء', de: 'Generieren', es: 'Generar', fr: 'Générer', ru: 'Создать', zh: '生成', hi: 'जनरेट करें', id: 'Buat', ur: 'بنائیں', ja: '生成', pt: 'Gerar', it: 'Genera', ko: '생성', nl: 'Genereren', pl: 'Generuj', tr: 'Oluştur', vi: 'Tạo', th: 'สร้าง', sv: 'Generera' },
  Copy: { ar: 'نسخ', de: 'Kopieren', es: 'Copiar', fr: 'Copier', ru: 'Копировать', zh: '复制', hi: 'कॉपी करें', id: 'Salin', ur: 'کاپی کریں', ja: 'コピー', pt: 'Copiar', it: 'Copia', ko: '복사', nl: 'Kopiëren', pl: 'Kopiuj', tr: 'Kopyala', vi: 'Sao chép', th: 'คัดลอก', sv: 'Kopiera' },
  Clear: { ar: 'مسح', de: 'Löschen', es: 'Borrar', fr: 'Effacer', ru: 'Очистить', zh: '清除', hi: 'साफ़ करें', id: 'Hapus', ur: 'صاف کریں', ja: 'クリア', pt: 'Limpar', it: 'Cancella', ko: '지우기', nl: 'Wissen', pl: 'Wyczyść', tr: 'Temizle', vi: 'Xóa', th: 'ล้าง', sv: 'Rensa' },
  Length: { ar: 'الطول', de: 'Länge', es: 'Longitud', fr: 'Longueur', ru: 'Длина', zh: '长度', hi: 'लंबाई', id: 'Panjang', ur: 'لمبائی', ja: '長さ', pt: 'Comprimento', it: 'Lunghezza', ko: '길이', nl: 'Lengte', pl: 'Długość', tr: 'Uzunluk', vi: 'Độ dài', th: 'ความยาว', sv: 'Längd' },
  'Generate captions': { ar: 'إنشاء التسميات التوضيحية', de: 'Untertitel generieren', es: 'Generar subtítulos', fr: 'Générer les sous-titres', ru: 'Создать субтитры', zh: '生成字幕', hi: 'कैप्शन जनरेट करें', id: 'Buat teks', ur: 'کیپشن بنائیں', ja: '字幕を生成', pt: 'Gerar legendas', it: 'Genera sottotitoli', ko: '자막 생성', nl: 'Ondertitels genereren', pl: 'Generuj napisy', tr: 'Altyazı oluştur', vi: 'Tạo phụ đề', th: 'สร้างคำบรรยาย', sv: 'Skapa undertexter' },
  'Audio file': { ar: 'ملف صوتي', de: 'Audiodatei', es: 'Archivo de audio', fr: 'Fichier audio', ru: 'Аудиофайл', zh: '音频文件', hi: 'ऑडियो फ़ाइल', id: 'File audio', ur: 'آڈیو فائل', ja: '音声ファイル', pt: 'Arquivo de áudio', it: 'File audio', ko: '오디오 파일', nl: 'Audiobestand', pl: 'Plik audio', tr: 'Ses dosyası', vi: 'Tệp âm thanh', th: 'ไฟล์เสียง', sv: 'Ljudfil' },
  'Video file': { ar: 'ملف فيديو', de: 'Videodatei', es: 'Archivo de vídeo', fr: 'Fichier vidéo', ru: 'Видеофайл', zh: '视频文件', hi: 'वीडियो फ़ाइल', id: 'File video', ur: 'ویڈیو فائل', ja: '動画ファイル', pt: 'Arquivo de vídeo', it: 'File video', ko: '비디오 파일', nl: 'Videobestand', pl: 'Plik wideo', tr: 'Video dosyası', vi: 'Tệp video', th: 'ไฟล์วิดีโอ', sv: 'Videofil' },
  'Media file': { ar: 'ملف وسائط', de: 'Mediendatei', es: 'Archivo multimedia', fr: 'Fichier multimédia', ru: 'Медиафайл', zh: '媒体文件', hi: 'मीडिया फ़ाइल', id: 'File media', ur: 'میڈیا فائل', ja: 'メディアファイル', pt: 'Arquivo de mídia', it: 'File multimediale', ko: '미디어 파일', nl: 'Mediabestand', pl: 'Plik multimedialny', tr: 'Medya dosyası', vi: 'Tệp phương tiện', th: 'ไฟล์สื่อ', sv: 'Mediefil' },
  'Compress Audio': { ar: 'ضغط الصوت', de: 'Audio komprimieren', es: 'Comprimir audio', fr: 'Compresser l’audio', ru: 'Сжать аудио', zh: '压缩音频', hi: 'ऑडियो संपीड़ित करें', id: 'Kompres audio', ur: 'آڈیو کمپریس کریں', ja: '音声を圧縮', pt: 'Comprimir áudio', it: 'Comprimi audio', ko: '오디오 압축', nl: 'Audio comprimeren', pl: 'Kompresuj audio', tr: 'Sesi sıkıştır', vi: 'Nén âm thanh', th: 'บีบอัดเสียง', sv: 'Komprimera ljud' },
  'Reduce Noise': { ar: 'تقليل الضوضاء', de: 'Rauschen reduzieren', es: 'Reducir ruido', fr: 'Réduire le bruit', ru: 'Уменьшить шум', zh: '降噪', hi: 'शोर कम करें', id: 'Kurangi noise', ur: 'شور کم کریں', ja: 'ノイズを低減', pt: 'Reduzir ruído', it: 'Riduci rumore', ko: '노이즈 제거', nl: 'Ruis verminderen', pl: 'Redukuj szum', tr: 'Gürültüyü azalt', vi: 'Giảm nhiễu', th: 'ลดเสียงรบกวน', sv: 'Minska brus' },
  'Compress PDF': { ar: 'ضغط PDF', de: 'PDF komprimieren', es: 'Comprimir PDF', fr: 'Compresser le PDF', ru: 'Сжать PDF', zh: '压缩 PDF', hi: 'PDF संपीड़ित करें', id: 'Kompres PDF', ur: 'PDF کمپریس کریں', ja: 'PDFを圧縮', pt: 'Comprimir PDF', it: 'Comprimi PDF', ko: 'PDF 압축', nl: 'PDF comprimeren', pl: 'Kompresuj PDF', tr: 'PDF sıkıştır', vi: 'Nén PDF', th: 'บีบอัด PDF', sv: 'Komprimera PDF' },
  'Extract Text': { ar: 'استخراج النص', de: 'Text extrahieren', es: 'Extraer texto', fr: 'Extraire le texte', ru: 'Извлечь текст', zh: '提取文本', hi: 'टेक्स्ट निकालें', id: 'Ekstrak teks', ur: 'متن نکالیں', ja: 'テキストを抽出', pt: 'Extrair texto', it: 'Estrai testo', ko: '텍스트 추출', nl: 'Tekst extraheren', pl: 'Wyodrębnij tekst', tr: 'Metni çıkar', vi: 'Trích xuất văn bản', th: 'แยกข้อความ', sv: 'Extrahera text' },
  'Text input': { ar: 'إدخال النص', de: 'Texteingabe', es: 'Entrada de texto', fr: 'Saisie de texte', ru: 'Ввод текста', zh: '文本输入', hi: 'टेक्स्ट इनपुट', id: 'Input teks', ur: 'متن ان پٹ', ja: 'テキスト入力', pt: 'Entrada de texto', it: 'Inserimento testo', ko: '텍스트 입력', nl: 'Tekstinvoer', pl: 'Wprowadzanie tekstu', tr: 'Metin girişi', vi: 'Nhập văn bản', th: 'ป้อนข้อความ', sv: 'Textinmatning' },
  'Aspect ratio': { ar: 'نسبة العرض إلى الارتفاع', de: 'Seitenverhältnis', es: 'Relación de aspecto', fr: 'Format d’image', ru: 'Соотношение сторон', zh: '宽高比', hi: 'पहलू अनुपात', id: 'Rasio aspek', ur: 'پہلو تناسب', ja: 'アスペクト比', pt: 'Proporção', it: 'Rapporto d’aspetto', ko: '화면 비율', nl: 'Beeldverhouding', pl: 'Proporcje obrazu', tr: 'En-boy oranı', vi: 'Tỷ lệ khung hình', th: 'อัตราส่วนภาพ', sv: 'Bildförhållande' },
  Width: { ar: 'العرض', de: 'Breite', es: 'Ancho', fr: 'Largeur', ru: 'Ширина', zh: '宽度', hi: 'चौड़ाई', id: 'Lebar', ur: 'چوڑائی', ja: '幅', pt: 'Largura', it: 'Larghezza', ko: '너비', nl: 'Breedte', pl: 'Szerokość', tr: 'Genişlik', vi: 'Chiều rộng', th: 'ความกว้าง', sv: 'Bredd' },
  Height: { ar: 'الارتفاع', de: 'Höhe', es: 'Altura', fr: 'Hauteur', ru: 'Высота', zh: '高度', hi: 'ऊंचाई', id: 'Tinggi', ur: 'اونچائی', ja: '高さ', pt: 'Altura', it: 'Altezza', ko: '높이', nl: 'Hoogte', pl: 'Wysokość', tr: 'Yükseklik', vi: 'Chiều cao', th: 'ความสูง', sv: 'Höjd' },
  'Aspect preview': { ar: 'معاينة النسبة', de: 'Seitenverhältnis-Vorschau', es: 'Vista previa de proporción', fr: 'Aperçu du format', ru: 'Предпросмотр соотношения', zh: '宽高比预览', hi: 'पहलू अनुपात पूर्वावलोकन', id: 'Pratinjau rasio', ur: 'پہلو تناسب پیش منظر', ja: 'アスペクト比プレビュー', pt: 'Pré-visualização da proporção', it: 'Anteprima rapporto', ko: '화면 비율 미리보기', nl: 'Voorbeeld beeldverhouding', pl: 'Podgląd proporcji', tr: 'En-boy oranı önizlemesi', vi: 'Xem trước tỷ lệ', th: 'ตัวอย่างอัตราส่วน', sv: 'Förhandsvisning av bildförhållande' },
  'Start time': { ar: 'وقت البدء', de: 'Startzeit', es: 'Hora de inicio', fr: 'Heure de début', ru: 'Время начала', zh: '开始时间', hi: 'प्रारंभ समय', id: 'Waktu mulai', ur: 'شروع کا وقت', ja: '開始時間', pt: 'Hora de início', it: 'Ora di inizio', ko: '시작 시간', nl: 'Starttijd', pl: 'Czas rozpoczęcia', tr: 'Başlangıç zamanı', vi: 'Thời gian bắt đầu', th: 'เวลาเริ่มต้น', sv: 'Starttid' },
  'End time': { ar: 'وقت الانتهاء', de: 'Endzeit', es: 'Hora de finalización', fr: 'Heure de fin', ru: 'Время окончания', zh: '结束时间', hi: 'समाप्ति समय', id: 'Waktu selesai', ur: 'اختتام کا وقت', ja: '終了時間', pt: 'Hora de término', it: 'Ora di fine', ko: '종료 시간', nl: 'Eindtijd', pl: 'Czas zakończenia', tr: 'Bitiş zamanı', vi: 'Thời gian kết thúc', th: 'เวลาสิ้นสุด', sv: 'Sluttid' },
  'Export WAV clip': { ar: 'تصدير مقطع WAV', de: 'WAV-Clip exportieren', es: 'Exportar clip WAV', fr: 'Exporter le clip WAV', ru: 'Экспортировать фрагмент WAV', zh: '导出 WAV 片段', hi: 'WAV क्लिप निर्यात करें', id: 'Ekspor klip WAV', ur: 'WAV کلپ برآمد کریں', ja: 'WAVクリップをエクスポート', pt: 'Exportar clipe WAV', it: 'Esporta clip WAV', ko: 'WAV 클립 내보내기', nl: 'WAV-clip exporteren', pl: 'Eksportuj klip WAV', tr: 'WAV klibini dışa aktar', vi: 'Xuất đoạn WAV', th: 'ส่งออกคลิป WAV', sv: 'Exportera WAV-klipp' },
  'WebGPU WASM CPU': { ar: 'WebGPU · WASM · CPU', de: 'WebGPU · WASM · CPU', es: 'WebGPU · WASM · CPU', fr: 'WebGPU · WASM · CPU', ru: 'WebGPU · WASM · CPU', zh: 'WebGPU · WASM · CPU', hi: 'WebGPU · WASM · CPU', id: 'WebGPU · WASM · CPU', ur: 'WebGPU · WASM · CPU', ja: 'WebGPU · WASM · CPU', pt: 'WebGPU · WASM · CPU', it: 'WebGPU · WASM · CPU', ko: 'WebGPU · WASM · CPU', nl: 'WebGPU · WASM · CPU', pl: 'WebGPU · WASM · CPU', tr: 'WebGPU · WASM · CPU', vi: 'WebGPU · WASM · CPU', th: 'WebGPU · WASM · CPU', sv: 'WebGPU · WASM · CPU' },
};

const PREFIXES: ReadonlyArray<readonly [string, LocaleMap]> = [
  ['Width: ', UI.Width],
  ['Height: ', UI.Height],
  ['Ratio: ', { ar: 'النسبة: ', de: 'Verhältnis: ', es: 'Relación: ', fr: 'Rapport : ', ru: 'Соотношение: ', zh: '比例：', hi: 'अनुपात: ', id: 'Rasio: ', ur: 'تناسب: ', ja: '比率: ', pt: 'Proporção: ', it: 'Rapporto: ', ko: '비율: ', nl: 'Verhouding: ', pl: 'Proporcja: ', tr: 'Oran: ', vi: 'Tỷ lệ: ', th: 'อัตราส่วน: ', sv: 'Förhållande: ' }],
];

function translateText(locale: Locale, value: string): string {
  if (locale === 'en') return value;
  const exact = UI[value.trim()]?.[locale];
  if (exact) return value.replace(value.trim(), exact);
  const toolChain = value.match(/^Tool Chain (\d+)\/(\d+) steps Open$/);
  if (toolChain) {
    const [, completed, total] = toolChain;
    const open = UI.Open?.[locale] ?? 'Open';
    const chain = UI['Tool Chain']?.[locale] ?? 'Tool Chain';
    const steps: Partial<Record<Locale, string>> = { ar: 'خطوات', de: 'Schritte', es: 'pasos', fr: 'étapes', ru: 'шагов', zh: '步骤', hi: 'चरण', ja: 'ステップ', ko: '단계', pt: 'etapas', it: 'passaggi', nl: 'stappen', pl: 'kroków', tr: 'adım', vi: 'bước', th: 'ขั้นตอน', sv: 'steg', id: 'langkah', ur: 'مراحل' };
    return `${chain} ${completed}/${total} ${steps[locale] ?? 'steps'} ${open}`;
  }
  for (const [prefix, map] of PREFIXES) if (value.startsWith(prefix)) return `${map[locale] ?? prefix}${value.slice(prefix.length)}`;
  return value;
}

function translateRoot(root: ParentNode, locale: Locale): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!node.nodeValue?.trim() || !parent || parent.closest('script,style,pre,textarea,[contenteditable="true"],[data-no-auto-i18n]')) continue;
    nodes.push(node);
  }
  for (const node of nodes) {
    const next = translateText(locale, node.nodeValue ?? '');
    if (next !== node.nodeValue) node.nodeValue = next;
  }
  root.querySelectorAll?.<HTMLElement>('[aria-label],[title],[placeholder]')?.forEach((element) => {
    if (element.matches('[data-no-auto-i18n]')) return;
    for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const next = translateText(locale, value);
      if (next !== value) element.setAttribute(attribute, next);
    }
  });
}

export function installToolUiRuntimeLocalization(): () => void {
  if (typeof document === 'undefined' || !document.body) return () => undefined;
  const apply = () => {
    const locale = (document.documentElement.lang.split('-')[0] || 'en') as Locale;
    if (locale !== 'en') translateRoot(document.body, locale);
  };
  apply();
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });
  return () => observer.disconnect();
}
