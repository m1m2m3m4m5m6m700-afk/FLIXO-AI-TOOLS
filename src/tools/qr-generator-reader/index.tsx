import { useRef, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { buildQrPayload, renderQrDataUrl, renderQrSvg, scanQrFile, type QrPayloadType } from './engine';
import { normalizeLocale, type CanonicalLocale } from '../../lib/i18n/config';

type Copy = {
  title: string;
  description: string;
  generate: string;
  payloadType: string;
  content: string;
  foreground: string;
  background: string;
  generateQr: string;
  generatedAlt: string;
  downloadPng: string;
  downloadSvg: string;
  readImage: string;
  readerDescription: string;
  chooseImage: string;
  qrResult: string;
};

const COPY: Record<CanonicalLocale, Copy> = {
  ar: { title: 'مولد وقارئ رمز QR', description: 'أنشئ رموز QR واقرأ صور QR محليًا داخل المتصفح.', generate: 'إنشاء', payloadType: 'نوع المحتوى', content: 'المحتوى', foreground: 'اللون الأمامي', background: 'لون الخلفية', generateQr: 'إنشاء رمز QR', generatedAlt: 'رمز QR تم إنشاؤه', downloadPng: 'تنزيل PNG', downloadSvg: 'تنزيل SVG', readImage: 'قراءة صورة QR', readerDescription: 'يستخدم BarcodeDetector في المتصفح؛ لا يتم رفع الصورة.', chooseImage: 'اختر صورة QR', qrResult: 'نتيجة قراءة QR' },
  en: { title: 'QR Code Generator & Reader', description: 'Generate QR codes and scan QR images locally in your browser.', generate: 'Generate', payloadType: 'Payload type', content: 'Content', foreground: 'Foreground color', background: 'Background color', generateQr: 'Generate QR', generatedAlt: 'Generated QR code', downloadPng: 'Download PNG', downloadSvg: 'Download SVG', readImage: 'Read QR image', readerDescription: 'Uses the browser BarcodeDetector API; no image is uploaded.', chooseImage: 'Choose QR image', qrResult: 'QR scan result' },
  es: { title: 'Generador y lector de códigos QR', description: 'Genera códigos QR y escanea imágenes QR localmente en tu navegador.', generate: 'Generar', payloadType: 'Tipo de contenido', content: 'Contenido', foreground: 'Color frontal', background: 'Color de fondo', generateQr: 'Generar QR', generatedAlt: 'Código QR generado', downloadPng: 'Descargar PNG', downloadSvg: 'Descargar SVG', readImage: 'Leer imagen QR', readerDescription: 'Usa BarcodeDetector del navegador; la imagen no se carga.', chooseImage: 'Elegir imagen QR', qrResult: 'Resultado de lectura QR' },
  fr: { title: 'Générateur et lecteur de codes QR', description: 'Générez des codes QR et analysez des images QR localement dans votre navigateur.', generate: 'Générer', payloadType: 'Type de contenu', content: 'Contenu', foreground: 'Couleur de premier plan', background: 'Couleur d’arrière-plan', generateQr: 'Générer le QR', generatedAlt: 'Code QR généré', downloadPng: 'Télécharger PNG', downloadSvg: 'Télécharger SVG', readImage: 'Lire une image QR', readerDescription: 'Utilise BarcodeDetector du navigateur ; aucune image n’est envoyée.', chooseImage: 'Choisir une image QR', qrResult: 'Résultat de lecture QR' },
  de: { title: 'QR-Code-Generator und -Leser', description: 'Erstellen Sie QR-Codes und lesen Sie QR-Bilder lokal im Browser.', generate: 'Erstellen', payloadType: 'Inhaltstyp', content: 'Inhalt', foreground: 'Vordergrundfarbe', background: 'Hintergrundfarbe', generateQr: 'QR-Code erstellen', generatedAlt: 'Erstellter QR-Code', downloadPng: 'PNG herunterladen', downloadSvg: 'SVG herunterladen', readImage: 'QR-Bild lesen', readerDescription: 'Verwendet die BarcodeDetector-API des Browsers; kein Bild wird hochgeladen.', chooseImage: 'QR-Bild auswählen', qrResult: 'QR-Leseergebnis' },
  hi: { title: 'QR कोड जनरेटर और रीडर', description: 'अपने ब्राउज़र में स्थानीय रूप से QR कोड बनाएँ और QR चित्र स्कैन करें।', generate: 'बनाएँ', payloadType: 'कंटेंट प्रकार', content: 'सामग्री', foreground: 'अग्रभूमि रंग', background: 'पृष्ठभूमि रंग', generateQr: 'QR बनाएँ', generatedAlt: 'बनाया गया QR कोड', downloadPng: 'PNG डाउनलोड करें', downloadSvg: 'SVG डाउनलोड करें', readImage: 'QR चित्र पढ़ें', readerDescription: 'ब्राउज़र BarcodeDetector API का उपयोग करता है; कोई चित्र अपलोड नहीं होता।', chooseImage: 'QR चित्र चुनें', qrResult: 'QR स्कैन परिणाम' },
  id: { title: 'Pembuat dan Pembaca Kode QR', description: 'Buat kode QR dan pindai gambar QR secara lokal di browser Anda.', generate: 'Buat', payloadType: 'Jenis konten', content: 'Konten', foreground: 'Warna depan', background: 'Warna latar', generateQr: 'Buat QR', generatedAlt: 'Kode QR yang dibuat', downloadPng: 'Unduh PNG', downloadSvg: 'Unduh SVG', readImage: 'Baca gambar QR', readerDescription: 'Menggunakan BarcodeDetector di browser; gambar tidak diunggah.', chooseImage: 'Pilih gambar QR', qrResult: 'Hasil pemindaian QR' },
  it: { title: 'Generatore e lettore di codici QR', description: 'Genera codici QR e scansiona immagini QR localmente nel browser.', generate: 'Genera', payloadType: 'Tipo di contenuto', content: 'Contenuto', foreground: 'Colore in primo piano', background: 'Colore di sfondo', generateQr: 'Genera QR', generatedAlt: 'Codice QR generato', downloadPng: 'Scarica PNG', downloadSvg: 'Scarica SVG', readImage: 'Leggi immagine QR', readerDescription: 'Usa BarcodeDetector del browser; nessuna immagine viene caricata.', chooseImage: 'Scegli immagine QR', qrResult: 'Risultato scansione QR' },
  ja: { title: 'QRコード生成・読み取り', description: 'ブラウザ内でQRコードを生成し、QR画像をローカルで読み取ります。', generate: '生成', payloadType: '内容タイプ', content: '内容', foreground: '前景色', background: '背景色', generateQr: 'QRを生成', generatedAlt: '生成されたQRコード', downloadPng: 'PNGをダウンロード', downloadSvg: 'SVGをダウンロード', readImage: 'QR画像を読み取る', readerDescription: 'ブラウザのBarcodeDetector APIを使用します。画像はアップロードされません。', chooseImage: 'QR画像を選択', qrResult: 'QR読み取り結果' },
  ko: { title: 'QR 코드 생성기 및 리더', description: '브라우저에서 QR 코드를 만들고 QR 이미지를 로컬로 스캔합니다.', generate: '생성', payloadType: '콘텐츠 유형', content: '콘텐츠', foreground: '전경 색상', background: '배경 색상', generateQr: 'QR 생성', generatedAlt: '생성된 QR 코드', downloadPng: 'PNG 다운로드', downloadSvg: 'SVG 다운로드', readImage: 'QR 이미지 읽기', readerDescription: '브라우저 BarcodeDetector API를 사용하며 이미지를 업로드하지 않습니다.', chooseImage: 'QR 이미지 선택', qrResult: 'QR 스캔 결과' },
  ms: { title: 'Penjana dan Pembaca Kod QR', description: 'Jana kod QR dan imbas imej QR secara setempat dalam pelayar anda.', generate: 'Jana', payloadType: 'Jenis kandungan', content: 'Kandungan', foreground: 'Warna hadapan', background: 'Warna latar', generateQr: 'Jana QR', generatedAlt: 'Kod QR yang dijana', downloadPng: 'Muat turun PNG', downloadSvg: 'Muat turun SVG', readImage: 'Baca imej QR', readerDescription: 'Menggunakan BarcodeDetector pelayar; tiada imej dimuat naik.', chooseImage: 'Pilih imej QR', qrResult: 'Hasil imbasan QR' },
  nl: { title: 'QR-codegenerator en -lezer', description: 'Genereer QR-codes en scan QR-afbeeldingen lokaal in uw browser.', generate: 'Genereren', payloadType: 'Inhoudstype', content: 'Inhoud', foreground: 'Voorgrondkleur', background: 'Achtergrondkleur', generateQr: 'QR genereren', generatedAlt: 'Gegenereerde QR-code', downloadPng: 'PNG downloaden', downloadSvg: 'SVG downloaden', readImage: 'QR-afbeelding lezen', readerDescription: 'Gebruikt de BarcodeDetector API van de browser; er wordt geen afbeelding geüpload.', chooseImage: 'QR-afbeelding kiezen', qrResult: 'QR-scanresultaat' },
  pl: { title: 'Generator i czytnik kodów QR', description: 'Twórz kody QR i skanuj obrazy QR lokalnie w przeglądarce.', generate: 'Generuj', payloadType: 'Typ treści', content: 'Treść', foreground: 'Kolor pierwszego planu', background: 'Kolor tła', generateQr: 'Generuj QR', generatedAlt: 'Wygenerowany kod QR', downloadPng: 'Pobierz PNG', downloadSvg: 'Pobierz SVG', readImage: 'Odczytaj obraz QR', readerDescription: 'Korzysta z BarcodeDetector w przeglądarce; obraz nie jest wysyłany.', chooseImage: 'Wybierz obraz QR', qrResult: 'Wynik skanowania QR' },
  pt: { title: 'Gerador e leitor de códigos QR', description: 'Gere códigos QR e leia imagens QR localmente no navegador.', generate: 'Gerar', payloadType: 'Tipo de conteúdo', content: 'Conteúdo', foreground: 'Cor do primeiro plano', background: 'Cor de fundo', generateQr: 'Gerar QR', generatedAlt: 'Código QR gerado', downloadPng: 'Baixar PNG', downloadSvg: 'Baixar SVG', readImage: 'Ler imagem QR', readerDescription: 'Usa o BarcodeDetector do navegador; nenhuma imagem é enviada.', chooseImage: 'Escolher imagem QR', qrResult: 'Resultado da leitura QR' },
  ru: { title: 'Генератор и считыватель QR-кодов', description: 'Создавайте QR-коды и считывайте изображения QR локально в браузере.', generate: 'Создать', payloadType: 'Тип содержимого', content: 'Содержимое', foreground: 'Цвет переднего плана', background: 'Цвет фона', generateQr: 'Создать QR', generatedAlt: 'Созданный QR-код', downloadPng: 'Скачать PNG', downloadSvg: 'Скачать SVG', readImage: 'Считать изображение QR', readerDescription: 'Использует BarcodeDetector браузера; изображение не загружается.', chooseImage: 'Выбрать изображение QR', qrResult: 'Результат сканирования QR' },
  sv: { title: 'QR-kodsgenerator och läsare', description: 'Skapa QR-koder och skanna QR-bilder lokalt i webbläsaren.', generate: 'Skapa', payloadType: 'Innehållstyp', content: 'Innehåll', foreground: 'Förgrundsfärg', background: 'Bakgrundsfärg', generateQr: 'Skapa QR', generatedAlt: 'Genererad QR-kod', downloadPng: 'Ladda ner PNG', downloadSvg: 'Ladda ner SVG', readImage: 'Läs QR-bild', readerDescription: 'Använder webbläsarens BarcodeDetector API; ingen bild laddas upp.', chooseImage: 'Välj QR-bild', qrResult: 'QR-skanningsresultat' },
  th: { title: 'ตัวสร้างและตัวอ่าน QR Code', description: 'สร้าง QR Code และสแกนภาพ QR ภายในเบราว์เซอร์โดยไม่อัปโหลดไฟล์', generate: 'สร้าง', payloadType: 'ประเภทเนื้อหา', content: 'เนื้อหา', foreground: 'สีด้านหน้า', background: 'สีพื้นหลัง', generateQr: 'สร้าง QR', generatedAlt: 'QR Code ที่สร้างแล้ว', downloadPng: 'ดาวน์โหลด PNG', downloadSvg: 'ดาวน์โหลด SVG', readImage: 'อ่านภาพ QR', readerDescription: 'ใช้ BarcodeDetector ของเบราว์เซอร์และไม่อัปโหลดภาพ', chooseImage: 'เลือกภาพ QR', qrResult: 'ผลการสแกน QR' },
  tr: { title: 'QR Kod Oluşturucu ve Okuyucu', description: 'Tarayıcınızda QR kodları oluşturun ve QR görsellerini yerel olarak tarayın.', generate: 'Oluştur', payloadType: 'İçerik türü', content: 'İçerik', foreground: 'Ön plan rengi', background: 'Arka plan rengi', generateQr: 'QR oluştur', generatedAlt: 'Oluşturulan QR kodu', downloadPng: 'PNG indir', downloadSvg: 'SVG indir', readImage: 'QR görselini oku', readerDescription: 'Tarayıcının BarcodeDetector API’sini kullanır; görsel yüklenmez.', chooseImage: 'QR görseli seç', qrResult: 'QR tarama sonucu' },
  uk: { title: 'Генератор і зчитувач QR-кодів', description: 'Створюйте QR-коди та зчитуйте зображення QR локально у браузері.', generate: 'Створити', payloadType: 'Тип вмісту', content: 'Вміст', foreground: 'Колір переднього плану', background: 'Колір тла', generateQr: 'Створити QR', generatedAlt: 'Створений QR-код', downloadPng: 'Завантажити PNG', downloadSvg: 'Завантажити SVG', readImage: 'Зчитати зображення QR', readerDescription: 'Використовує BarcodeDetector браузера; зображення не завантажується.', chooseImage: 'Вибрати зображення QR', qrResult: 'Результат сканування QR' },
  vi: { title: 'Trình tạo và đọc mã QR', description: 'Tạo mã QR và quét hình ảnh QR cục bộ trong trình duyệt.', generate: 'Tạo', payloadType: 'Loại nội dung', content: 'Nội dung', foreground: 'Màu tiền cảnh', background: 'Màu nền', generateQr: 'Tạo QR', generatedAlt: 'Mã QR đã tạo', downloadPng: 'Tải PNG', downloadSvg: 'Tải SVG', readImage: 'Đọc ảnh QR', readerDescription: 'Dùng BarcodeDetector của trình duyệt; không tải ảnh lên.', chooseImage: 'Chọn ảnh QR', qrResult: 'Kết quả quét QR' },
};

const TYPES: Array<{ value: QrPayloadType; key: keyof Copy }> = [
  { value: 'text', key: 'content' },
  { value: 'url', key: 'payloadType' },
  { value: 'wifi', key: 'foreground' },
  { value: 'vcard', key: 'background' },
];

const TYPE_LABELS: Record<CanonicalLocale, Record<QrPayloadType, string>> = Object.fromEntries(
  Object.entries(COPY).map(([locale, copy]) => [locale, {
    text: locale === 'ar' ? 'نص' : locale === 'de' ? 'Text' : locale === 'fr' ? 'Texte' : locale === 'es' ? 'Texto' : locale === 'ja' ? 'テキスト' : locale === 'ko' ? '텍스트' : locale === 'ru' ? 'Текст' : locale === 'uk' ? 'Текст' : locale === 'vi' ? 'Văn bản' : 'Text',
    url: 'URL',
    wifi: locale === 'ar' ? 'واي فاي (SSID|كلمة المرور|الأمان)' : locale === 'de' ? 'WLAN (SSID|Passwort|Sicherheit)' : locale === 'fr' ? 'Wi-Fi (SSID|mot de passe|sécurité)' : locale === 'es' ? 'Wi-Fi (SSID|contraseña|seguridad)' : locale === 'ja' ? 'Wi-Fi (SSID|パスワード|セキュリティ)' : locale === 'ko' ? 'Wi-Fi (SSID|비밀번호|보안)' : locale === 'ru' ? 'Wi-Fi (SSID|пароль|безопасность)' : locale === 'uk' ? 'Wi-Fi (SSID|пароль|безпека)' : locale === 'vi' ? 'Wi-Fi (SSID|mật khẩu|bảo mật)' : 'Wi-Fi (SSID|Password|Security)',
    vcard: locale === 'ar' ? 'vCard (الاسم)' : locale === 'de' ? 'vCard (Name)' : locale === 'fr' ? 'vCard (nom)' : locale === 'es' ? 'vCard (nombre)' : locale === 'ja' ? 'vCard (名前)' : locale === 'ko' ? 'vCard (이름)' : locale === 'ru' ? 'vCard (имя)' : locale === 'uk' ? 'vCard (ім’я)' : locale === 'vi' ? 'vCard (tên)' : 'vCard (name)',
  } as Record<QrPayloadType, string>]),
) as unknown as Record<CanonicalLocale, Record<QrPayloadType, string>>;

export function QrGeneratorReaderTool() {
  const location = useLocation();
  const locale = normalizeLocale(location.pathname.split('/').filter(Boolean)[0]);
  const copy = COPY[locale];
  const [type, setType] = useState<QrPayloadType>('text');
  const [value, setValue] = useState('https://flixo.tools');
  const [foreground, setForeground] = useState('#111827');
  const [background, setBackground] = useState('#ffffff');
  const [preview, setPreview] = useState('');
  const [svg, setSvg] = useState('');
  const [scanResult, setScanResult] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      buildQrPayload(type, value);
      const [dataUrl, svgMarkup] = await Promise.all([
        renderQrDataUrl({ type, value, foreground, background, width: 360 }),
        renderQrSvg({ type, value, foreground, background, width: 360 }),
      ]);
      setPreview(dataUrl);
      setSvg(svgMarkup);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to generate QR code.');
      setPreview('');
      setSvg('');
    } finally {
      setBusy(false);
    }
  };

  const scanFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      setScanResult(await scanQrFile(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to scan QR code.');
      setScanResult('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6" aria-labelledby="qr-title">
      <header>
        <h1 id="qr-title" className="text-3xl font-bold">{copy.title}</h1>
        <p className="mt-2 text-sm opacity-75">{copy.description}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border p-5" aria-labelledby="generator-title">
          <h2 id="generator-title" className="font-semibold">{copy.generate}</h2>
          <label className="mt-4 block text-sm font-medium" htmlFor="qr-type">{copy.payloadType}</label>
          <select id="qr-type" className="mt-2 w-full rounded-xl border p-3" value={type} onChange={(event) => setType(event.target.value as QrPayloadType)}>
            {TYPES.map((item) => <option key={item.value} value={item.value}>{TYPE_LABELS[locale][item.value]}</option>)}
          </select>
          <label className="mt-4 block text-sm font-medium" htmlFor="qr-content">{copy.content}</label>
          <textarea id="qr-content" className="mt-2 min-h-32 w-full rounded-xl border p-3" value={value} onChange={(event) => setValue(event.target.value)} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-sm">{copy.foreground}<input aria-label={copy.foreground} className="mt-2 h-11 w-full" type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} /></label>
            <label className="text-sm">{copy.background}<input aria-label={copy.background} className="mt-2 h-11 w-full" type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label>
          </div>
          <button type="button" className="mt-4 rounded-xl border px-4 py-2" onClick={generate} disabled={busy}>{copy.generateQr}</button>
          {preview ? <div className="mt-4 flex flex-col items-center gap-3"><img src={preview} alt={copy.generatedAlt} className="max-w-full rounded-lg border p-2" /><a className="rounded-xl border px-4 py-2" download="flixo-qr.png" href={preview}>{copy.downloadPng}</a><a className="rounded-xl border px-4 py-2" download="flixo-qr.svg" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}>{copy.downloadSvg}</a></div> : null}
        </section>

        <section className="rounded-2xl border p-5" aria-labelledby="reader-title">
          <h2 id="reader-title" className="font-semibold">{copy.readImage}</h2>
          <p className="mt-2 text-sm opacity-70">{copy.readerDescription}</p>
          <input ref={inputRef} className="mt-4 block w-full rounded-xl border p-3" type="file" accept="image/*" onChange={(event) => { void scanFile(event.target.files?.[0]); }} />
          <button type="button" className="mt-3 rounded-xl border px-4 py-2" onClick={() => inputRef.current?.click()} disabled={busy}>{copy.chooseImage}</button>
          {scanResult ? <output className="mt-4 block rounded-xl border p-4 break-words" aria-label={copy.qrResult}>{scanResult}</output> : null}
        </section>
      </div>

      {error ? <p role="alert" className="rounded-xl border p-4">{error}</p> : null}
    </section>
  );
}
