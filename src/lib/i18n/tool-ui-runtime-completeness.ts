import { LOCALES, normalizeLocale, type CanonicalLocale } from './config';
import { getLocalizedToolTitle } from '../seo/tool-seo';
import { getToolConfig } from '../../config/tools';

type LocaleMap = Partial<Record<CanonicalLocale, string>>;

const UI: Record<string, LocaleMap> = {
  'Local processing': { ar: 'معالجة محلية', es: 'Procesamiento local', fr: 'Traitement local', de: 'Lokale Verarbeitung', hi: 'स्थानीय प्रोसेसिंग', id: 'Pemrosesan lokal', it: 'Elaborazione locale', ja: 'ローカル処理', ko: '로컬 처리', ms: 'Pemprosesan setempat', nl: 'Lokale verwerking', pl: 'Przetwarzanie lokalne', pt: 'Processamento local', ru: 'Локальная обработка', sv: 'Lokal bearbetning', th: 'การประมวลผลในเครื่อง', tr: 'Yerel işleme', uk: 'Локальна обробка', vi: 'Xử lý cục bộ' },
  'Choose a file': { ar: 'اختر ملفًا', es: 'Elige un archivo', fr: 'Choisissez un fichier', de: 'Datei auswählen', hi: 'फ़ाइल चुनें', id: 'Pilih file', it: 'Scegli un file', ja: 'ファイルを選択', ko: '파일 선택', ms: 'Pilih fail', nl: 'Kies een bestand', pl: 'Wybierz plik', pt: 'Escolha um ficheiro', ru: 'Выберите файл', sv: 'Välj en fil', th: 'เลือกไฟล์', tr: 'Bir dosya seçin', uk: 'Виберіть файл', vi: 'Chọn tệp' },
  'Select PDF': { ar: 'اختر ملف PDF', es: 'Selecciona un PDF', fr: 'Sélectionnez un PDF', de: 'PDF auswählen', hi: 'PDF चुनें', id: 'Pilih PDF', it: 'Seleziona PDF', ja: 'PDFを選択', ko: 'PDF 선택', ms: 'Pilih PDF', nl: 'Selecteer PDF', pl: 'Wybierz PDF', pt: 'Selecione PDF', ru: 'Выберите PDF', sv: 'Välj PDF', th: 'เลือก PDF', tr: 'PDF seçin', uk: 'Виберіть PDF', vi: 'Chọn PDF' },
  YAML: { ar: 'YAML', es: 'YAML', fr: 'YAML', de: 'YAML', hi: 'YAML', id: 'YAML', it: 'YAML', ja: 'YAML', ko: 'YAML', ms: 'YAML', nl: 'YAML', pl: 'YAML', pt: 'YAML', ru: 'YAML', sv: 'YAML', th: 'YAML', tr: 'YAML', uk: 'YAML', vi: 'YAML' },
  Optional: { ar: 'اختياري', es: 'Opcional', fr: 'Facultatif', de: 'Optional', hi: 'वैकल्पिक', id: 'Opsional', it: 'Opzionale', ja: '任意', ko: '선택 사항', ms: 'Pilihan', nl: 'Optioneel', pl: 'Opcjonalne', pt: 'Opcional', ru: 'Необязательно', sv: 'Valfritt', th: 'ไม่บังคับ', tr: 'İsteğe bağlı', uk: 'Необов’язково', vi: 'Tùy chọn' },
  'Run tool': { ar: 'تشغيل الأداة', es: 'Ejecutar herramienta', fr: 'Exécuter l’outil', de: 'Tool ausführen', hi: 'टूल चलाएँ', id: 'Jalankan alat', it: 'Esegui lo strumento', ja: 'ツールを実行', ko: '도구 실행', ms: 'Jalankan alat', nl: 'Tool uitvoeren', pl: 'Uruchom narzędzie', pt: 'Executar ferramenta', ru: 'Запустить инструмент', sv: 'Kör verktyget', th: 'เรียกใช้เครื่องมือ', tr: 'Aracı çalıştır', uk: 'Запустити інструмент', vi: 'Chạy công cụ' },
  'Compress image': { ar: 'ضغط الصورة', es: 'Comprimir imagen', fr: 'Compresser l’image', de: 'Bild komprimieren', hi: 'छवि संपीड़ित करें', id: 'Kompres gambar', it: 'Comprimi immagine', ja: '画像を圧縮', ko: '이미지 압축', ms: 'Mampatkan imej', nl: 'Afbeelding comprimeren', pl: 'Kompresuj obraz', pt: 'Comprimir imagem', ru: 'Сжать изображение', sv: 'Komprimera bilden', th: 'บีบอัดรูปภาพ', tr: 'Görseli sıkıştır', uk: 'Стиснути зображення', vi: 'Nén hình ảnh' },
  'Compress all to ZIP': { ar: 'ضغط الكل إلى ZIP', es: 'Comprimir todo en ZIP', fr: 'Tout compresser en ZIP', de: 'Alles als ZIP komprimieren', hi: 'सबको ZIP में संपीड़ित करें', id: 'Kompres semua ke ZIP', it: 'Comprimi tutto in ZIP', ja: 'すべてをZIPに圧縮', ko: '모두 ZIP으로 압축', ms: 'Mampatkan semua ke ZIP', nl: 'Alles naar ZIP comprimeren', pl: 'Skompresuj wszystko do ZIP', pt: 'Comprimir tudo em ZIP', ru: 'Сжать всё в ZIP', sv: 'Komprimera allt till ZIP', th: 'บีบอัดทั้งหมดเป็น ZIP', tr: 'Tümünü ZIP olarak sıkıştır', uk: 'Стиснути все в ZIP', vi: 'Nén tất cả thành ZIP' },
  'Top text': { ar: 'النص العلوي', es: 'Texto superior', fr: 'Texte supérieur', de: 'Oberer Text', hi: 'ऊपरी टेक्स्ट', id: 'Teks atas', it: 'Testo superiore', ja: '上部テキスト', ko: '상단 텍스트', ms: 'Teks atas', nl: 'Bovenste tekst', pl: 'Tekst górny', pt: 'Texto superior', ru: 'Верхний текст', sv: 'Övre text', th: 'ข้อความด้านบน', tr: 'Üst metin', uk: 'Верхній текст', vi: 'Văn bản trên' },
  'Bottom text': { ar: 'النص السفلي', es: 'Texto inferior', fr: 'Texte inférieur', de: 'Unterer Text', hi: 'नीचे का टेक्स्ट', id: 'Teks bawah', it: 'Testo inferiore', ja: '下部テキスト', ko: '하단 텍스트', ms: 'Teks bawah', nl: 'Onderste tekst', pl: 'Tekst dolny', pt: 'Texto inferior', ru: 'Нижний текст', sv: 'Nedre text', th: 'ข้อความด้านล่าง', tr: 'Alt metin', uk: 'Нижній текст', vi: 'Văn bản dưới' },
  'Watermark text': { ar: 'نص العلامة المائية', es: 'Texto de marca de agua', fr: 'Texte du filigrane', de: 'Wasserzeichentext', hi: 'वॉटरमार्क टेक्स्ट', id: 'Teks tanda air', it: 'Testo filigrana', ja: '透かしテキスト', ko: '워터마크 텍스트', ms: 'Teks tera air', nl: 'Watermerktekst', pl: 'Tekst znaku wodnego', pt: 'Texto da marca d’água', ru: 'Текст водяного знака', sv: 'Vattenstämpeltext', th: 'ข้อความลายน้ำ', tr: 'Filigran metni', uk: 'Текст водяного знака', vi: 'Văn bản hình mờ' },
  'Regex pattern': { ar: 'نمط Regex', es: 'Patrón Regex', fr: 'Motif Regex', de: 'Regex-Muster', hi: 'Regex पैटर्न', id: 'Pola Regex', it: 'Pattern Regex', ja: 'Regexパターン', ko: '정규식 패턴', ms: 'Corak Regex', nl: 'Regex-patroon', pl: 'Wzorzec Regex', pt: 'Padrão Regex', ru: 'Шаблон Regex', sv: 'Regex-mönster', th: 'รูปแบบ Regex', tr: 'Regex deseni', uk: 'Шаблон Regex', vi: 'Mẫu Regex' },
  'Regex input': { ar: 'إدخال Regex', es: 'Entrada Regex', fr: 'Entrée Regex', de: 'Regex-Eingabe', hi: 'Regex इनपुट', id: 'Input Regex', it: 'Input Regex', ja: 'Regex入力', ko: '정규식 입력', ms: 'Input Regex', nl: 'Regex-invoer', pl: 'Wejście Regex', pt: 'Entrada Regex', ru: 'Ввод Regex', sv: 'Regex-inmatning', th: 'อินพุต Regex', tr: 'Regex girişi', uk: 'Введення Regex', vi: 'Đầu vào Regex' },
  'Original text': { ar: 'النص الأصلي', es: 'Texto original', fr: 'Texte original', de: 'Originaltext', hi: 'मूल टेक्स्ट', id: 'Teks asli', it: 'Testo originale', ja: '元のテキスト', ko: '원본 텍스트', ms: 'Teks asal', nl: 'Originele tekst', pl: 'Tekst oryginalny', pt: 'Texto original', ru: 'Исходный текст', sv: 'Originaltext', th: 'ข้อความต้นฉบับ', tr: 'Özgün metin', uk: 'Оригінальний текст', vi: 'Văn bản gốc' },
  'Modified text': { ar: 'النص المعدّل', es: 'Texto modificado', fr: 'Texte modifié', de: 'Geänderter Text', hi: 'संशोधित टेक्स्ट', id: 'Teks yang diubah', it: 'Testo modificato', ja: '変更後のテキスト', ko: '수정된 텍스트', ms: 'Teks diubah suai', nl: 'Aangepaste tekst', pl: 'Zmodyfikowany tekst', pt: 'Texto modificado', ru: 'Изменённый текст', sv: 'Ändrad text', th: 'ข้อความที่แก้ไข', tr: 'Değiştirilmiş metin', uk: 'Змінений текст', vi: 'Văn bản đã sửa' },
  'Copy summary': { ar: 'نسخ الملخص', es: 'Copiar resumen', fr: 'Copier le résumé', de: 'Zusammenfassung kopieren', hi: 'सारांश कॉपी करें', id: 'Salin ringkasan', it: 'Copia riepilogo', ja: '概要をコピー', ko: '요약 복사', ms: 'Salin ringkasan', nl: 'Samenvatting kopiëren', pl: 'Kopiuj podsumowanie', pt: 'Copiar resumo', ru: 'Копировать сводку', sv: 'Kopiera sammanfattning', th: 'คัดลอกสรุป', tr: 'Özeti kopyala', uk: 'Копіювати підсумок', vi: 'Sao chép tóm tắt' },
  'Inline diff': { ar: 'الفروقات المضمنة', es: 'Diferencias en línea', fr: 'Diff en ligne', de: 'Inline-Diff', hi: 'इनलाइन डिफ', id: 'Diff sebaris', it: 'Diff inline', ja: 'インライン差分', ko: '인라인 비교', ms: 'Perbezaan sebaris', nl: 'Inline-diff', pl: 'Różnice w tekście', pt: 'Diferença em linha', ru: 'Встроенные различия', sv: 'Inline-diff', th: 'ความแตกต่างแบบอินไลน์', tr: 'Satır içi fark', uk: 'Вбудовані відмінності', vi: 'So sánh nội dòng' },
  Inline: { ar: 'مضمن', es: 'En línea', fr: 'En ligne', de: 'Inline', hi: 'इनलाइन', id: 'Sebaris', it: 'In linea', ja: 'インライン', ko: '인라인', ms: 'Sebaris', nl: 'Inline', pl: 'W tekście', pt: 'Em linha', ru: 'Встроенный', sv: 'Inline', th: 'อินไลน์', tr: 'Satır içi', uk: 'Вбудовано', vi: 'Nội dòng' },
  'Side-by-side': { ar: 'جنبًا إلى جنب', es: 'Lado a lado', fr: 'Côte à côte', de: 'Nebeneinander', hi: 'साथ-साथ', id: 'Berdampingan', it: 'Affiancato', ja: '左右比較', ko: '나란히', ms: 'Sebelah menyebelah', nl: 'Naast elkaar', pl: 'Obok siebie', pt: 'Lado a lado', ru: 'Рядом', sv: 'Sida vid sida', th: 'เคียงข้างกัน', tr: 'Yan yana', uk: 'Поруч', vi: 'Song song' },
  Compare: { ar: 'مقارنة', es: 'Comparar', fr: 'Comparer', de: 'Vergleichen', hi: 'तुलना करें', id: 'Bandingkan', it: 'Confronta', ja: '比較', ko: '비교', ms: 'Bandingkan', nl: 'Vergelijken', pl: 'Porównaj', pt: 'Comparar', ru: 'Сравнить', sv: 'Jämför', th: 'เปรียบเทียบ', tr: 'Karşılaştır', uk: 'Порівняти', vi: 'So sánh' },
  'Copy text': { ar: 'نسخ النص', es: 'Copiar texto', fr: 'Copier le texte', de: 'Text kopieren', hi: 'टेक्स्ट कॉपी करें', id: 'Salin teks', it: 'Copia testo', ja: 'テキストをコピー', ko: '텍스트 복사', ms: 'Salin teks', nl: 'Tekst kopiëren', pl: 'Kopiuj tekst', pt: 'Copiar texto', ru: 'Копировать текст', sv: 'Kopiera text', th: 'คัดลอกข้อความ', tr: 'Metni kopyala', uk: 'Копіювати текст', vi: 'Sao chép văn bản' },
  'Generate QR': { ar: 'إنشاء QR', es: 'Generar QR', fr: 'Générer un QR', de: 'QR erstellen', hi: 'QR जनरेट करें', id: 'Buat QR', it: 'Genera QR', ja: 'QRを生成', ko: 'QR 생성', ms: 'Jana QR', nl: 'QR genereren', pl: 'Generuj QR', pt: 'Gerar QR', ru: 'Создать QR', sv: 'Skapa QR', th: 'สร้าง QR', tr: 'QR oluştur', uk: 'Створити QR', vi: 'Tạo QR' },
  'Choose QR image': { ar: 'اختر صورة QR', es: 'Elige una imagen QR', fr: 'Choisissez une image QR', de: 'QR-Bild auswählen', hi: 'QR छवि चुनें', id: 'Pilih gambar QR', it: 'Scegli immagine QR', ja: 'QR画像を選択', ko: 'QR 이미지 선택', ms: 'Pilih imej QR', nl: 'Kies QR-afbeelding', pl: 'Wybierz obraz QR', pt: 'Escolha uma imagem QR', ru: 'Выберите изображение QR', sv: 'Välj QR-bild', th: 'เลือกภาพ QR', tr: 'QR görseli seç', uk: 'Виберіть зображення QR', vi: 'Chọn ảnh QR' },
  'Foreground color': { ar: 'لون المقدمة', es: 'Color de primer plano', fr: 'Couleur de premier plan', de: 'Vordergrundfarbe', hi: 'अग्रभूमि रंग', id: 'Warna latar depan', it: 'Colore di primo piano', ja: '前景色', ko: '전경색', ms: 'Warna latar depan', nl: 'Voorgrondkleur', pl: 'Kolor pierwszoplanowy', pt: 'Cor do primeiro plano', ru: 'Цвет переднего плана', sv: 'Förgrundsfärg', th: 'สีพื้นหน้า', tr: 'Ön plan rengi', uk: 'Колір переднього плану', vi: 'Màu tiền cảnh' },
  'Background color': { ar: 'لون الخلفية', es: 'Color de fondo', fr: 'Couleur d’arrière-plan', de: 'Hintergrundfarbe', hi: 'पृष्ठभूमि रंग', id: 'Warna latar belakang', it: 'Colore di sfondo', ja: '背景色', ko: '배경색', ms: 'Warna latar belakang', nl: 'Achtergrondkleur', pl: 'Kolor tła', pt: 'Cor de fundo', ru: 'Цвет фона', sv: 'Bakgrundsfärg', th: 'สีพื้นหลัง', tr: 'Arka plan rengi', uk: 'Колір фону', vi: 'Màu nền' },
  'Protect PDF': { ar: 'حماية PDF', es: 'Proteger PDF', fr: 'Protéger le PDF', de: 'PDF schützen', hi: 'PDF सुरक्षित करें', id: 'Lindungi PDF', it: 'Proteggi PDF', ja: 'PDFを保護', ko: 'PDF 보호', ms: 'Lindungi PDF', nl: 'PDF beveiligen', pl: 'Chroń PDF', pt: 'Proteger PDF', ru: 'Защитить PDF', sv: 'Skydda PDF', th: 'ปกป้อง PDF', tr: 'PDF’yi koru', uk: 'Захистити PDF', vi: 'Bảo vệ PDF' },
  'Export clip': { ar: 'تصدير المقطع', es: 'Exportar clip', fr: 'Exporter le clip', de: 'Clip exportieren', hi: 'क्लिप निर्यात करें', id: 'Ekspor klip', it: 'Esporta clip', ja: 'クリップを書き出す', ko: '클립 내보내기', ms: 'Eksport klip', nl: 'Clip exporteren', pl: 'Eksportuj klip', pt: 'Exportar clipe', ru: 'Экспортировать клип', sv: 'Exportera klipp', th: 'ส่งออกคลิป', tr: 'Klibi dışa aktar', uk: 'Експортувати кліп', vi: 'Xuất clip' },
  'Export PNG': { ar: 'تصدير PNG', es: 'Exportar PNG', fr: 'Exporter PNG', de: 'PNG exportieren', hi: 'PNG निर्यात करें', id: 'Ekspor PNG', it: 'Esporta PNG', ja: 'PNGを書き出す', ko: 'PNG 내보내기', ms: 'Eksport PNG', nl: 'PNG exporteren', pl: 'Eksportuj PNG', pt: 'Exportar PNG', ru: 'Экспорт PNG', sv: 'Exportera PNG', th: 'ส่งออก PNG', tr: 'PNG dışa aktar', uk: 'Експортувати PNG', vi: 'Xuất PNG' },
  Undo: { ar: 'تراجع', es: 'Deshacer', fr: 'Annuler', de: 'Rückgängig', hi: 'पूर्ववत करें', id: 'Urungkan', it: 'Annulla', ja: '元に戻す', ko: '실행 취소', ms: 'Buat asal', nl: 'Ongedaan maken', pl: 'Cofnij', pt: 'Desfazer', ru: 'Отменить', sv: 'Ångra', th: 'เลิกทำ', tr: 'Geri al', uk: 'Скасувати', vi: 'Hoàn tác' },
  Redo: { ar: 'إعادة', es: 'Rehacer', fr: 'Rétablir', de: 'Wiederholen', hi: 'फिर से करें', id: 'Ulangi', it: 'Ripristina', ja: 'やり直す', ko: '다시 실행', ms: 'Buat semula', nl: 'Opnieuw uitvoeren', pl: 'Ponów', pt: 'Refazer', ru: 'Повторить', sv: 'Gör om', th: 'ทำซ้ำ', tr: 'Yinele', uk: 'Повторити', vi: 'Làm lại' },
  'Compress / Convert': { ar: 'ضغط / تحويل', es: 'Comprimir / Convertir', fr: 'Compresser / Convertir', de: 'Komprimieren / Konvertieren', hi: 'संपीड़ित / कनवर्ट करें', id: 'Kompres / Konversi', it: 'Comprimi / Converti', ja: '圧縮 / 変換', ko: '압축 / 변환', ms: 'Mampat / Tukar', nl: 'Comprimeren / Converteren', pl: 'Kompresuj / Konwertuj', pt: 'Comprimir / Converter', ru: 'Сжать / Конвертировать', sv: 'Komprimera / Konvertera', th: 'บีบอัด / แปลง', tr: 'Sıkıştır / Dönüştür', uk: 'Стиснути / Конвертувати', vi: 'Nén / Chuyển đổi' },
  Auto: { ar: 'تلقائي', es: 'Automático', fr: 'Automatique', de: 'Automatisch', hi: 'स्वचालित', id: 'Otomatis', it: 'Automatico', ja: '自動', ko: '자동', ms: 'Automatik', nl: 'Automatisch', pl: 'Automatycznie', pt: 'Automático', ru: 'Авто', sv: 'Automatiskt', th: 'อัตโนมัติ', tr: 'Otomatik', uk: 'Автоматично', vi: 'Tự động' },
  'Zoom Out Canvas': { ar: 'تصغير اللوحة', es: 'Alejar lienzo', fr: 'Dézoomer le canevas', de: 'Leinwand verkleinern', hi: 'कैनवास ज़ूम आउट', id: 'Perkecil kanvas', it: 'Riduci zoom tela', ja: 'キャンバスを縮小', ko: '캔버스 축소', ms: 'Zum keluar kanvas', nl: 'Canvas uitzoomen', pl: 'Pomniejsz płótno', pt: 'Reduzir zoom da tela', ru: 'Уменьшить масштаб холста', sv: 'Zooma ut canvas', th: 'ซูมออกแคนวาส', tr: 'Tuvali uzaklaştır', uk: 'Зменшити масштаб полотна', vi: 'Thu nhỏ canvas' },
  'Zoom In Canvas': { ar: 'تكبير اللوحة', es: 'Acercar lienzo', fr: 'Zoomer le canevas', de: 'Leinwand vergrößern', hi: 'कैनवास ज़ूम इन', id: 'Perbesar kanvas', it: 'Aumenta zoom tela', ja: 'キャンバスを拡大', ko: '캔버스 확대', ms: 'Zum masuk kanvas', nl: 'Canvas inzoomen', pl: 'Powiększ płótno', pt: 'Aumentar zoom da tela', ru: 'Увеличить масштаб холста', sv: 'Zooma in canvas', th: 'ซูมเข้าแคนวาส', tr: 'Tuvali yakınlaştır', uk: 'Збільшити масштаб полотна', vi: 'Phóng to canvas' },
};

const translated = (locale: CanonicalLocale, value: string): string => {
  const trimmed = value.trim();
  const exact = UI[trimmed]?.[locale];
  if (exact) return value.replace(trimmed, exact);
  const localProcessing = value.match(/^● Local processing Inputs for (.+) are processed in your browser when supported by the tool\.?$/u);
  if (localProcessing) {
    const [, title] = localProcessing;
    const tool = [...LOCALES].map((code) => ({ code, value: getLocalizedToolTitle(code, toolIdFromDocument(), title) })).find((entry) => entry.code === locale)?.value ?? title;
    const prefix: Record<CanonicalLocale, string> = {
      ar: '● معالجة محلية تتم معالجة مدخلات ', en: '● Local processing Inputs for ', es: '● Procesamiento local Las entradas de ', fr: '● Traitement local Les entrées de ', de: '● Lokale Verarbeitung Eingaben von ', hi: '● स्थानीय प्रोसेसिंग ', id: '● Pemrosesan lokal Input ', it: '● Elaborazione locale Gli input di ', ja: '● ローカル処理 ', ko: '● 로컬 처리 ', ms: '● Pemprosesan setempat Input ', nl: '● Lokale verwerking Invoer van ', pl: '● Przetwarzanie lokalne Dane wejściowe ', pt: '● Processamento local As entradas de ', ru: '● Локальная обработка Входные данные ', sv: '● Lokal bearbetning Indata från ', th: '● การประมวลผลในเครื่อง อินพุตของ ', tr: '● Yerel işleme ', uk: '● Локальна обробка Вхідні дані ', vi: '● Xử lý cục bộ Dữ liệu đầu vào của ',
    };
    const suffix: Record<CanonicalLocale, string> = {
      ar: ' تُعالج في متصفحك عند دعم الأداة.', en: ' are processed in your browser when supported by the tool.', es: ' se procesan en tu navegador cuando la herramienta lo admite.', fr: ' sont traitées dans votre navigateur lorsque l’outil le permet.', de: ' werden in Ihrem Browser verarbeitet, sofern das Tool dies unterstützt.', hi: 'को आपके ब्राउज़र में संसाधित किया जाता है जब टूल इसका समर्थन करता है।', id: 'diproses di browser Anda saat alat mendukungnya.', it: ' vengono elaborati nel browser quando lo strumento lo supporta.', ja: 'はツールが対応している場合、ブラウザ内で処理されます。', ko: '은 도구가 지원하는 경우 브라우저에서 처리됩니다.', ms: ' diproses dalam pelayar apabila alat menyokongnya.', nl: ' worden in je browser verwerkt wanneer de tool dit ondersteunt.', pl: ' są przetwarzane w przeglądarce, gdy narzędzie to obsługuje.', pt: ' são processadas no navegador quando a ferramenta oferece suporte.', ru: ' обрабатываются в браузере, если инструмент это поддерживает.', sv: ' bearbetas i webbläsaren när verktyget stöder det.', th: 'จะถูกประมวลผลในเบราว์เซอร์เมื่อเครื่องมือรองรับ', tr: ' araç desteklediğinde tarayıcınızda işlenir.', uk: ' обробляються у браузері, якщо інструмент це підтримує.', vi: ' được xử lý trong trình duyệt khi công cụ hỗ trợ.',
    };
    if (locale === 'hi') return `● ${UI['Local processing']?.[locale]} ${tool} का इनपुट समर्थित होने पर ब्राउज़र में संसाधित किया जाता है।`;
    if (locale === 'ja') return `● ${UI['Local processing']?.[locale]} ${tool} の入力は、ツールが対応している場合、ブラウザ内で処理されます。`;
    if (locale === 'ko') return `● ${UI['Local processing']?.[locale]} ${tool} 입력은 도구가 지원하는 경우 브라우저에서 처리됩니다.`;
    return `${prefix[locale]}${tool}${suffix[locale]}`;
  }

  const chain = value.match(/^Tool Chain (\d+)\/(\d+) steps Open$/u);
  if (chain) {
    const [, current, total] = chain;
    const words: Record<CanonicalLocale, string> = { ar: 'سلسلة الأدوات', en: 'Tool Chain', es: 'Cadena de herramientas', fr: 'Chaîne d’outils', de: 'Werkzeugkette', hi: 'टूल चेन', id: 'Rangkaian alat', it: 'Catena di strumenti', ja: 'ツールチェーン', ko: '도구 체인', ms: 'Siri alat', nl: 'Toolketen', pl: 'Łańcuch narzędzi', pt: 'Cadeia de ferramentas', ru: 'Цепочка инструментов', sv: 'Verktygskedja', th: 'สายเครื่องมือ', tr: 'Araç zinciri', uk: 'Ланцюг інструментів', vi: 'Chuỗi công cụ' };
    const steps: Record<CanonicalLocale, string> = { ar: 'خطوة', en: 'steps', es: 'pasos', fr: 'étapes', de: 'Schritte', hi: 'चरण', id: 'langkah', it: 'passaggi', ja: 'ステップ', ko: '단계', ms: 'langkah', nl: 'stappen', pl: 'kroków', pt: 'etapas', ru: 'шагов', sv: 'steg', th: 'ขั้นตอน', tr: 'adım', uk: 'кроків', vi: 'bước' };
    return `${words[locale]} ${current}/${total} ${steps[locale]} ${UI.Open?.[locale] ?? 'Open'}`;
  }

  const metrics = value.match(/^Words (\d+) Characters (\d+) Characters without spaces (\d+) Sentences (\d+) Paragraphs (\d+) Reading minutes (\d+) Speaking minutes (\d+)$/u);
  if (metrics) {
    const [, words, chars, noSpaces, sentences, paragraphs, reading, speaking] = metrics;
    const t: Record<CanonicalLocale, string[]> = {
      ar: ['كلمات','أحرف','أحرف بدون مسافات','جمل','فقرات','دقائق قراءة','دقائق تحدث'], es: ['Palabras','Caracteres','Caracteres sin espacios','Oraciones','Párrafos','Minutos de lectura','Minutos de habla'], fr: ['Mots','Caractères','Caractères sans espaces','Phrases','Paragraphes','Minutes de lecture','Minutes de parole'], de: ['Wörter','Zeichen','Zeichen ohne Leerzeichen','Sätze','Absätze','Leseminuten','Sprechminuten'], hi: ['शब्द','अक्षर','बिना स्पेस अक्षर','वाक्य','अनुच्छेद','पढ़ने के मिनट','बोलने के मिनट'], id: ['Kata','Karakter','Karakter tanpa spasi','Kalimat','Paragraf','Menit membaca','Menit berbicara'], it: ['Parole','Caratteri','Caratteri senza spazi','Frasi','Paragrafi','Minuti di lettura','Minuti di conversazione'], ja: ['単語','文字','空白なしの文字','文','段落','読書分数','発話分数'], ko: ['단어','문자','공백 제외 문자','문장','문단','읽기 분','말하기 분'], ms: ['Perkataan','Aksara','Aksara tanpa ruang','Ayat','Perenggan','Minit membaca','Minit bercakap'], nl: ['Woorden','Tekens','Tekens zonder spaties','Zinnen','Alinea’s','Leesminuten','Spreekminuten'], pl: ['Słowa','Znaki','Znaki bez spacji','Zdania','Akapity','Minuty czytania','Minuty mówienia'], pt: ['Palavras','Caracteres','Caracteres sem espaços','Frases','Parágrafos','Minutos de leitura','Minutos de fala'], ru: ['Слова','Символы','Символы без пробелов','Предложения','Абзацы','Минуты чтения','Минуты речи'], sv: ['Ord','Tecken','Tecken utan mellanslag','Meningar','Stycken','Lästid','Taltid'], th: ['คำ','อักขระ','อักขระไม่รวมช่องว่าง','ประโยค','ย่อหน้า','นาทีการอ่าน','นาทีการพูด'], tr: ['Kelime','Karakter','Boşluksuz karakter','Cümle','Paragraf','Okuma dakikası','Konuşma dakikası'], uk: ['Слова','Символи','Символи без пробілів','Речення','Абзаци','Хвилини читання','Хвилини мовлення'], vi: ['Từ','Ký tự','Ký tự không có khoảng trắng','Câu','Đoạn văn','Phút đọc','Phút nói'], en: ['Words','Characters','Characters without spaces','Sentences','Paragraphs','Reading minutes','Speaking minutes'] };
    const a=t[locale]; return `${a[0]} ${words} ${a[1]} ${chars} ${a[2]} ${noSpaces} ${a[3]} ${sentences} ${a[4]} ${paragraphs} ${a[5]} ${reading} ${a[6]} ${speaking}`;
  }

  const caseMode = value.match(/^Characters (\d+) Words (\d+) Mode (UPPERCASE|lowercase|Title Case|Sentence case|camelCase|PascalCase|snake_case|kebab-case|CONSTANT_CASE)$/u);
  if (caseMode) {
    const [, chars, words, mode] = caseMode;
    const modeMap: Record<CanonicalLocale, Record<string, string>> = {
      ar: { UPPERCASE: 'أحرف كبيرة', lowercase: 'أحرف صغيرة', 'Title Case': 'حالة العنوان', 'Sentence case': 'حالة الجملة', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      es: { UPPERCASE: 'MAYÚSCULAS', lowercase: 'minúsculas', 'Title Case': 'Mayúsculas iniciales', 'Sentence case': 'tipo oración', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      fr: { UPPERCASE: 'MAJUSCULES', lowercase: 'minuscules', 'Title Case': 'casse titre', 'Sentence case': 'casse phrase', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      de: { UPPERCASE: 'GROSSBUCHSTABEN', lowercase: 'Kleinbuchstaben', 'Title Case': 'Titelformat', 'Sentence case': 'Satzformat', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      hi: { UPPERCASE: 'बड़े अक्षर', lowercase: 'छोटे अक्षर', 'Title Case': 'टाइटल केस', 'Sentence case': 'वाक्य केस', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      id: { UPPERCASE: 'HURUF BESAR', lowercase: 'huruf kecil', 'Title Case': 'Title Case', 'Sentence case': 'Sentence case', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      it: { UPPERCASE: 'MAIUSCOLO', lowercase: 'minuscolo', 'Title Case': 'Titolo', 'Sentence case': 'Frase', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      ja: { UPPERCASE: '大文字', lowercase: '小文字', 'Title Case': 'タイトルケース', 'Sentence case': '文形式', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      ko: { UPPERCASE: '대문자', lowercase: '소문자', 'Title Case': '제목 형식', 'Sentence case': '문장 형식', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      ms: { UPPERCASE: 'HURUF BESAR', lowercase: 'huruf kecil', 'Title Case': 'Huruf Tajuk', 'Sentence case': 'kes ayat', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      nl: { UPPERCASE: 'HOOFDLETTERS', lowercase: 'kleine letters', 'Title Case': 'Titelnotatie', 'Sentence case': 'Zinsnotatie', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      pl: { UPPERCASE: 'WIELKIE LITERY', lowercase: 'małe litery', 'Title Case': 'styl tytułu', 'Sentence case': 'styl zdania', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      pt: { UPPERCASE: 'MAIÚSCULAS', lowercase: 'minúsculas', 'Title Case': 'Caixa de título', 'Sentence case': 'Caixa de frase', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      ru: { UPPERCASE: 'ПРОПИСНЫЕ', lowercase: 'строчные', 'Title Case': 'Заглавные буквы', 'Sentence case': 'Регистр предложения', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      sv: { UPPERCASE: 'VERSALER', lowercase: 'gemener', 'Title Case': 'Titelstil', 'Sentence case': 'Meningsstil', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      th: { UPPERCASE: 'ตัวพิมพ์ใหญ่', lowercase: 'ตัวพิมพ์เล็ก', 'Title Case': 'รูปแบบชื่อเรื่อง', 'Sentence case': 'รูปแบบประโยค', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      tr: { UPPERCASE: 'BÜYÜK HARF', lowercase: 'küçük harf', 'Title Case': 'Başlık biçimi', 'Sentence case': 'Cümle biçimi', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      uk: { UPPERCASE: 'ВЕЛИКІ ЛІТЕРИ', lowercase: 'малі літери', 'Title Case': 'Регістр заголовка', 'Sentence case': 'Регістр речення', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      vi: { UPPERCASE: 'CHỮ HOA', lowercase: 'chữ thường', 'Title Case': 'Kiểu tiêu đề', 'Sentence case': 'Kiểu câu', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
      en: { UPPERCASE: 'UPPERCASE', lowercase: 'lowercase', 'Title Case': 'Title Case', 'Sentence case': 'Sentence case', camelCase: 'camelCase', PascalCase: 'PascalCase', snake_case: 'snake_case', 'kebab-case': 'kebab-case', CONSTANT_CASE: 'CONSTANT_CASE' },
    };
    const labels: Record<CanonicalLocale, [string,string,string]> = { ar: ['الأحرف','الكلمات','الوضع'], es: ['Caracteres','Palabras','Modo'], fr: ['Caractères','Mots','Mode'], de: ['Zeichen','Wörter','Modus'], hi: ['अक्षर','शब्द','मोड'], id: ['Karakter','Kata','Mode'], it: ['Caratteri','Parole','Modalità'], ja: ['文字','単語','モード'], ko: ['문자','단어','모드'], ms: ['Aksara','Perkataan','Mod'], nl: ['Tekens','Woorden','Modus'], pl: ['Znaki','Słowa','Tryb'], pt: ['Caracteres','Palavras','Modo'], ru: ['Символы','Слова','Режим'], sv: ['Tecken','Ord','Läge'], th: ['อักขระ','คำ','โหมด'], tr: ['Karakter','Kelime','Mod'], uk: ['Символи','Слова','Режим'], vi: ['Ký tự','Từ','Chế độ'], en: ['Characters','Words','Mode'] };
    const [c,w,m]=labels[locale]; return `${c} ${chars} ${w} ${words} ${m} ${modeMap[locale][mode]}`;
  }
  return value;
};

function toolIdFromDocument(): string {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const locale = normalizeLocale(parts[0]);
  const family = parts[0] === locale ? parts.slice(1) : parts;
  return family.join('/');
}

function translateTextNode(locale: CanonicalLocale, node: Text) {
  const current = node.nodeValue ?? '';
  const next = translated(locale, current);
  if (next !== current) node.nodeValue = next;
}

function apply(locale: CanonicalLocale) {
  const root = document.body;
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!node.nodeValue?.trim() || !parent || parent.closest('script,style,pre,textarea,[data-no-auto-i18n]')) continue;
    nodes.push(node);
  }
  for (const node of nodes) translateTextNode(locale, node);
  root.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((element) => {
    if (element.matches('[data-no-auto-i18n]')) return;
    for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const next = translated(locale, value);
      if (next !== value) element.setAttribute(attribute, next);
    }
  });
}

export function installToolUiRuntimeCompleteness(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;
  let lastLocale = '';
  const tick = () => {
    const locale = normalizeLocale(document.documentElement.lang || LOCALES[0]);
    if (locale !== 'en') {
      lastLocale = locale;
      apply(locale);
    } else if (lastLocale) {
      apply(locale);
      lastLocale = locale;
    }
  };
  const observer = new MutationObserver(() => tick());
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['lang', 'aria-label', 'title', 'placeholder'] });
  const interval = window.setInterval(tick, 250);
  tick();
  return () => { observer.disconnect(); window.clearInterval(interval); };
}
