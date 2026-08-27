import { useEffect, type ReactNode } from 'react';
import type { Locale } from '@/lib/i18n';
import { LOCALE_METADATA } from '@/lib/i18n';

type Props = Readonly<{ locale: Locale; children: ReactNode }>;

type LocaleMap = Partial<Record<Locale, string>>;

const UI_PHRASES: Record<string, LocaleMap> = {
  'Choose an image': { ar: 'اختر صورة', es: 'Elige una imagen', fr: 'Choisissez une image', de: 'Bild auswählen', ru: 'Выберите изображение', zh: '选择图像', hi: 'एक छवि चुनें', id: 'Pilih gambar', ur: 'تصویر منتخب کریں', ja: '画像を選択', pt: 'Escolha uma imagem', it: 'Scegli un’immagine', ko: '이미지 선택', nl: 'Kies een afbeelding', pl: 'Wybierz obraz', tr: 'Bir görsel seçin', vi: 'Chọn hình ảnh', th: 'เลือกภาพ', sv: 'Välj en bild' },
  'Choose audio': { ar: 'اختر ملفًا صوتيًا', es: 'Elige audio', fr: 'Choisissez un fichier audio', de: 'Audio auswählen', ru: 'Выберите аудио', zh: '选择音频', hi: 'ऑडियो चुनें', id: 'Pilih audio', ur: 'آڈیو منتخب کریں', ja: '音声を選択', pt: 'Escolha um áudio', it: 'Scegli audio', ko: '오디오 선택', nl: 'Kies audio', pl: 'Wybierz audio', tr: 'Ses seçin', vi: 'Chọn âm thanh', th: 'เลือกเสียง', sv: 'Välj ljud' },
  'Upload': { ar: 'رفع', es: 'Subir', fr: 'Importer', de: 'Hochladen', ru: 'Загрузить', zh: '上传', hi: 'अपलोड', id: 'Unggah', ur: 'اپ لوڈ', ja: 'アップロード', pt: 'Enviar', it: 'Carica', ko: '업로드', nl: 'Uploaden', pl: 'Prześlij', tr: 'Yükle', vi: 'Tải lên', th: 'อัปโหลด', sv: 'Ladda upp' },
  'Download': { ar: 'تنزيل', es: 'Descargar', fr: 'Télécharger', de: 'Herunterladen', ru: 'Скачать', zh: '下载', hi: 'डाउनलोड', id: 'Unduh', ur: 'ڈاؤن لوڈ', ja: 'ダウンロード', pt: 'Baixar', it: 'Scarica', ko: '다운로드', nl: 'Downloaden', pl: 'Pobierz', tr: 'İndir', vi: 'Tải xuống', th: 'ดาวน์โหลด', sv: 'Ladda ner' },
  'Download now': { ar: 'تنزيل الآن', es: 'Descargar ahora', fr: 'Télécharger maintenant', de: 'Jetzt herunterladen', ru: 'Скачать сейчас', zh: '立即下载', hi: 'अभी डाउनलोड करें', id: 'Unduh sekarang', ur: 'اب ڈاؤن لوڈ کریں', ja: '今すぐダウンロード', pt: 'Baixar agora', it: 'Scarica ora', ko: '지금 다운로드', nl: 'Nu downloaden', pl: 'Pobierz teraz', tr: 'Şimdi indir', vi: 'Tải xuống ngay', th: 'ดาวน์โหลดตอนนี้', sv: 'Ladda ner nu' },
  'Run tool': { ar: 'تشغيل الأداة', es: 'Ejecutar herramienta', fr: 'Exécuter l’outil', de: 'Werkzeug ausführen', ru: 'Запустить инструмент', zh: '运行工具', hi: 'टूल चलाएँ', id: 'Jalankan alat', ur: 'ٹول چلائیں', ja: 'ツールを実行', pt: 'Executar ferramenta', it: 'Esegui strumento', ko: '도구 실행', nl: 'Tool uitvoeren', pl: 'Uruchom narzędzie', tr: 'Aracı çalıştır', vi: 'Chạy công cụ', th: 'เรียกใช้เครื่องมือ', sv: 'Kör verktyg' },
  'Processing…': { ar: 'جارٍ المعالجة…', es: 'Procesando…', fr: 'Traitement…', de: 'Verarbeitung…', ru: 'Обработка…', zh: '处理中…', hi: 'प्रोसेस हो रहा है…', id: 'Memproses…', ur: 'پروسیسنگ جاری ہے…', ja: '処理中…', pt: 'Processando…', it: 'Elaborazione…', ko: '처리 중…', nl: 'Verwerken…', pl: 'Przetwarzanie…', tr: 'İşleniyor…', vi: 'Đang xử lý…', th: 'กำลังประมวลผล…', sv: 'Bearbetar…' },
  'Processing': { ar: 'جارٍ المعالجة', es: 'Procesando', fr: 'Traitement', de: 'Verarbeitung', ru: 'Обработка', zh: '处理中', hi: 'प्रोसेस हो रहा है', id: 'Memproses', ur: 'پروسیسنگ', ja: '処理中', pt: 'Processando', it: 'Elaborazione', ko: '처리 중', nl: 'Verwerken', pl: 'Przetwarzanie', tr: 'İşleniyor', vi: 'Đang xử lý', th: 'กำลังประมวลผล', sv: 'Bearbetar' },
  'Generate image': { ar: 'إنشاء صورة', es: 'Generar imagen', fr: 'Générer une image', de: 'Bild generieren', ru: 'Создать изображение', zh: '生成图像', hi: 'छवि बनाएं', id: 'Buat gambar', ur: 'تصویر بنائیں', ja: '画像を生成', pt: 'Gerar imagem', it: 'Genera immagine', ko: '이미지 생성', nl: 'Afbeelding genereren', pl: 'Generuj obraz', tr: 'Görsel oluştur', vi: 'Tạo hình ảnh', th: 'สร้างภาพ', sv: 'Skapa bild' },
  'Prompt': { ar: 'الوصف', es: 'Indicación', fr: 'Instruction', de: 'Prompt', ru: 'Промпт', zh: '提示词', hi: 'प्रॉम्प्ट', id: 'Prompt', ur: 'پرامپٹ', ja: 'プロンプト', pt: 'Prompt', it: 'Prompt', ko: '프롬프트', nl: 'Prompt', pl: 'Prompt', tr: 'İstem', vi: 'Lời nhắc', th: 'พรอมต์', sv: 'Prompt' },
  'Output format': { ar: 'صيغة الإخراج', es: 'Formato de salida', fr: 'Format de sortie', de: 'Ausgabeformat', ru: 'Формат вывода', zh: '输出格式', hi: 'आउटपुट फ़ॉर्मेट', id: 'Format keluaran', ur: 'آؤٹ پٹ فارمیٹ', ja: '出力形式', pt: 'Formato de saída', it: 'Formato di output', ko: '출력 형식', nl: 'Uitvoerformaat', pl: 'Format wyjściowy', tr: 'Çıktı biçimi', vi: 'Định dạng đầu ra', th: 'รูปแบบเอาต์พุต', sv: 'Utdataformat' },
  'Quality': { ar: 'الجودة', es: 'Calidad', fr: 'Qualité', de: 'Qualität', ru: 'Качество', zh: '质量', hi: 'गुणवत्ता', id: 'Kualitas', ur: 'معیار', ja: '品質', pt: 'Qualidade', it: 'Qualità', ko: '품질', nl: 'Kwaliteit', pl: 'Jakość', tr: 'Kalite', vi: 'Chất lượng', th: 'คุณภาพ', sv: 'Kvalitet' },
  'Scale': { ar: 'المقياس', es: 'Escala', fr: 'Échelle', de: 'Skalierung', ru: 'Масштаб', zh: '缩放', hi: 'स्केल', id: 'Skala', ur: 'پیمانہ', ja: '倍率', pt: 'Escala', it: 'Scala', ko: '배율', nl: 'Schaal', pl: 'Skala', tr: 'Ölçek', vi: 'Tỷ lệ', th: 'มาตราส่วน', sv: 'Skala' },
  'High': { ar: 'عالية', es: 'Alta', fr: 'Élevée', de: 'Hoch', ru: 'Высокое', zh: '高', hi: 'उच्च', id: 'Tinggi', ur: 'زیادہ', ja: '高', pt: 'Alta', it: 'Alta', ko: '높음', nl: 'Hoog', pl: 'Wysoka', tr: 'Yüksek', vi: 'Cao', th: 'สูง', sv: 'Hög' },
  'Balanced': { ar: 'متوازنة', es: 'Equilibrada', fr: 'Équilibrée', de: 'Ausgewogen', ru: 'Сбалансированное', zh: '平衡', hi: 'संतुलित', id: 'Seimbang', ur: 'متوازن', ja: 'バランス', pt: 'Equilibrada', it: 'Bilanciata', ko: '균형', nl: 'Gebalanceerd', pl: 'Zrównoważona', tr: 'Dengeli', vi: 'Cân bằng', th: 'สมดุล', sv: 'Balanserad' },
  'Small': { ar: 'صغيرة', es: 'Pequeña', fr: 'Petite', de: 'Klein', ru: 'Малое', zh: '小', hi: 'छोटा', id: 'Kecil', ur: 'چھوٹا', ja: '小', pt: 'Pequena', it: 'Piccola', ko: '작음', nl: 'Klein', pl: 'Mała', tr: 'Küçük', vi: 'Nhỏ', th: 'เล็ก', sv: 'Liten' },
  'RESULT': { ar: 'النتيجة', es: 'RESULTADO', fr: 'RÉSULTAT', de: 'ERGEBNIS', ru: 'РЕЗУЛЬТАТ', zh: '结果', hi: 'परिणाम', id: 'HASIL', ur: 'نتیجہ', ja: '結果', pt: 'RESULTADO', it: 'RISULTATO', ko: '결과', nl: 'RESULTAAT', pl: 'WYNIK', tr: 'SONUÇ', vi: 'KẾT QUẢ', th: 'ผลลัพธ์', sv: 'RESULTAT' },
  'No result yet.': { ar: 'لا توجد نتيجة بعد.', es: 'Aún no hay resultado.', fr: 'Aucun résultat pour le moment.', de: 'Noch kein Ergebnis.', ru: 'Результата пока нет.', zh: '暂无结果。', hi: 'अभी कोई परिणाम नहीं है।', id: 'Belum ada hasil.', ur: 'ابھی کوئی نتیجہ نہیں۔', ja: 'まだ結果はありません。', pt: 'Ainda não há resultado.', it: 'Nessun risultato.', ko: '아직 결과가 없습니다.', nl: 'Nog geen resultaat.', pl: 'Brak wyników.', tr: 'Henüz sonuç yok.', vi: 'Chưa có kết quả.', th: 'ยังไม่มีผลลัพธ์', sv: 'Inget resultat ännu.' },
  'No text detected.': { ar: 'لم يتم اكتشاف أي نص.', es: 'No se detectó texto.', fr: 'Aucun texte détecté.', de: 'Kein Text erkannt.', ru: 'Текст не обнаружен.', zh: '未检测到文本。', hi: 'कोई टेक्स्ट नहीं मिला।', id: 'Tidak ada teks terdeteksi.', ur: 'کوئی متن نہیں ملا۔', ja: 'テキストが検出されませんでした。', pt: 'Nenhum texto detectado.', it: 'Nessun testo rilevato.', ko: '텍스트가 감지되지 않았습니다.', nl: 'Geen tekst gedetecteerd.', pl: 'Nie wykryto tekstu.', tr: 'Metin algılanmadı.', vi: 'Không phát hiện văn bản.', th: 'ไม่พบข้อความ', sv: 'Ingen text upptäcktes.' },
  'Download now': { ar: 'تنزيل الآن', es: 'Descargar ahora', fr: 'Télécharger maintenant', de: 'Jetzt herunterladen', ru: 'Скачать сейчас', zh: '立即下载', hi: 'अभी डाउनलोड करें', id: 'Unduh sekarang', ur: 'اب ڈاؤن لوڈ کریں', ja: '今すぐダウンロード', pt: 'Baixar agora', it: 'Scarica ora', ko: '지금 다운로드', nl: 'Nu downloaden', pl: 'Pobierz teraz', tr: 'Şimdi indir', vi: 'Tải xuống ngay', th: 'ดาวน์โหลดตอนนี้', sv: 'Ladda ner nu' },
  'Save': { ar: 'حفظ', es: 'Guardar', fr: 'Enregistrer', de: 'Speichern', ru: 'Сохранить', zh: '保存', hi: 'सहेजें', id: 'Simpan', ur: 'محفوظ کریں', ja: '保存', pt: 'Salvar', it: 'Salva', ko: '저장', nl: 'Opslaan', pl: 'Zapisz', tr: 'Kaydet', vi: 'Lưu', th: 'บันทึก', sv: 'Spara' },
  'Reset': { ar: 'إعادة ضبط', es: 'Restablecer', fr: 'Réinitialiser', de: 'Zurücksetzen', ru: 'Сбросить', zh: '重置', hi: 'रीसेट', id: 'Atur ulang', ur: 'ری سیٹ', ja: 'リセット', pt: 'Redefinir', it: 'Reimposta', ko: '재설정', nl: 'Resetten', pl: 'Resetuj', tr: 'Sıfırla', vi: 'Đặt lại', th: 'รีเซ็ต', sv: 'Återställ' },
};

function isTextExcluded(node: Element): boolean {
  return node.matches('script,style,pre,textarea,input,select,option,[contenteditable="true"],[data-no-auto-i18n]');
}

function translateText(locale: Locale, text: string): string {
  if (locale === 'en') return text;
  const trimmed = text.trim();
  const translated = UI_PHRASES[trimmed]?.[locale];
  if (!translated) return text;
  return text.replace(trimmed, translated);
}

function localize(root: HTMLElement, locale: Locale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!parent || isTextExcluded(parent) || parent.closest('pre,textarea,[contenteditable="true"],[data-no-auto-i18n]')) continue;
    if (node.nodeValue?.trim()) nodes.push(node);
  }
  for (const node of nodes) {
    const next = translateText(locale, node.nodeValue ?? '');
    if (next !== node.nodeValue) node.nodeValue = next;
  }
  root.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((element) => {
    if (isTextExcluded(element)) return;
    for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const next = translateText(locale, value);
      if (next !== value) element.setAttribute(attribute, next);
    }
  });
}

export function AutoLocalizedToolSurface({ locale, children }: Props) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.tool-page-modern__tool-host');
    if (!root) return;
    document.documentElement.lang = locale;
    document.documentElement.dir = LOCALE_METADATA[locale].direction;
    localize(root, locale);
    const observer = new MutationObserver(() => localize(root, locale));
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });
    return () => observer.disconnect();
  }, [locale]);

  return <>{children}</>;
}
