import type { Locale } from './config';

type LocaleMap = Readonly<Partial<Record<Locale, string>>>;

const UI: Record<string, LocaleMap> = {
  'Audio Noise Reducer': { ar:'مزيل ضوضاء الصوت', es:'Reductor de ruido de audio', fr:'Réducteur de bruit audio', de:'Audiogeräusch-Reduzierer', hi:'ऑडियो नॉइज़ रिड्यूसर', id:'Pengurang Kebisingan Audio', it:'Riduttore del rumore audio', ja:'オーディオノイズ低減', ko:'오디오 노이즈 제거기', ms:'Pengurang Bunyi Audio', nl:'Audiogeruisreductie', pl:'Reduktor szumów audio', pt:'Redutor de ruído de áudio', ru:'Подавление шума в аудио', sv:'Ljudbrusreducerare', th:'ตัวลดเสียงรบกวน', tr:'Ses Gürültüsü Azaltıcı', uk:'Зниження шуму аудіо', vi:'Trình giảm nhiễu âm thanh' },
  'Reduce steady background noise locally in your browser.': { ar:'قلّل ضوضاء الخلفية المستمرة محليًا داخل متصفحك.', es:'Reduce el ruido de fondo constante localmente en tu navegador.', fr:'Réduisez le bruit de fond constant localement dans votre navigateur.', de:'Reduzieren Sie gleichmäßige Hintergrundgeräusche lokal im Browser.', hi:'अपने ब्राउज़र में लगातार पृष्ठभूमि शोर को स्थानीय रूप से कम करें।', id:'Kurangi kebisingan latar yang stabil secara lokal di browser.', it:'Riduci il rumore di fondo costante localmente nel browser.', ja:'ブラウザー内で一定の背景ノイズをローカルに低減します。', ko:'브라우저에서 지속적인 배경 소음을 로컬로 줄입니다.', ms:'Kurangkan bunyi latar berterusan secara tempatan dalam pelayar.', nl:'Verminder constant achtergrondgeluid lokaal in je browser.', pl:'Lokalnie redukuj stały szum tła w przeglądarce.', pt:'Reduza o ruído de fundo constante localmente no navegador.', ru:'Локально уменьшайте постоянный фоновый шум в браузере.', sv:'Minska konstant bakgrundsbrus lokalt i webbläsaren.', th:'ลดเสียงรบกวนพื้นหลังคงที่ในเครื่องบนเบราว์เซอร์ของคุณ', tr:'Tarayıcınızda sabit arka plan gürültüsünü yerel olarak azaltın.', uk:'Локально зменшуйте постійний фоновий шум у браузері.', vi:'Giảm tiếng ồn nền ổn định ngay trong trình duyệt.' },
  'Choose audio': { ar:'اختر صوتًا', es:'Elegir audio', fr:'Choisir un audio', de:'Audio auswählen', hi:'ऑडियो चुनें', id:'Pilih audio', it:'Scegli audio', ja:'音声を選択', ko:'오디오 선택', ms:'Pilih audio', nl:'Audio kiezen', pl:'Wybierz audio', pt:'Escolher áudio', ru:'Выбрать аудио', sv:'Välj ljud', th:'เลือกเสียง', tr:'Ses seç', uk:'Виберіть аудіо', vi:'Chọn âm thanh' },
  'Reduction': { ar:'مستوى التخفيض', es:'Reducción', fr:'Réduction', de:'Reduktion', hi:'कमी', id:'Pengurangan', it:'Riduzione', ja:'低減量', ko:'감소량', ms:'Pengurangan', nl:'Reductie', pl:'Redukcja', pt:'Redução', ru:'Снижение', sv:'Reducering', th:'ระดับการลด', tr:'Azaltma', uk:'Зниження', vi:'Mức giảm' },
  'Decoding audio…': { ar:'جارٍ فك ترميز الصوت…', es:'Decodificando audio…', fr:'Décodage audio…', de:'Audio wird dekodiert…', hi:'ऑडियो डिकोड हो रहा है…', id:'Mendekode audio…', it:'Decodifica audio…', ja:'音声をデコード中…', ko:'오디오 디코딩 중…', ms:'Menyahkod audio…', nl:'Audio decoderen…', pl:'Dekodowanie audio…', pt:'Decodificando áudio…', ru:'Декодирование аудио…', sv:'Avkodar ljud…', th:'กำลังถอดรหัสเสียง…', tr:'Ses kodu çözülüyor…', uk:'Декодування аудіо…', vi:'Đang giải mã âm thanh…' },
  'Reducing noise…': { ar:'جارٍ تقليل الضوضاء…', es:'Reduciendo ruido…', fr:'Réduction du bruit…', de:'Rauschen wird reduziert…', hi:'शोर कम किया जा रहा है…', id:'Mengurangi kebisingan…', it:'Riduzione del rumore…', ja:'ノイズを低減中…', ko:'노이즈 감소 중…', ms:'Mengurangkan bunyi…', nl:'Ruis verminderen…', pl:'Redukowanie szumu…', pt:'Reduzindo ruído…', ru:'Снижение шума…', sv:'Minskar brus…', th:'กำลังลดเสียงรบกวน…', tr:'Gürültü azaltılıyor…', uk:'Зниження шуму…', vi:'Đang giảm nhiễu…' },
  'Noise reduction worker failed.': { ar:'فشل عامل تقليل الضوضاء.', es:'El procesador de reducción de ruido falló.', fr:'Le processeur de réduction du bruit a échoué.', de:'Der Prozess zur Geräuschreduzierung ist fehlgeschlagen.', hi:'शोर कम करने वाला वर्कर विफल हो गया।', id:'Worker pengurang kebisingan gagal.', it:'Il worker di riduzione del rumore ha avuto un errore.', ja:'ノイズ低減ワーカーに失敗しました。', ko:'노이즈 감소 워커가 실패했습니다.', ms:'Pekerja pengurangan bunyi gagal.', nl:'De ruisreductie-worker is mislukt.', pl:'Proces redukcji szumu zakończył się niepowodzeniem.', pt:'O processador de redução de ruído falhou.', ru:'Сбой модуля подавления шума.', sv:'Brusreduceringsprocessen misslyckades.', th:'ตัวประมวลผลลดเสียงรบกวนล้มเหลว', tr:'Gürültü azaltma işçisi başarısız oldu.', uk:'Модуль зниження шуму завершився помилкою.', vi:'Tác vụ giảm nhiễu đã thất bại.' },
  'Noise reduction failed.': { ar:'فشل تقليل الضوضاء.', es:'La reducción de ruido falló.', fr:'La réduction du bruit a échoué.', de:'Die Geräuschreduzierung ist fehlgeschlagen.', hi:'शोर कम करना विफल हुआ।', id:'Pengurangan kebisingan gagal.', it:'La riduzione del rumore non è riuscita.', ja:'ノイズ低減に失敗しました。', ko:'노이즈 감소에 실패했습니다.', ms:'Pengurangan bunyi gagal.', nl:'Ruisreductie mislukt.', pl:'Redukcja szumu nie powiodła się.', pt:'A redução de ruído falhou.', ru:'Подавление шума не удалось.', sv:'Brusreduceringen misslyckades.', th:'ลดเสียงรบกวนไม่สำเร็จ', tr:'Gürültü azaltma başarısız oldu.', uk:'Зниження шуму не вдалося.', vi:'Giảm nhiễu không thành công.' },
  'Processing…': { ar:'جارٍ المعالجة…', es:'Procesando…', fr:'Traitement…', de:'Verarbeitung…', hi:'प्रसंस्करण…', id:'Memproses…', it:'Elaborazione…', ja:'処理中…', ko:'처리 중…', ms:'Memproses…', nl:'Verwerken…', pl:'Przetwarzanie…', pt:'Processando…', ru:'Обработка…', sv:'Bearbetar…', th:'กำลังประมวลผล…', tr:'İşleniyor…', uk:'Обробка…', vi:'Đang xử lý…' },
  'Reduce Noise': { ar:'تقليل الضوضاء', es:'Reducir ruido', fr:'Réduire le bruit', de:'Rauschen reduzieren', hi:'शोर कम करें', id:'Kurangi kebisingan', it:'Riduci rumore', ja:'ノイズを低減', ko:'노이즈 줄이기', ms:'Kurangkan bunyi', nl:'Ruis verminderen', pl:'Redukuj szum', pt:'Reduzir ruído', ru:'Уменьшить шум', sv:'Minska brus', th:'ลดเสียงรบกวน', tr:'Gürültüyü azalt', uk:'Зменшити шум', vi:'Giảm nhiễu' },
  'Download WAV': { ar:'تنزيل WAV', es:'Descargar WAV', fr:'Télécharger WAV', de:'WAV herunterladen', hi:'WAV डाउनलोड करें', id:'Unduh WAV', it:'Scarica WAV', ja:'WAVをダウンロード', ko:'WAV 다운로드', ms:'Muat turun WAV', nl:'WAV downloaden', pl:'Pobierz WAV', pt:'Baixar WAV', ru:'Скачать WAV', sv:'Ladda ner WAV', th:'ดาวน์โหลด WAV', tr:'WAV indir', uk:'Завантажити WAV', vi:'Tải WAV' },
};

function translateText(value: string, locale: Locale): string {
  if (locale === 'en') return value;
  let next = value;
  for (const [source, translations] of Object.entries(UI)) {
    const target = translations[locale];
    if (!target) continue;
    next = next.replaceAll(source, target);
  }
  return next;
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
    const next = translateText(current, locale);
    if (next !== current) node.nodeValue = next;
  }
  root.querySelectorAll?.<HTMLElement>('[aria-label],[title],[placeholder]')?.forEach((element) => {
    for (const attribute of ['aria-label', 'title', 'placeholder'] as const) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const next = translateText(current, locale);
      if (next !== current) element.setAttribute(attribute, next);
    }
  });
}

export function installAudioNoiseReducerToolUiRuntimeLocalization(): () => void {
  if (typeof document === 'undefined' || !document.body) return () => undefined;
  const applyCurrent = () => {
    const locale = (document.documentElement.lang.split('-')[0] || 'en') as Locale;
    if (locale !== 'en') apply(document.body, locale);
  };
  applyCurrent();
  const observer = new MutationObserver(applyCurrent);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });
  return () => observer.disconnect();
}
