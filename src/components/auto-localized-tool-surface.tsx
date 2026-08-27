import { useEffect, type ReactNode } from 'react';
import type { Locale } from '@/lib/i18n';
import { LOCALE_METADATA } from '@/lib/i18n';

type Props = Readonly<{ locale: Locale; children: ReactNode }>;
type LocaleMap = Partial<Record<Locale, string>>;

const P: Record<string, LocaleMap> = {
  'Choose an image': { ar: 'اختر صورة', es: 'Elige una imagen', fr: 'Choisissez une image', de: 'Bild auswählen', ru: 'Выберите изображение', zh: '选择图像', hi: 'एक छवि चुनें', id: 'Pilih gambar', ur: 'تصویر منتخب کریں', ja: '画像を選択', pt: 'Escolha uma imagem', it: 'Scegli un’immagine', ko: '이미지 선택', nl: 'Kies een afbeelding', pl: 'Wybierz obraz', tr: 'Bir görsel seçin', vi: 'Chọn hình ảnh', th: 'เลือกภาพ', sv: 'Välj en bild' },
  'Choose images to start': { ar: 'اختر الصور للبدء', es: 'Elige imágenes para comenzar', fr: 'Choisissez des images pour commencer', de: 'Bilder zum Start auswählen', ru: 'Выберите изображения для начала', zh: '选择图像开始', hi: 'शुरू करने के लिए छवियाँ चुनें', id: 'Pilih gambar untuk memulai', ur: 'شروع کرنے کے لیے تصاویر منتخب کریں', ja: '開始する画像を選択', pt: 'Escolha imagens para começar', it: 'Scegli immagini per iniziare', ko: '시작할 이미지 선택', nl: 'Kies afbeeldingen om te beginnen', pl: 'Wybierz obrazy, aby rozpocząć', tr: 'Başlamak için görselleri seçin', vi: 'Chọn hình ảnh để bắt đầu', th: 'เลือกภาพเพื่อเริ่มต้น', sv: 'Välj bilder för att börja' },
  'Choose audio': { ar: 'اختر ملفًا صوتيًا', es: 'Elige audio', fr: 'Choisissez un fichier audio', de: 'Audio auswählen', ru: 'Выберите аудио', zh: '选择音频', hi: 'ऑडियो चुनें', id: 'Pilih audio', ur: 'آڈیو منتخب کریں', ja: '音声を選択', pt: 'Escolha um áudio', it: 'Scegli audio', ko: '오디오 선택', nl: 'Kies audio', pl: 'Wybierz audio', tr: 'Ses seçin', vi: 'Chọn âm thanh', th: 'เลือกเสียง', sv: 'Välj ljud' },
  Upload: { ar: 'رفع', es: 'Subir', fr: 'Importer', de: 'Hochladen', ru: 'Загрузить', zh: '上传', hi: 'अपलोड', id: 'Unggah', ur: 'اپ لوڈ', ja: 'アップロード', pt: 'Enviar', it: 'Carica', ko: '업로드', nl: 'Uploaden', pl: 'Prześlij', tr: 'Yükle', vi: 'Tải lên', th: 'อัปโหลด', sv: 'Ladda upp' },
  Download: { ar: 'تنزيل', es: 'Descargar', fr: 'Télécharger', de: 'Herunterladen', ru: 'Скачать', zh: '下载', hi: 'डाउनलोड', id: 'Unduh', ur: 'ڈاؤن لوڈ', ja: 'ダウンロード', pt: 'Baixar', it: 'Scarica', ko: '다운로드', nl: 'Downloaden', pl: 'Pobierz', tr: 'İndir', vi: 'Tải xuống', th: 'ดาวน์โหลด', sv: 'Ladda ner' },
  'Download now': { ar: 'تنزيل الآن', es: 'Descargar ahora', fr: 'Télécharger maintenant', de: 'Jetzt herunterladen', ru: 'Скачать сейчас', zh: '立即下载', hi: 'अभी डाउनलोड करें', id: 'Unduh sekarang', ur: 'اب ڈاؤن لوڈ کریں', ja: '今すぐダウンロード', pt: 'Baixar agora', it: 'Scarica ora', ko: '지금 다운로드', nl: 'Nu downloaden', pl: 'Pobierz teraz', tr: 'Şimdi indir', vi: 'Tải xuống ngay', th: 'ดาวน์โหลดตอนนี้', sv: 'Ladda ner nu' },
  'Download compressed WAV': { ar: 'تنزيل WAV المضغوط', es: 'Descargar WAV comprimido', fr: 'Télécharger le WAV compressé', de: 'Komprimiertes WAV herunterladen', ru: 'Скачать сжатый WAV', zh: '下载压缩 WAV', hi: 'संपीड़ित WAV डाउनलोड करें', id: 'Unduh WAV terkompresi', ur: 'کمپریس شدہ WAV ڈاؤن لوڈ کریں', ja: '圧縮 WAV をダウンロード', pt: 'Baixar WAV compactado', it: 'Scarica WAV compresso', ko: '압축 WAV 다운로드', nl: 'Gecomprimeerde WAV downloaden', pl: 'Pobierz skompresowany WAV', tr: 'Sıkıştırılmış WAV indir', vi: 'Tải WAV nén xuống', th: 'ดาวน์โหลด WAV ที่บีบอัด', sv: 'Ladda ner komprimerad WAV' },
  'Run tool': { ar: 'تشغيل الأداة', es: 'Ejecutar herramienta', fr: 'Exécuter l’outil', de: 'Werkzeug ausführen', ru: 'Запустить инструмент', zh: '运行工具', hi: 'टूल चलाएँ', id: 'Jalankan alat', ur: 'ٹول چلائیں', ja: 'ツールを実行', pt: 'Executar ferramenta', it: 'Esegui strumento', ko: '도구 실행', nl: 'Tool uitvoeren', pl: 'Uruchom narzędzie', tr: 'Aracı çalıştır', vi: 'Chạy công cụ', th: 'เรียกใช้เครื่องมือ', sv: 'Kör verktyg' },
  'Processing…': { ar: 'جارٍ المعالجة…', es: 'Procesando…', fr: 'Traitement…', de: 'Verarbeitung…', ru: 'Обработка…', zh: '处理中…', hi: 'प्रोसेस हो रहा है…', id: 'Memproses…', ur: 'پروسیسنگ جاری ہے…', ja: '処理中…', pt: 'Processando…', it: 'Elaborazione…', ko: '처리 중…', nl: 'Verwerken…', pl: 'Przetwarzanie…', tr: 'İşleniyor…', vi: 'Đang xử lý…', th: 'กำลังประมวลผล…', sv: 'Bearbetar…' },
  'Compressing…': { ar: 'جارٍ الضغط…', es: 'Comprimiendo…', fr: 'Compression…', de: 'Wird komprimiert…', ru: 'Сжатие…', zh: '压缩中…', hi: 'कंप्रेस हो रहा है…', id: 'Mengompresi…', ur: 'کمپریس ہو رہا ہے…', ja: '圧縮中…', pt: 'Comprimindo…', it: 'Compressione…', ko: '압축 중…', nl: 'Comprimeren…', pl: 'Kompresowanie…', tr: 'Sıkıştırılıyor…', vi: 'Đang nén…', th: 'กำลังบีบอัด…', sv: 'Komprimerar…' },
  'Processing': { ar: 'جارٍ المعالجة', es: 'Procesando', fr: 'Traitement', de: 'Verarbeitung', ru: 'Обработка', zh: '处理中', hi: 'प्रोसेस हो रहा है', id: 'Memproses', ur: 'پروسیسنگ', ja: '処理中', pt: 'Processando', it: 'Elaborazione', ko: '처리 중', nl: 'Verwerken', pl: 'Przetwarzanie', tr: 'İşleniyor', vi: 'Đang xử lý', th: 'กำลังประมวลผล', sv: 'Bearbetar' },
  'Generate image': { ar: 'إنشاء صورة', es: 'Generar imagen', fr: 'Générer une image', de: 'Bild generieren', ru: 'Создать изображение', zh: '生成图像', hi: 'छवि बनाएं', id: 'Buat gambar', ur: 'تصویر بنائیں', ja: '画像を生成', pt: 'Gerar imagem', it: 'Genera immagine', ko: '이미지 생성', nl: 'Afbeelding genereren', pl: 'Generuj obraz', tr: 'Görsel oluştur', vi: 'Tạo hình ảnh', th: 'สร้างภาพ', sv: 'Skapa bild' },
  Prompt: { ar: 'الوصف', es: 'Indicación', fr: 'Instruction', de: 'Eingabe', ru: 'Промпт', zh: '提示词', hi: 'प्रॉम्प्ट', id: 'Prompt', ur: 'پرامپٹ', ja: 'プロンプト', pt: 'Prompt', it: 'Prompt', ko: '프롬프트', nl: 'Prompt', pl: 'Prompt', tr: 'İstem', vi: 'Lời nhắc', th: 'พรอมต์', sv: 'Prompt' },
  'Output format': { ar: 'صيغة الإخراج', es: 'Formato de salida', fr: 'Format de sortie', de: 'Ausgabeformat', ru: 'Формат вывода', zh: '输出格式', hi: 'आउटपुट फ़ॉर्मेट', id: 'Format keluaran', ur: 'آؤٹ پٹ فارمیٹ', ja: '出力形式', pt: 'Formato de saída', it: 'Formato di output', ko: '출력 형식', nl: 'Uitvoerformaat', pl: 'Format wyjściowy', tr: 'Çıktı biçimi', vi: 'Định dạng đầu ra', th: 'รูปแบบเอาต์พุต', sv: 'Utdataformat' },
  Quality: { ar: 'الجودة', es: 'Calidad', fr: 'Qualité', de: 'Qualität', ru: 'Качество', zh: '质量', hi: 'गुणवत्ता', id: 'Kualitas', ur: 'معیار', ja: '品質', pt: 'Qualidade', it: 'Qualità', ko: '품질', nl: 'Kwaliteit', pl: 'Jakość', tr: 'Kalite', vi: 'Chất lượng', th: 'คุณภาพ', sv: 'Kvalitet' },
  Scale: { ar: 'المقياس', es: 'Escala', fr: 'Échelle', de: 'Skalierung', ru: 'Масштаб', zh: '缩放', hi: 'स्केल', id: 'Skala', ur: 'پیمانہ', ja: '倍率', pt: 'Escala', it: 'Scala', ko: '배율', nl: 'Schaal', pl: 'Skala', tr: 'Ölçek', vi: 'Tỷ lệ', th: 'มาตราส่วน', sv: 'Skala' },
  'Background tolerance': { ar: 'تسامح الخلفية', es: 'Tolerancia del fondo', fr: 'Tolérance de l’arrière-plan', de: 'Hintergrundtoleranz', ru: 'Допуск фона', zh: '背景容差', hi: 'पृष्ठभूमि सहनशीलता', id: 'Toleransi latar belakang', ur: 'پس منظر برداشت', ja: '背景許容値', pt: 'Tolerância do fundo', it: 'Tolleranza sfondo', ko: '배경 허용 오차', nl: 'Achtergrondtolerantie', pl: 'Tolerancja tła', tr: 'Arka plan toleransı', vi: 'Dung sai nền', th: 'ค่าความคลาดเคลื่อนพื้นหลัง', sv: 'Bakgrundstolerans' },
  'SVG columns': { ar: 'أعمدة SVG', es: 'Columnas SVG', fr: 'Colonnes SVG', de: 'SVG-Spalten', ru: 'Столбцы SVG', zh: 'SVG 列数', hi: 'SVG कॉलम', id: 'Kolom SVG', ur: 'SVG کالمز', ja: 'SVG 列', pt: 'Colunas SVG', it: 'Colonne SVG', ko: 'SVG 열', nl: 'SVG-kolommen', pl: 'Kolumny SVG', tr: 'SVG sütunları', vi: 'Cột SVG', th: 'คอลัมน์ SVG', sv: 'SVG-kolumner' },
  'High': { ar: 'عالية', es: 'Alta', fr: 'Élevée', de: 'Hoch', ru: 'Высокое', zh: '高', hi: 'उच्च', id: 'Tinggi', ur: 'زیادہ', ja: '高', pt: 'Alta', it: 'Alta', ko: '높음', nl: 'Hoog', pl: 'Wysoka', tr: 'Yüksek', vi: 'Cao', th: 'สูง', sv: 'Hög' },
  Balanced: { ar: 'متوازنة', es: 'Equilibrada', fr: 'Équilibrée', de: 'Ausgewogen', ru: 'Сбалансированное', zh: '平衡', hi: 'संतुलित', id: 'Seimbang', ur: 'متوازن', ja: 'バランス', pt: 'Equilibrada', it: 'Bilanciata', ko: '균형', nl: 'Gebalanceerd', pl: 'Zrównoważona', tr: 'Dengeli', vi: 'Cân bằng', th: 'สมดุล', sv: 'Balanserad' },
  Small: { ar: 'صغيرة', es: 'Pequeña', fr: 'Petite', de: 'Klein', ru: 'Малое', zh: '小', hi: 'छोटा', id: 'Kecil', ur: 'چھوٹا', ja: '小', pt: 'Pequena', it: 'Piccola', ko: '작음', nl: 'Klein', pl: 'Mała', tr: 'Küçük', vi: 'Nhỏ', th: 'เล็ก', sv: 'Liten' },
  'Compression quality': { ar: 'جودة الضغط', es: 'Calidad de compresión', fr: 'Qualité de compression', de: 'Komprimierungsqualität', ru: 'Качество сжатия', zh: '压缩质量', hi: 'कंप्रेशन गुणवत्ता', id: 'Kualitas kompresi', ur: 'کمپریشن معیار', ja: '圧縮品質', pt: 'Qualidade de compressão', it: 'Qualità di compressione', ko: '압축 품질', nl: 'Compressiekwaliteit', pl: 'Jakość kompresji', tr: 'Sıkıştırma kalitesi', vi: 'Chất lượng nén', th: 'คุณภาพการบีบอัด', sv: 'Komprimeringskvalitet' },
  RESULT: { ar: 'النتيجة', es: 'RESULTADO', fr: 'RÉSULTAT', de: 'ERGEBNIS', ru: 'РЕЗУЛЬТАТ', zh: '结果', hi: 'परिणाम', id: 'HASIL', ur: 'نتیجہ', ja: '結果', pt: 'RESULTADO', it: 'RISULTATO', ko: '결과', nl: 'RESULTAAT', pl: 'WYNIK', tr: 'SONUÇ', vi: 'KẾT QUẢ', th: 'ผลลัพธ์', sv: 'RESULTAT' },
  'No result yet.': { ar: 'لا توجد نتيجة بعد.', es: 'Aún no hay resultado.', fr: 'Aucun résultat pour le moment.', de: 'Noch kein Ergebnis.', ru: 'Результата пока нет.', zh: '暂无结果。', hi: 'अभी कोई परिणाम नहीं है।', id: 'Belum ada hasil.', ur: 'ابھی کوئی نتیجہ نہیں۔', ja: 'まだ結果はありません。', pt: 'Ainda não há resultado.', it: 'Nessun risultato.', ko: '아직 결과가 없습니다.', nl: 'Nog geen resultaat.', pl: 'Brak wyniku.', tr: 'Henüz sonuç yok.', vi: 'Chưa có kết quả.', th: 'ยังไม่มีผลลัพธ์', sv: 'Inget resultat ännu.' },
  'No text detected.': { ar: 'لم يتم اكتشاف أي نص.', es: 'No se detectó texto.', fr: 'Aucun texte détecté.', de: 'Kein Text erkannt.', ru: 'Текст не обнаружен.', zh: '未检测到文本。', hi: 'कोई टेक्स्ट नहीं मिला।', id: 'Tidak ada teks terdeteksi.', ur: 'کوئی متن نہیں ملا۔', ja: 'テキストが検出されませんでした。', pt: 'Nenhum texto detectado.', it: 'Nessun testo rilevato.', ko: '텍스트가 감지되지 않았습니다.', nl: 'Geen tekst gedetecteerd.', pl: 'Nie wykryto tekstu.', tr: 'Metin algılanmadı.', vi: 'Không phát hiện văn bản.', th: 'ไม่พบข้อความ', sv: 'Ingen text upptäcktes.' },
  'Save': { ar: 'حفظ', es: 'Guardar', fr: 'Enregistrer', de: 'Speichern', ru: 'Сохранить', zh: '保存', hi: 'सहेजें', id: 'Simpan', ur: 'محفوظ کریں', ja: '保存', pt: 'Salvar', it: 'Salva', ko: '저장', nl: 'Opslaan', pl: 'Zapisz', tr: 'Kaydet', vi: 'Lưu', th: 'บันทึก', sv: 'Spara' },
  'Reset': { ar: 'إعادة ضبط', es: 'Restablecer', fr: 'Réinitialiser', de: 'Zurücksetzen', ru: 'Сбросить', zh: '重置', hi: 'रीसेट', id: 'Atur ulang', ur: 'ری سیٹ', ja: 'リセット', pt: 'Redefinir', it: 'Reimposta', ko: '재설정', nl: 'Resetten', pl: 'Resetuj', tr: 'Sıfırla', vi: 'Đặt lại', th: 'รีเซ็ต', sv: 'Återställ' },
};

const PREFIXES: Array<[string, LocaleMap]> = [
  ['Download ', { ar: 'تنزيل ', es: 'Descargar ', fr: 'Télécharger ', de: 'Herunterladen ', ru: 'Скачать ', zh: '下载 ', hi: 'डाउनलोड ', id: 'Unduh ', ur: 'ڈاؤن لوڈ ', ja: 'ダウンロード ', pt: 'Baixar ', it: 'Scarica ', ko: '다운로드 ', nl: 'Downloaden ', pl: 'Pobierz ', tr: 'İndir ', vi: 'Tải xuống ', th: 'ดาวน์โหลด ', sv: 'Ladda ner ' }],
  ['Input: ', { ar: 'الإدخال: ', es: 'Entrada: ', fr: 'Entrée : ', de: 'Eingabe: ', ru: 'Вход: ', zh: '输入：', hi: 'इनपुट: ', id: 'Input: ', ur: 'ان پٹ: ', ja: '入力: ', pt: 'Entrada: ', it: 'Input: ', ko: '입력: ', nl: 'Invoer: ', pl: 'Wejście: ', tr: 'Girdi: ', vi: 'Đầu vào: ', th: 'อินพุต: ', sv: 'Indata: ' }],
  ['Output: ', { ar: 'الإخراج: ', es: 'Salida: ', fr: 'Sortie : ', de: 'Ausgabe: ', ru: 'Результат: ', zh: '输出：', hi: 'आउटपुट: ', id: 'Keluaran: ', ur: 'آؤٹ پٹ: ', ja: '出力: ', pt: 'Saída: ', it: 'Output: ', ko: '출력: ', nl: 'Uitvoer: ', pl: 'Wyjście: ', tr: 'Çıktı: ', vi: 'Đầu ra: ', th: 'เอาต์พุต: ', sv: 'Utdata: ' }],
  ['Size change: ', { ar: 'تغير الحجم: ', es: 'Cambio de tamaño: ', fr: 'Variation de taille : ', de: 'Größenänderung: ', ru: 'Изменение размера: ', zh: '大小变化：', hi: 'आकार परिवर्तन: ', id: 'Perubahan ukuran: ', ur: 'سائز میں تبدیلی: ', ja: 'サイズ変更: ', pt: 'Alteração de tamanho: ', it: 'Variazione dimensione: ', ko: '크기 변경: ', nl: 'Groottewijziging: ', pl: 'Zmiana rozmiaru: ', tr: 'Boyut değişimi: ', vi: 'Thay đổi kích thước: ', th: 'การเปลี่ยนขนาด: ', sv: 'Storleksändring: ' }],
];

function excluded(node: Text): boolean {
  const parent = node.parentElement;
  return !parent || Boolean(parent.closest('script,style,pre,textarea,[contenteditable="true"],[data-no-auto-i18n]'));
}

function translateValue(locale: Locale, value: string): string {
  if (locale === 'en') return value;
  const exact = P[value.trim()]?.[locale];
  if (exact) return value.replace(value.trim(), exact);
  for (const [prefix, map] of PREFIXES) {
    if (value.startsWith(prefix)) return `${map[locale] ?? prefix}${value.slice(prefix.length)}`;
  }
  return value;
}

function localize(root: HTMLElement, locale: Locale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.nodeValue?.trim() || excluded(node)) continue;
    nodes.push(node);
  }
  for (const node of nodes) {
    const current = node.nodeValue ?? '';
    const next = translateValue(locale, current);
    if (next !== current) node.nodeValue = next;
  }
  root.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((element) => {
    if (element.matches('[data-no-auto-i18n]')) return;
    for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const next = translateValue(locale, value);
      if (next !== value) element.setAttribute(attribute, next);
    }
  });
}

export function AutoLocalizedToolSurface({ locale, children }: Props) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.tool-page-modern');
    if (!root) return;
    root.lang = locale;
    root.dir = LOCALE_METADATA[locale].direction;
    localize(root, locale);
    const observer = new MutationObserver(() => localize(root, locale));
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });
    return () => observer.disconnect();
  }, [locale]);

  return <>{children}</>;
}
