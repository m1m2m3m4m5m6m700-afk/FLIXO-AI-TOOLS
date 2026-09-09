import { useEffect, useRef, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { convertImage, cropResizeImage, imageInfo, removeBackground, rasterToSvg, resizeImage, watermarkRemove, fillRemoveRegion } from './engine';
import { recognizeWithOcrWorker } from './ocr-worker-client';
import { assertImageCropperOutputIntegrity } from '../image-cropper/output-integrity';
import { assertImageConverterOutputIntegrity } from '../image-converter/output-integrity';
import { validateFileSafety } from '../../lib/contracts/file-safety';
import { validateUploadBoundary } from '../../lib/contracts/upload-boundary';
import { LOCALE_METADATA, isLocale } from '../../lib/i18n';
import { getToolSeo } from '../../lib/seo/tool-seo';
import { getAuthoritativeToolSeoName } from '../../config/tool-seo-name-resolver';
import type { LocalToolId } from './engine';

const DEFINITIONS: Record<Exclude<LocalToolId, 'ai-image-generator' | 'image-compressor'>, { title: string; description: string; accept: string }> = {
  'background-remover': { title: 'Background Remover', description: 'Remove connected, uniform backgrounds locally in your browser with edge-aware flood fill.', accept: 'image/png,image/jpeg,image/webp,image/svg+xml' },
  'image-upscaler': { title: 'Image Upscaler', description: 'Increase image dimensions with high-quality browser resampling and controlled sharpening.', accept: 'image/png,image/jpeg,image/webp' },
  'image-converter': { title: 'Image Converter', description: 'Convert images between PNG, JPG, and WebP without uploading them.', accept: 'image/png,image/jpeg,image/webp' },
  'image-to-text': { title: 'Image to Text OCR', description: 'Extract visible text from an image in your browser with OCR preprocessing.', accept: 'image/png,image/jpeg,image/webp' },
  'object-remover': { title: 'Object Remover', description: 'Reconstruct a selected rectangular object region from surrounding pixels locally.', accept: 'image/png,image/jpeg,image/webp' },
  'crop-resize': { title: 'Crop & Resize', description: 'Crop an image and export it at exact dimensions.', accept: 'image/png,image/jpeg,image/webp' },
  'watermark-remover': { title: 'Watermark Remover', description: 'Reconstruct a selected watermark region locally with edge interpolation.', accept: 'image/png,image/jpeg,image/webp' },
  'raster-to-svg': { title: 'Raster to SVG', description: 'Convert a small raster image to compact pixel-based SVG locally.', accept: 'image/png,image/jpeg,image/webp' },
};

type Props = { toolId: Exclude<LocalToolId, 'image-compressor'> };
type SharedImageToolId = Exclude<LocalToolId, 'ai-image-generator' | 'image-compressor'>;
type Result = { blob: Blob; text?: string; fileName: string; info?: { width: number; height: number }; objectUrl?: string };

type RasterMime = 'image/png' | 'image/jpeg' | 'image/webp';
const RASTER_SIGNATURE_POLICIES: Record<RasterMime, { extensions: readonly string[]; signatures: readonly string[] }> = {
  'image/png': { extensions: ['png'], signatures: ['89504e470d0a1a0a'] },
  'image/jpeg': { extensions: ['jpg', 'jpeg'], signatures: ['ffd8ff'] },
  'image/webp': { extensions: ['webp'], signatures: ['52494646'] },
};

type UiCopy = Readonly<{
  imageTools: string; prompt: string; promptRequired: string; chooseImage: string; chooseImageFirst: string; imageInput: string;
  outputFormat: string; scale: string; backgroundTolerance: string; svgColumns: string;
  x: string; y: string; width: string; height: string; outputWidth: string; outputHeight: string;
  run: string; processing: string; generate: string; result: string; download: string; downloadNow: string;
  noResult: string; toolResult: string; privacyOcr: string;
}>;

const UI_COPY: Record<string, UiCopy> = {
  en: { imageTools:'FLIXO · IMAGE TOOLS', prompt:'Prompt', promptRequired:'Enter a prompt first.', chooseImage:'Choose an image', chooseImageFirst:'Choose an image first.', imageInput:'IMAGE INPUT', outputFormat:'Output format', scale:'Scale', backgroundTolerance:'Background tolerance', svgColumns:'SVG columns', x:'X', y:'Y', width:'Width', height:'Height', outputWidth:'Output width', outputHeight:'Output height', run:'Run tool', processing:'Processing…', generate:'Generate image', result:'RESULT', download:'Download', downloadNow:'Download now', noResult:'No result yet.', toolResult:'Tool result', privacyOcr:'OCR preprocesses the selected image locally, then runs Tesseract.js recognition in a dedicated Web Worker.' },
  ar: { imageTools:'FLIXO · أدوات الصور', prompt:'الوصف', promptRequired:'أدخل وصفًا أولًا.', chooseImage:'اختر صورة', chooseImageFirst:'اختر صورة أولًا.', imageInput:'مدخل الصورة', outputFormat:'تنسيق الإخراج', scale:'المقياس', backgroundTolerance:'تسامح الخلفية', svgColumns:'أعمدة SVG', x:'X', y:'Y', width:'العرض', height:'الارتفاع', outputWidth:'عرض الإخراج', outputHeight:'ارتفاع الإخراج', run:'تشغيل الأداة', processing:'جارٍ المعالجة…', generate:'إنشاء صورة', result:'النتيجة', download:'تنزيل', downloadNow:'تنزيل الآن', noResult:'لا توجد نتيجة بعد.', toolResult:'نتيجة الأداة', privacyOcr:'تُعالج الصورة المحددة محليًا أولًا، ثم يتعرف Tesseract.js على النص داخل Web Worker مخصص.' },
  es: { imageTools:'FLIXO · HERRAMIENTAS DE IMAGEN', prompt:'Indicación', promptRequired:'Introduce una indicación primero.', chooseImage:'Elige una imagen', chooseImageFirst:'Elige una imagen primero.', imageInput:'ENTRADA DE IMAGEN', outputFormat:'Formato de salida', scale:'Escala', backgroundTolerance:'Tolerancia del fondo', svgColumns:'Columnas SVG', x:'X', y:'Y', width:'Ancho', height:'Alto', outputWidth:'Ancho de salida', outputHeight:'Alto de salida', run:'Ejecutar herramienta', processing:'Procesando…', generate:'Generar imagen', result:'RESULTADO', download:'Descargar', downloadNow:'Descargar ahora', noResult:'Aún no hay resultado.', toolResult:'Resultado de la herramienta', privacyOcr:'La imagen seleccionada se preprocesa localmente y Tesseract.js reconoce el texto en un Web Worker dedicado.' },
  fr: { imageTools:'FLIXO · OUTILS D’IMAGE', prompt:'Consigne', promptRequired:'Saisissez d’abord une consigne.', chooseImage:'Choisissez une image', chooseImageFirst:'Choisissez d’abord une image.', imageInput:'ENTRÉE IMAGE', outputFormat:'Format de sortie', scale:'Échelle', backgroundTolerance:'Tolérance de l’arrière-plan', svgColumns:'Colonnes SVG', x:'X', y:'Y', width:'Largeur', height:'Hauteur', outputWidth:'Largeur de sortie', outputHeight:'Hauteur de sortie', run:'Exécuter l’outil', processing:'Traitement…', generate:'Générer une image', result:'RÉSULTAT', download:'Télécharger', downloadNow:'Télécharger maintenant', noResult:'Aucun résultat pour le moment.', toolResult:'Résultat de l’outil', privacyOcr:'L’image sélectionnée est prétraitée localement, puis Tesseract.js reconnaît le texte dans un Web Worker dédié.' },
  de: { imageTools:'FLIXO · BILDTOOLS', prompt:'Eingabe', promptRequired:'Geben Sie zuerst eine Eingabe ein.', chooseImage:'Bild auswählen', chooseImageFirst:'Wählen Sie zuerst ein Bild aus.', imageInput:'BILDEINGABE', outputFormat:'Ausgabeformat', scale:'Skalierung', backgroundTolerance:'Hintergrundtoleranz', svgColumns:'SVG-Spalten', x:'X', y:'Y', width:'Breite', height:'Höhe', outputWidth:'Ausgabebreite', outputHeight:'Ausgabehöhe', run:'Tool ausführen', processing:'Verarbeitung…', generate:'Bild generieren', result:'ERGEBNIS', download:'Herunterladen', downloadNow:'Jetzt herunterladen', noResult:'Noch kein Ergebnis.', toolResult:'Tool-Ergebnis', privacyOcr:'Das ausgewählte Bild wird lokal vorverarbeitet; anschließend erkennt Tesseract.js den Text in einem dedizierten Web Worker.' },
  hi: { imageTools:'FLIXO · इमेज टूल्स', prompt:'प्रॉम्प्ट', promptRequired:'पहले एक प्रॉम्प्ट दर्ज करें।', chooseImage:'छवि चुनें', chooseImageFirst:'पहले एक छवि चुनें।', imageInput:'इमेज इनपुट', outputFormat:'आउटपुट फ़ॉर्मेट', scale:'स्केल', backgroundTolerance:'बैकग्राउंड टॉलरेंस', svgColumns:'SVG कॉलम', x:'X', y:'Y', width:'चौड़ाई', height:'ऊँचाई', outputWidth:'आउटपुट चौड़ाई', outputHeight:'आउटपुट ऊँचाई', run:'टूल चलाएँ', processing:'प्रोसेस हो रहा है…', generate:'छवि बनाएँ', result:'परिणाम', download:'डाउनलोड', downloadNow:'अभी डाउनलोड करें', noResult:'अभी कोई परिणाम नहीं।', toolResult:'टूल परिणाम', privacyOcr:'चयनित छवि को स्थानीय रूप से प्रीप्रोसेस किया जाता है और फिर समर्पित Web Worker में Tesseract.js पहचान चलती है।' },
  id: { imageTools:'FLIXO · ALAT GAMBAR', prompt:'Perintah', promptRequired:'Masukkan perintah terlebih dahulu.', chooseImage:'Pilih gambar', chooseImageFirst:'Pilih gambar terlebih dahulu.', imageInput:'MASUKAN GAMBAR', outputFormat:'Format keluaran', scale:'Skala', backgroundTolerance:'Toleransi latar belakang', svgColumns:'Kolom SVG', x:'X', y:'Y', width:'Lebar', height:'Tinggi', outputWidth:'Lebar keluaran', outputHeight:'Tinggi keluaran', run:'Jalankan alat', processing:'Memproses…', generate:'Buat gambar', result:'HASIL', download:'Unduh', downloadNow:'Unduh sekarang', noResult:'Belum ada hasil.', toolResult:'Hasil alat', privacyOcr:'Gambar pilihan diproses secara lokal, lalu Tesseract.js mengenali teks dalam Web Worker khusus.' },
  it: { imageTools:'FLIXO · STRUMENTI IMMAGINE', prompt:'Prompt', promptRequired:'Inserisci prima un prompt.', chooseImage:'Scegli un’immagine', chooseImageFirst:'Scegli prima un’immagine.', imageInput:'INPUT IMMAGINE', outputFormat:'Formato di output', scale:'Scala', backgroundTolerance:'Tolleranza dello sfondo', svgColumns:'Colonne SVG', x:'X', y:'Y', width:'Larghezza', height:'Altezza', outputWidth:'Larghezza di output', outputHeight:'Altezza di output', run:'Esegui lo strumento', processing:'Elaborazione…', generate:'Genera immagine', result:'RISULTATO', download:'Scarica', downloadNow:'Scarica ora', noResult:'Nessun risultato ancora.', toolResult:'Risultato dello strumento', privacyOcr:'L’immagine selezionata viene preelaborata localmente, quindi Tesseract.js riconosce il testo in un Web Worker dedicato.' },
  ja: { imageTools:'FLIXO · 画像ツール', prompt:'プロンプト', promptRequired:'最初にプロンプトを入力してください。', chooseImage:'画像を選択', chooseImageFirst:'最初に画像を選択してください。', imageInput:'画像入力', outputFormat:'出力形式', scale:'倍率', backgroundTolerance:'背景の許容値', svgColumns:'SVG列数', x:'X', y:'Y', width:'幅', height:'高さ', outputWidth:'出力幅', outputHeight:'出力高さ', run:'ツールを実行', processing:'処理中…', generate:'画像を生成', result:'結果', download:'ダウンロード', downloadNow:'今すぐダウンロード', noResult:'まだ結果はありません。', toolResult:'ツールの結果', privacyOcr:'選択した画像をローカルで前処理し、専用のWeb WorkerでTesseract.jsによる認識を実行します。' },
  ko: { imageTools:'FLIXO · 이미지 도구', prompt:'프롬프트', promptRequired:'먼저 프롬프트를 입력하세요.', chooseImage:'이미지 선택', chooseImageFirst:'먼저 이미지를 선택하세요.', imageInput:'이미지 입력', outputFormat:'출력 형식', scale:'배율', backgroundTolerance:'배경 허용 범위', svgColumns:'SVG 열', x:'X', y:'Y', width:'너비', height:'높이', outputWidth:'출력 너비', outputHeight:'출력 높이', run:'도구 실행', processing:'처리 중…', generate:'이미지 생성', result:'결과', download:'다운로드', downloadNow:'지금 다운로드', noResult:'아직 결과가 없습니다.', toolResult:'도구 결과', privacyOcr:'선택한 이미지를 로컬에서 전처리한 다음 전용 Web Worker에서 Tesseract.js 인식을 실행합니다.' },
  ms: { imageTools:'FLIXO · ALAT IMEJ', prompt:'Gesaan', promptRequired:'Masukkan gesaan dahulu.', chooseImage:'Pilih imej', chooseImageFirst:'Pilih imej dahulu.', imageInput:'INPUT IMEJ', outputFormat:'Format output', scale:'Skala', backgroundTolerance:'Toleransi latar', svgColumns:'Lajur SVG', x:'X', y:'Y', width:'Lebar', height:'Tinggi', outputWidth:'Lebar output', outputHeight:'Tinggi output', run:'Jalankan alat', processing:'Memproses…', generate:'Jana imej', result:'HASIL', download:'Muat turun', downloadNow:'Muat turun sekarang', noResult:'Tiada hasil lagi.', toolResult:'Hasil alat', privacyOcr:'Imej yang dipilih dipraproses secara setempat, kemudian Tesseract.js menjalankan pengecaman dalam Web Worker khusus.' },
  nl: { imageTools:'FLIXO · AFBEELDINGSTOOLS', prompt:'Prompt', promptRequired:'Voer eerst een prompt in.', chooseImage:'Kies een afbeelding', chooseImageFirst:'Kies eerst een afbeelding.', imageInput:'AFBEELDINGSINVOER', outputFormat:'Uitvoerindeling', scale:'Schaal', backgroundTolerance:'Achtergrondtolerantie', svgColumns:'SVG-kolommen', x:'X', y:'Y', width:'Breedte', height:'Hoogte', outputWidth:'Uitvoerbreedte', outputHeight:'Uitvoerhoogte', run:'Tool uitvoeren', processing:'Bezig met verwerken…', generate:'Afbeelding genereren', result:'RESULTAAT', download:'Downloaden', downloadNow:'Nu downloaden', noResult:'Nog geen resultaat.', toolResult:'Toolresultaat', privacyOcr:'De geselecteerde afbeelding wordt lokaal voorbewerkt en Tesseract.js voert herkenning uit in een speciale Web Worker.' },
  pl: { imageTools:'FLIXO · NARZĘDZIA DO OBRAZÓW', prompt:'Polecenie', promptRequired:'Najpierw wprowadź polecenie.', chooseImage:'Wybierz obraz', chooseImageFirst:'Najpierw wybierz obraz.', imageInput:'WEJŚCIE OBRAZU', outputFormat:'Format wyjściowy', scale:'Skala', backgroundTolerance:'Tolerancja tła', svgColumns:'Kolumny SVG', x:'X', y:'Y', width:'Szerokość', height:'Wysokość', outputWidth:'Szerokość wyjścia', outputHeight:'Wysokość wyjścia', run:'Uruchom narzędzie', processing:'Przetwarzanie…', generate:'Wygeneruj obraz', result:'WYNIK', download:'Pobierz', downloadNow:'Pobierz teraz', noResult:'Brak wyniku.', toolResult:'Wynik narzędzia', privacyOcr:'Wybrany obraz jest przetwarzany lokalnie, a następnie Tesseract.js rozpoznaje tekst w dedykowanym Web Workerze.' },
  pt: { imageTools:'FLIXO · FERRAMENTAS DE IMAGEM', prompt:'Comando', promptRequired:'Introduza primeiro um comando.', chooseImage:'Escolha uma imagem', chooseImageFirst:'Escolha primeiro uma imagem.', imageInput:'ENTRADA DE IMAGEM', outputFormat:'Formato de saída', scale:'Escala', backgroundTolerance:'Tolerância do fundo', svgColumns:'Colunas SVG', x:'X', y:'Y', width:'Largura', height:'Altura', outputWidth:'Largura de saída', outputHeight:'Altura de saída', run:'Executar ferramenta', processing:'A processar…', generate:'Gerar imagem', result:'RESULTADO', download:'Transferir', downloadNow:'Transferir agora', noResult:'Ainda não há resultado.', toolResult:'Resultado da ferramenta', privacyOcr:'A imagem selecionada é pré-processada localmente e o Tesseract.js reconhece o texto num Web Worker dedicado.' },
  ru: { imageTools:'FLIXO · ИНСТРУМЕНТЫ ДЛЯ ИЗОБРАЖЕНИЙ', prompt:'Запрос', promptRequired:'Сначала введите запрос.', chooseImage:'Выберите изображение', chooseImageFirst:'Сначала выберите изображение.', imageInput:'ВХОДНОЕ ИЗОБРАЖЕНИЕ', outputFormat:'Формат вывода', scale:'Масштаб', backgroundTolerance:'Допуск фона', svgColumns:'Столбцы SVG', x:'X', y:'Y', width:'Ширина', height:'Высота', outputWidth:'Ширина результата', outputHeight:'Высота результата', run:'Запустить инструмент', processing:'Обработка…', generate:'Создать изображение', result:'РЕЗУЛЬТАТ', download:'Скачать', downloadNow:'Скачать сейчас', noResult:'Результата пока нет.', toolResult:'Результат инструмента', privacyOcr:'Выбранное изображение обрабатывается локально, затем Tesseract.js распознаёт текст в выделенном Web Worker.' },
  sv: { imageTools:'FLIXO · BILDVERKTYG', prompt:'Prompt', promptRequired:'Ange en prompt först.', chooseImage:'Välj en bild', chooseImageFirst:'Välj en bild först.', imageInput:'BILDINDATA', outputFormat:'Utdataformat', scale:'Skala', backgroundTolerance:'Bakgrundstolerans', svgColumns:'SVG-kolumner', x:'X', y:'Y', width:'Bredd', height:'Höjd', outputWidth:'Utdata-bredd', outputHeight:'Utdata-höjd', run:'Kör verktyget', processing:'Bearbetar…', generate:'Skapa bild', result:'RESULTAT', download:'Ladda ner', downloadNow:'Ladda ner nu', noResult:'Inget resultat ännu.', toolResult:'Verktygsresultat', privacyOcr:'Den valda bilden förbehandlas lokalt och Tesseract.js kör igenkänning i en dedikerad Web Worker.' },
  th: { imageTools:'FLIXO · เครื่องมือรูปภาพ', prompt:'พรอมต์', promptRequired:'กรุณาป้อนพรอมต์ก่อน', chooseImage:'เลือกภาพ', chooseImageFirst:'เลือกภาพก่อน', imageInput:'อินพุตรูปภาพ', outputFormat:'รูปแบบเอาต์พุต', scale:'มาตราส่วน', backgroundTolerance:'ค่าความคลาดเคลื่อนของพื้นหลัง', svgColumns:'คอลัมน์ SVG', x:'X', y:'Y', width:'ความกว้าง', height:'ความสูง', outputWidth:'ความกว้างเอาต์พุต', outputHeight:'ความสูงเอาต์พุต', run:'เรียกใช้เครื่องมือ', processing:'กำลังประมวลผล…', generate:'สร้างภาพ', result:'ผลลัพธ์', download:'ดาวน์โหลด', downloadNow:'ดาวน์โหลดตอนนี้', noResult:'ยังไม่มีผลลัพธ์', toolResult:'ผลลัพธ์ของเครื่องมือ', privacyOcr:'ภาพที่เลือกจะถูกประมวลผลล่วงหน้าในเครื่อง จากนั้น Tesseract.js จะรู้จำข้อความใน Web Worker เฉพาะ' },
  tr: { imageTools:'FLIXO · GÖRSEL ARAÇLARI', prompt:'İstek', promptRequired:'Önce bir istek girin.', chooseImage:'Bir görsel seçin', chooseImageFirst:'Önce bir görsel seçin.', imageInput:'GÖRSEL GİRDİSİ', outputFormat:'Çıktı biçimi', scale:'Ölçek', backgroundTolerance:'Arka plan toleransı', svgColumns:'SVG sütunları', x:'X', y:'Y', width:'Genişlik', height:'Yükseklik', outputWidth:'Çıktı genişliği', outputHeight:'Çıktı yüksekliği', run:'Aracı çalıştır', processing:'İşleniyor…', generate:'Görsel oluştur', result:'SONUÇ', download:'İndir', downloadNow:'Şimdi indir', noResult:'Henüz sonuç yok.', toolResult:'Araç sonucu', privacyOcr:'Seçilen görsel yerel olarak ön işlenir, ardından Tesseract.js ayrılmış bir Web Worker içinde tanıma yapar.' },
  uk: { imageTools:'FLIXO · ІНСТРУМЕНТИ ЗОБРАЖЕНЬ', prompt:'Запит', promptRequired:'Спочатку введіть запит.', chooseImage:'Виберіть зображення', chooseImageFirst:'Спочатку виберіть зображення.', imageInput:'ВХІДНЕ ЗОБРАЖЕННЯ', outputFormat:'Формат виводу', scale:'Масштаб', backgroundTolerance:'Допуск фону', svgColumns:'Стовпці SVG', x:'X', y:'Y', width:'Ширина', height:'Висота', outputWidth:'Ширина виводу', outputHeight:'Висота виводу', run:'Запустити інструмент', processing:'Обробка…', generate:'Створити зображення', result:'РЕЗУЛЬТАТ', download:'Завантажити', downloadNow:'Завантажити зараз', noResult:'Результату ще немає.', toolResult:'Результат інструмента', privacyOcr:'Вибране зображення обробляється локально, після чого Tesseract.js розпізнає текст у спеціальному Web Worker.' },
  vi: { imageTools:'FLIXO · CÔNG CỤ HÌNH ẢNH', prompt:'Lời nhắc', promptRequired:'Trước tiên hãy nhập lời nhắc.', chooseImage:'Chọn ảnh', chooseImageFirst:'Trước tiên hãy chọn một ảnh.', imageInput:'ĐẦU VÀO HÌNH ẢNH', outputFormat:'Định dạng đầu ra', scale:'Tỷ lệ', backgroundTolerance:'Dung sai nền', svgColumns:'Cột SVG', x:'X', y:'Y', width:'Chiều rộng', height:'Chiều cao', outputWidth:'Chiều rộng đầu ra', outputHeight:'Chiều cao đầu ra', run:'Chạy công cụ', processing:'Đang xử lý…', generate:'Tạo ảnh', result:'KẾT QUẢ', download:'Tải xuống', downloadNow:'Tải xuống ngay', noResult:'Chưa có kết quả.', toolResult:'Kết quả công cụ', privacyOcr:'Ảnh đã chọn được xử lý trước cục bộ, sau đó Tesseract.js nhận dạng văn bản trong Web Worker chuyên dụng.' },
};

function baseName(name: string) { return name.replace(/\.[^.]+$/, '') || 'flixo-image'; }

async function validateSharedImageInput(file: File, toolId: SharedImageToolId) {
  const allowedMime = DEFINITIONS[toolId].accept.split(',');
  const basePolicy = { allowedMime, maxBytes: 25 * 1024 * 1024, maxPixels: 40_000_000 } as const;
  const basic = validateFileSafety({ name: file.name, mime: file.type, bytes: file.size }, basePolicy);
  if (!basic.safe) throw new Error(`Input rejected by File Safety: ${basic.failures.join('; ')}`);
  const rasterPolicy = RASTER_SIGNATURE_POLICIES[file.type as RasterMime];
  if (rasterPolicy) {
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const boundary = validateUploadBoundary({ name: file.name, mime: file.type, bytes }, { ...basePolicy, allowedExtensions: rasterPolicy.extensions, signatures: rasterPolicy.signatures });
    if (!boundary.safe) throw new Error(`Input rejected by Upload Security Boundary: ${boundary.failures.join('; ')}`);
  }
  const sourceInfo = await imageInfo(file);
  const dimensionCheck = validateFileSafety({ name: file.name, mime: file.type, bytes: file.size, width: sourceInfo.width, height: sourceInfo.height }, basePolicy);
  if (!dimensionCheck.safe) throw new Error(`Input rejected by File Safety: ${dimensionCheck.failures.join('; ')}`);
}

async function preprocessForOcr(file: File): Promise<Blob> {
  const image = await createImageBitmap(file);
  const scale = Math.min(2.5, Math.max(1, 1600 / Math.max(image.width, image.height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < data.data.length; index += 4) {
    const luminance = 0.2126 * data.data[index] + 0.0722 * data.data[index + 2] + 0.7152 * data.data[index + 1];
    const boosted = Math.max(0, Math.min(255, (luminance - 128) * 1.45 + 128));
    data.data[index] = boosted; data.data[index + 1] = boosted; data.data[index + 2] = boosted;
  }
  context.putImageData(data, 0, 0);
  image.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not prepare OCR input.')), 'image/png'));
}

async function createResult(blob: Blob, fileName: string, info?: Result['info'], text?: string): Promise<Result> {
  const objectUrl = URL.createObjectURL(blob);
  return { blob, fileName, info, text, objectUrl };
}

export function ImageToolPage({ toolId }: Props) {
  const location = useLocation();
  const localeCode = location.pathname.split('/').filter(Boolean)[0] ?? '';
  const locale = isLocale(localeCode) ? localeCode : 'en';
  const localeMetadata = LOCALE_METADATA[locale];
  const ui = UI_COPY[locale] ?? UI_COPY.en;
  const isGenerator = toolId === 'ai-image-generator';
  const canonicalToolId = toolId === 'image-to-text' ? 'image-ocr' : toolId;
  const canonicalTool = getToolSeo(locale, canonicalToolId)?.tool;
  const localizedTitle = canonicalTool ? getAuthoritativeToolSeoName(canonicalTool, locale) : undefined;
  const localizedSeo = getToolSeo(locale, canonicalToolId);
  const definition = isGenerator
    ? { title: getAuthoritativeToolSeoName(getToolSeo(locale, 'ai-image-generator')!.tool, locale) ?? 'AI Image Generator', description: localizedSeo?.description ?? 'Generate an image through the configured FLIXO image model endpoint.', accept: '' }
    : { ...DEFINITIONS[toolId], title: localizedTitle ?? DEFINITIONS[toolId].title, description: localizedSeo?.description ?? DEFINITIONS[toolId].description };
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [outputFormat, setOutputFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/webp');
  const [scale, setScale] = useState('2'); const [tolerance, setTolerance] = useState('42'); const [columns, setColumns] = useState('48');
  const [cropX, setCropX] = useState('0'); const [cropY, setCropY] = useState('0'); const [cropW, setCropW] = useState('500'); const [cropH, setCropH] = useState('500'); const [outW, setOutW] = useState('500'); const [outH, setOutH] = useState('500');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [result, setResult] = useState<Result | null>(null);
  const objectUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);
  const replaceResult = (next: Result | null) => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = next?.objectUrl; setResult(next); };

  const run = async () => {
    setBusy(true); setError(''); replaceResult(null);
    try {
      if (isGenerator) {
        if (!prompt.trim()) throw new Error(ui.promptRequired);
        const body = new FormData(); body.append('capability', 'generate-image'); body.append('prompt', prompt.trim());
        const response = await fetch(import.meta.env.VITE_FLIXO_AI_IMAGE_ENDPOINT || '/api/ai/image', { method: 'POST', body });
        if (!response.ok) throw new Error('AI image endpoint is not configured or returned an error.');
        const blob = await response.blob(); if (!blob.type.startsWith('image/')) throw new Error('AI endpoint did not return an image.');
        const info = await imageInfo(blob); replaceResult(await createResult(blob, `flixo-ai-${info.width}x${info.height}.png`, info)); return;
      }
      if (toolId === 'image-upscaler') { const factor = Number(scale); if (!Number.isFinite(factor) || factor < 0.25 || factor > 4) throw new Error('Scale must be between 0.25 and 4.'); }
      if (!file) throw new Error(ui.chooseImageFirst);
      await validateSharedImageInput(file, toolId);
      let blob: Blob; let fileName = baseName(file.name); let info: Result['info'];
      if (toolId === 'background-remover') { blob = await removeBackground(file, Number(tolerance) || 42); fileName += '-no-background.png'; }
      else if (toolId === 'image-upscaler') { const factor = Number(scale); blob = await resizeImage(file, factor); fileName += `-upscaled-${factor}x.png`; }
      else if (toolId === 'image-converter') { blob = await convertImage(file, outputFormat); info = await imageInfo(blob); assertImageConverterOutputIntegrity(blob, info); fileName += outputFormat === 'image/jpeg' ? '.jpg' : outputFormat === 'image/png' ? '.png' : '.webp'; }
      else if (toolId === 'image-to-text') { const prepared = await preprocessForOcr(file); const ocr = await recognizeWithOcrWorker(prepared, 'eng+ara'); replaceResult(await createResult(new Blob([ocr.text], { type: 'text/plain;charset=utf-8' }), `${baseName(file.name)}.txt`, undefined, ocr.text)); return; }
      else if (toolId === 'object-remover') { blob = await fillRemoveRegion(file, { x: Number(cropX), y: Number(cropY), width: Number(cropW), height: Number(cropH) }); fileName += '-object-removed.png'; }
      else if (toolId === 'watermark-remover') { blob = await watermarkRemove(file, { x: Number(cropX), y: Number(cropY), width: Number(cropW), height: Number(cropH) }); fileName += '-watermark-removed.png'; }
      else if (toolId === 'crop-resize') { blob = await cropResizeImage(file, { x: Number(cropX), y: Number(cropY), width: Number(cropW), height: Number(cropH) }, { width: Number(outW), height: Number(outH) }); info = await imageInfo(blob); assertImageCropperOutputIntegrity(blob, info); fileName += '-cropped.png'; }
      else { blob = await rasterToSvg(file, Number(columns) || 48); fileName += '.svg'; }
      if (blob.type.startsWith('image/') && !info) info = await imageInfo(blob);
      replaceResult(await createResult(blob, fileName, info));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Tool failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div lang={localeMetadata.languageTag} dir={localeMetadata.direction} className="image-tool-shell">
      <div className="image-tool-container">
        <header className="image-tool-header"><div><p className="image-tool-eyebrow">{ui.imageTools}</p><h2>{definition.title}</h2><p className="image-tool-lead">{definition.description}</p></div></header>
        <section className="compressor-grid" aria-label={definition.title}>
          <div className="compressor-card">
            {isGenerator
              ? <label><span>{ui.prompt}</span><textarea data-testid="ai-image-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={ui.prompt} rows={6} /></label>
              : <><label className="upload-zone" htmlFor="image-tool-file"><span className="upload-title">{file ? file.name : ui.chooseImage}</span><span className="upload-subtitle">{definition.accept.replaceAll('image/', '').toUpperCase() || ui.imageInput}</span></label><input id="image-tool-file" className="sr-only" type="file" accept={definition.accept} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></>}
            {toolId === 'image-converter' && <label><span>{ui.outputFormat}</span><select aria-label={ui.outputFormat} value={outputFormat} onChange={(event) => setOutputFormat(event.target.value as typeof outputFormat)}><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label>}
            {toolId === 'image-upscaler' && <label><span>{ui.scale}</span><input aria-label={ui.scale} inputMode="decimal" value={scale} onChange={(event) => setScale(event.target.value)} /></label>}
            {toolId === 'background-remover' && <label><span>{ui.backgroundTolerance}</span><input aria-label={ui.backgroundTolerance} inputMode="numeric" value={tolerance} onChange={(event) => setTolerance(event.target.value)} /></label>}
            {toolId === 'raster-to-svg' && <label><span>{ui.svgColumns}</span><input aria-label={ui.svgColumns} inputMode="numeric" value={columns} onChange={(event) => setColumns(event.target.value)} /></label>}
            {['object-remover', 'watermark-remover', 'crop-resize'].includes(toolId) && <div className="control-grid">{([ [ui.x, cropX, setCropX, 'object-x'], [ui.y, cropY, setCropY, 'object-y'], [ui.width, cropW, setCropW, 'object-width'], [ui.height, cropH, setCropH, 'object-height'] ] as const).map(([labelText, value, setter, testId]) => <label key={testId}><span>{labelText}</span><input data-testid={testId} aria-label={labelText} inputMode="numeric" value={value} onChange={(event) => setter(event.target.value)} /></label>)}{toolId === 'crop-resize' && <><label><span>{ui.outputWidth}</span><input aria-label={ui.outputWidth} inputMode="numeric" value={outW} onChange={(event) => setOutW(event.target.value)} /></label><label><span>{ui.outputHeight}</span><input aria-label={ui.outputHeight} inputMode="numeric" value={outH} onChange={(event) => setOutH(event.target.value)} /></label></>}</div>}
            <div className="button-row"><button className="primary-button" disabled={busy || (!file && !isGenerator)} onClick={() => void run()}>{busy ? ui.processing : isGenerator ? ui.generate : ui.run}</button></div>
            {error && <p role="alert" className="error-box">{error}</p>}
            {toolId === 'image-to-text' && <p className="privacy-note">{ui.privacyOcr}</p>}
          </div>
          <aside className="result-card" aria-live="polite"><p className="image-tool-eyebrow">{ui.result}</p>{result ? <>{result.text !== undefined ? <pre style={{ whiteSpace: 'pre-wrap' }}>{result.text || ui.noResult}</pre> : result.objectUrl && <img src={result.objectUrl} alt={ui.toolResult} style={{ maxWidth: '100%', borderRadius: 12 }} />}{result.info && <p className="privacy-note">Output: {result.info.width} × {result.info.height}px · {Math.round(result.blob.size / 1024)} KB · {result.blob.type || 'application/octet-stream'}</p>}<div className="button-row"><a className="primary-button" href={result.objectUrl} download={result.fileName}>{ui.download} {result.fileName}</a><a className="primary-button" role="button" href={result.objectUrl} download={result.fileName}>{ui.downloadNow}</a></div></> : <p>{ui.noResult}</p>}</aside>
        </section>
      </div>
    </div>
  );
}
