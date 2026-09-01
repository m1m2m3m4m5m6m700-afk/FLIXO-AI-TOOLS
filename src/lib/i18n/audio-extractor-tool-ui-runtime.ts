import type { Locale } from './config';

type LocaleMap = Readonly<Partial<Record<Locale, string>>>;
const UI: Record<string, LocaleMap> = {
  'Audio Extractor & Muter': { ar:'استخراج الصوت وكتمه', es:'Extractor y silenciador de audio', fr:'Extracteur et sourdine audio', de:'Audio-Extraktor und Stummschaltung', hi:'ऑडियो एक्सट्रैक्टर और म्यूट', id:'Ekstraktor & Pembisukan Audio', it:'Estrattore e silenziatore audio', ja:'音声抽出＆ミュート', ko:'오디오 추출 및 음소거', ms:'Pengekstrak & Pembisuan Audio', nl:'Audio extraheren en dempen', pl:'Ekstraktor i wyciszanie audio', pt:'Extrator e silenciador de áudio', ru:'Извлечение и отключение аудио', sv:'Ljudextraherare och avstängning', th:'ตัวแยกและปิดเสียงวิดีโอ', tr:'Ses Çıkarıcı ve Sessize Alma', uk:'Витягування та вимкнення аудіо', vi:'Trình trích xuất & tắt tiếng' },
  'Extract audio or remove audio from a video locally in your browser.': { ar:'استخرج الصوت أو أزله من الفيديو محليًا داخل المتصفح.', es:'Extrae o elimina el audio de un vídeo localmente en tu navegador.', fr:'Extrayez ou supprimez l’audio d’une vidéo localement dans votre navigateur.', de:'Audio aus einem Video lokal im Browser extrahieren oder entfernen.', hi:'अपने ब्राउज़र में वीडियो से ऑडियो स्थानीय रूप से निकालें या हटाएँ।', id:'Ekstrak atau hapus audio dari video secara lokal di browser Anda.', it:'Estrai o rimuovi l’audio da un video localmente nel browser.', ja:'ブラウザー内で動画から音声をローカルに抽出または削除します。', ko:'브라우저에서 동영상의 오디오를 로컬로 추출하거나 제거합니다.', ms:'Ekstrak atau buang audio daripada video secara tempatan dalam pelayar anda.', nl:'Extraheer of verwijder audio lokaal uit een video in je browser.', pl:'Wyodrębnij lub usuń dźwięk z filmu lokalnie w przeglądarce.', pt:'Extraia ou remova o áudio de um vídeo localmente no navegador.', ru:'Локально извлекайте или удаляйте аудио из видео в браузере.', sv:'Extrahera eller ta bort ljud från en video lokalt i webbläsaren.', th:'แยกหรือลบเสียงออกจากวิดีโอในเครื่องบนเบราว์เซอร์ของคุณ', tr:'Tarayıcınızda videodan sesi yerel olarak çıkarın veya kaldırın.', uk:'Локально витягайте або видаляйте аудіо з відео у браузері.', vi:'Trích xuất hoặc xóa âm thanh khỏi video ngay trong trình duyệt.' },
  'Select a video file': { ar:'اختر ملف فيديو', es:'Seleccionar un archivo de vídeo', fr:'Sélectionner un fichier vidéo', de:'Videodatei auswählen', hi:'वीडियो फ़ाइल चुनें', id:'Pilih berkas video', it:'Seleziona un file video', ja:'動画ファイルを選択', ko:'비디오 파일 선택', ms:'Pilih fail video', nl:'Videobestand selecteren', pl:'Wybierz plik wideo', pt:'Selecionar um arquivo de vídeo', ru:'Выбрать видеофайл', sv:'Välj en videofil', th:'เลือกไฟล์วิดีโอ', tr:'Video dosyası seç', uk:'Виберіть відеофайл', vi:'Chọn tệp video' },
  'Video file': { ar:'ملف فيديو', es:'Archivo de vídeo', fr:'Fichier vidéo', de:'Videodatei', hi:'वीडियो फ़ाइल', id:'Berkas video', it:'File video', ja:'動画ファイル', ko:'비디오 파일', ms:'Fail video', nl:'Videobestand', pl:'Plik wideo', pt:'Arquivo de vídeo', ru:'Видеофайл', sv:'Videofil', th:'ไฟล์วิดีโอ', tr:'Video dosyası', uk:'Відеофайл', vi:'Tệp video' },
  'Reading video…': { ar:'جارٍ قراءة الفيديو…', es:'Leyendo vídeo…', fr:'Lecture de la vidéo…', de:'Video wird gelesen…', hi:'वीडियो पढ़ा जा रहा है…', id:'Membaca video…', it:'Lettura del video…', ja:'動画を読み込み中…', ko:'비디오 읽는 중…', ms:'Membaca video…', nl:'Video lezen…', pl:'Odczytywanie wideo…', pt:'Lendo vídeo…', ru:'Чтение видео…', sv:'Läser video…', th:'กำลังอ่านวิดีโอ…', tr:'Video okunuyor…', uk:'Читання відео…', vi:'Đang đọc video…' },
  'Unable to read video': { ar:'تعذر قراءة الفيديو', es:'No se pudo leer el vídeo', fr:'Impossible de lire la vidéo', de:'Video konnte nicht gelesen werden', hi:'वीडियो पढ़ा नहीं जा सका', id:'Tidak dapat membaca video', it:'Impossibile leggere il video', ja:'動画を読み取れません', ko:'비디오를 읽을 수 없습니다', ms:'Tidak dapat membaca video', nl:'Kan video niet lezen', pl:'Nie można odczytać wideo', pt:'Não foi possível ler o vídeo', ru:'Не удалось прочитать видео', sv:'Kunde inte läsa video', th:'ไม่สามารถอ่านวิดีโอได้', tr:'Video okunamadı', uk:'Не вдалося прочитати відео', vi:'Không thể đọc video' },
  'Extract audio': { ar:'استخراج الصوت', es:'Extraer audio', fr:'Extraire l’audio', de:'Audio extrahieren', hi:'ऑडियो निकालें', id:'Ekstrak audio', it:'Estrai audio', ja:'音声を抽出', ko:'오디오 추출', ms:'Ekstrak audio', nl:'Audio extraheren', pl:'Wyodrębnij audio', pt:'Extrair áudio', ru:'Извлечь аудио', sv:'Extrahera ljud', th:'แยกเสียง', tr:'Sesi çıkar', uk:'Витягти аудіо', vi:'Trích xuất âm thanh' },
  'Mute video': { ar:'كتم الفيديو', es:'Silenciar vídeo', fr:'Mettre la vidéo en sourdine', de:'Video stummschalten', hi:'वीडियो म्यूट करें', id:'Bisukan video', it:'Disattiva audio video', ja:'動画をミュート', ko:'비디오 음소거', ms:'Redam video', nl:'Video dempen', pl:'Wycisz wideo', pt:'Silenciar vídeo', ru:'Отключить звук видео', sv:'Stäng av ljudet', th:'ปิดเสียงวิดีโอ', tr:'Videoyu sessize al', uk:'Вимкнути звук відео', vi:'Tắt tiếng video' },
  'Action': { ar:'الإجراء', es:'Acción', fr:'Action', de:'Aktion', hi:'क्रिया', id:'Tindakan', it:'Azione', ja:'操作', ko:'작업', ms:'Tindakan', nl:'Actie', pl:'Akcja', pt:'Ação', ru:'Действие', sv:'Åtgärd', th:'การทำงาน', tr:'İşlem', uk:'Дія', vi:'Tác vụ' },
  'Start (seconds)': { ar:'البداية (بالثواني)', es:'Inicio (segundos)', fr:'Début (secondes)', de:'Start (Sekunden)', hi:'शुरुआत (सेकंड)', id:'Mulai (detik)', it:'Inizio (secondi)', ja:'開始（秒）', ko:'시작(초)', ms:'Mula (saat)', nl:'Start (seconden)', pl:'Początek (sekundy)', pt:'Início (segundos)', ru:'Начало (секунды)', sv:'Start (sekunder)', th:'เริ่มต้น (วินาที)', tr:'Başlangıç (saniye)', uk:'Початок (секунди)', vi:'Bắt đầu (giây)' },
  'End (seconds)': { ar:'النهاية (بالثواني)', es:'Fin (segundos)', fr:'Fin (secondes)', de:'Ende (Sekunden)', hi:'अंत (सेकंड)', id:'Selesai (detik)', it:'Fine (secondi)', ja:'終了（秒）', ko:'끝(초)', ms:'Akhir (saat)', nl:'Einde (seconden)', pl:'Koniec (sekundy)', pt:'Fim (segundos)', ru:'Конец (секунды)', sv:'Slut (sekunder)', th:'สิ้นสุด (วินาที)', tr:'Bitiş (saniye)', uk:'Кінець (секунди)', vi:'Kết thúc (giây)' },
  'Reading video': { ar:'قراءة الفيديو', es:'Leyendo vídeo', fr:'Lecture de la vidéo', de:'Video wird gelesen', hi:'वीडियो पढ़ा जा रहा है', id:'Membaca video', it:'Lettura del video', ja:'動画を読み込み中', ko:'비디오 읽는 중', ms:'Membaca video', nl:'Video lezen', pl:'Odczytywanie wideo', pt:'Lendo vídeo', ru:'Чтение видео', sv:'Läser video', th:'กำลังอ่านวิดีโอ', tr:'Video okunuyor', uk:'Читання відео', vi:'Đang đọc video' },
  'Processing failed': { ar:'فشلت المعالجة', es:'La operación falló', fr:'Échec du traitement', de:'Verarbeitung fehlgeschlagen', hi:'प्रसंस्करण विफल', id:'Pemrosesan gagal', it:'Elaborazione non riuscita', ja:'処理に失敗しました', ko:'처리에 실패했습니다', ms:'Pemprosesan gagal', nl:'Verwerking mislukt', pl:'Przetwarzanie nie powiodło się', pt:'Falha no processamento', ru:'Ошибка обработки', sv:'Bearbetningen misslyckades', th:'การประมวลผลล้มเหลว', tr:'İşleme başarısız oldu', uk:'Обробка не вдалася', vi:'Xử lý thất bại' },
  'Download output': { ar:'تنزيل الناتج', es:'Descargar resultado', fr:'Télécharger le résultat', de:'Ausgabe herunterladen', hi:'आउटपुट डाउनलोड करें', id:'Unduh hasil', it:'Scarica risultato', ja:'出力をダウンロード', ko:'결과 다운로드', ms:'Muat turun output', nl:'Uitvoer downloaden', pl:'Pobierz wynik', pt:'Baixar resultado', ru:'Скачать результат', sv:'Ladda ner resultat', th:'ดาวน์โหลดผลลัพธ์', tr:'Çıktıyı indir', uk:'Завантажити результат', vi:'Tải kết quả' },
};

function translate(value: string, locale: Locale): string {
  if (locale === 'en') return value;
  const trimmed = value.trim();
  const translated = UI[trimmed]?.[locale] ?? UI[value]?.[locale];
  return translated ? value.replace(trimmed, translated) : value;
}
function apply(root: ParentNode, locale: Locale): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!node.nodeValue?.trim() || !parent || parent.closest('script,style,pre,textarea,[contenteditable="true"],[data-no-auto-i18n]')) continue;
    nodes.push(node);
  }
  for (const node of nodes) {
    const current = node.nodeValue ?? '';
    const next = translate(current, locale);
    if (next !== current) node.nodeValue = next;
  }
  root.querySelectorAll?.<HTMLElement>('[aria-label],[title],[placeholder]')?.forEach((element) => {
    for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const next = translate(current, locale);
      if (next !== current) element.setAttribute(attribute, next);
    }
  });
}
export function installAudioExtractorToolUiRuntimeLocalization(): () => void {
  if (typeof document === 'undefined' || !document.body) return () => undefined;
  const applyCurrent = () => {
    const locale = (document.documentElement.lang.split('-')[0] || 'en') as Locale;
    if (locale !== 'en') apply(document.body, locale);
  };
  applyCurrent();
  const observer = new MutationObserver(applyCurrent);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label','title','placeholder'] });
  return () => observer.disconnect();
}
