import type { Locale } from './config';

type LocaleMap = Readonly<Partial<Record<Locale, string>>>;

const UI: Record<string, LocaleMap> = {
  'AI Vocal & Instrumental Remover': { ar:'إزالة الغناء والموسيقى بالذكاء الاصطناعي', es:'Eliminador de voz e instrumental con IA', fr:'Séparateur de voix et instrumental IA', de:'KI-Stimmen- und Instrumentaltrenner', hi:'एआई वोकल और इंस्ट्रुमेंटल रिमूवर', id:'Penghapus Vokal & Instrumental AI', it:'Rimozione voce e strumentale IA', ja:'AIボーカル＆インストゥルメンタル分離', ko:'AI 보컬 및 반주 제거기', ms:'Pembuang Vokal & Instrumental AI', nl:'AI Vocalen- en Instrumentaalscheider', pl:'Usuwanie wokalu i instrumentalu AI', pt:'Removedor de vocais e instrumental com IA', ru:'Удаление вокала и инструментала ИИ', sv:'AI-separerare för sång och instrumental', th:'เครื่องแยกเสียงร้องและดนตรี AI', tr:'Yapay Zeka Vokal ve Enstrümantal Ayırıcı', uk:'Видалення вокалу та інструменталу ШІ', vi:'Trình tách giọng hát & nhạc nền AI' },
  'Local Demucs separation. The model downloads on first use and stays out of the initial bundle.': { ar:'فصل محلي باستخدام Demucs. يُنزّل النموذج عند أول استخدام ويبقى خارج الحزمة الأولية.', es:'Separación local con Demucs. El modelo se descarga en el primer uso y queda fuera del paquete inicial.', fr:'Séparation locale avec Demucs. Le modèle est téléchargé à la première utilisation et reste hors du bundle initial.', de:'Lokale Demucs-Trennung. Das Modell wird beim ersten Einsatz geladen und bleibt außerhalb des initialen Bundles.', hi:'Demucs द्वारा स्थानीय पृथक्करण। मॉडल पहली बार उपयोग पर डाउनलोड होता है और प्रारंभिक बंडल से बाहर रहता है.', id:'Pemisahan Demucs lokal. Model diunduh saat penggunaan pertama dan tetap di luar bundel awal.', it:'Separazione locale con Demucs. Il modello viene scaricato al primo utilizzo e resta fuori dal bundle iniziale.', ja:'Demucsによるローカル分離。モデルは初回使用時にダウンロードされ、初期バンドルには含まれません。', ko:'Demucs 로컬 분리. 모델은 첫 사용 시 다운로드되며 초기 번들에는 포함되지 않습니다.', ms:'Pemisahan Demucs tempatan. Model dimuat turun pada penggunaan pertama dan kekal di luar himpunan awal.', nl:'Lokale Demucs-scheiding. Het model wordt bij eerste gebruik gedownload en blijft buiten de initiële bundel.', pl:'Lokalny podział Demucs. Model jest pobierany przy pierwszym użyciu i pozostaje poza początkowym pakietem.', pt:'Separação local com Demucs. O modelo é baixado no primeiro uso e fica fora do pacote inicial.', ru:'Локальное разделение Demucs. Модель загружается при первом использовании и не входит в начальный пакет.', sv:'Lokal separation med Demucs. Modellen laddas ner vid första användningen och hålls utanför det initiala paketet.', th:'การแยกเสียงด้วย Demucs ในเครื่อง โมเดลจะดาวน์โหลดเมื่อใช้ครั้งแรกและอยู่นอกแพ็กเกจเริ่มต้น', tr:'Demucs ile yerel ayırma. Model ilk kullanımda indirilir ve başlangıç paketinin dışında tutulur.', uk:'Локальне розділення Demucs. Модель завантажується під час першого використання й не входить до початкового пакета.', vi:'Tách cục bộ bằng Demucs. Mô hình được tải ở lần dùng đầu tiên và nằm ngoài gói ban đầu.' },
  'Audio file': { ar:'ملف صوتي', es:'Archivo de audio', fr:'Fichier audio', de:'Audiodatei', hi:'ऑडियो फ़ाइल', id:'Berkas audio', it:'File audio', ja:'音声ファイル', ko:'오디오 파일', ms:'Fail audio', nl:'Audiobestand', pl:'Plik audio', pt:'Arquivo de áudio', ru:'Аудиофайл', sv:'Ljudfil', th:'ไฟล์เสียง', tr:'Ses dosyası', uk:'Аудіофайл', vi:'Tệp âm thanh' },
  'Choose an audio file.': { ar:'اختر ملفًا صوتيًا.', es:'Elige un archivo de audio.', fr:'Choisissez un fichier audio.', de:'Wählen Sie eine Audiodatei.', hi:'एक ऑडियो फ़ाइल चुनें।', id:'Pilih berkas audio.', it:'Scegli un file audio.', ja:'音声ファイルを選択してください。', ko:'오디오 파일을 선택하세요.', ms:'Pilih fail audio.', nl:'Kies een audiobestand.', pl:'Wybierz plik audio.', pt:'Escolha um arquivo de áudio.', ru:'Выберите аудиофайл.', sv:'Välj en ljudfil.', th:'เลือกไฟล์เสียง', tr:'Bir ses dosyası seçin.', uk:'Виберіть аудіофайл.', vi:'Chọn tệp âm thanh.' },
  'Please choose an audio file.': { ar:'يرجى اختيار ملف صوتي.', es:'Elige un archivo de audio.', fr:'Veuillez choisir un fichier audio.', de:'Bitte wählen Sie eine Audiodatei.', hi:'कृपया एक ऑडियो फ़ाइल चुनें।', id:'Pilih berkas audio.', it:'Scegli un file audio.', ja:'音声ファイルを選択してください。', ko:'오디오 파일을 선택하세요.', ms:'Sila pilih fail audio.', nl:'Kies een audiobestand.', pl:'Wybierz plik audio.', pt:'Escolha um arquivo de áudio.', ru:'Выберите аудиофайл.', sv:'Välj en ljudfil.', th:'โปรดเลือกไฟล์เสียง', tr:'Lütfen bir ses dosyası seçin.', uk:'Виберіть аудіофайл.', vi:'Vui lòng chọn tệp âm thanh.' },
  'Duration: ': { ar:'المدة: ', es:'Duración: ', fr:'Durée : ', de:'Dauer: ', hi:'अवधि: ', id:'Durasi: ', it:'Durata: ', ja:'長さ: ', ko:'길이: ', ms:'Tempoh: ', nl:'Duur: ', pl:'Czas trwania: ', pt:'Duração: ', ru:'Длительность: ', sv:'Längd: ', th:'ระยะเวลา: ', tr:'Süre: ', uk:'Тривалість: ', vi:'Thời lượng: ' },
  'Backend': { ar:'المحرك', es:'Motor', fr:'Moteur', de:'Backend', hi:'बैकएंड', id:'Backend', it:'Backend', ja:'バックエンド', ko:'백엔드', ms:'Backend', nl:'Backend', pl:'Backend', pt:'Backend', ru:'Движок', sv:'Motor', th:'แบ็กเอนด์', tr:'Arka uç', uk:'Рушій', vi:'Nền tảng xử lý' },
  'Model: ~170 MB first download': { ar:'النموذج: تنزيل أولي بحجم ~170 ميجابايت', es:'Modelo: ~170 MB en la primera descarga', fr:'Modèle : ~170 Mo au premier téléchargement', de:'Modell: ~170 MB beim ersten Download', hi:'मॉडल: पहली डाउनलोड ~170 MB', id:'Model: ~170 MB saat unduhan pertama', it:'Modello: ~170 MB al primo download', ja:'モデル：約170MB（初回ダウンロード）', ko:'모델: 첫 다운로드 약 170MB', ms:'Model: ~170 MB semasa muat turun pertama', nl:'Model: ~170 MB bij eerste download', pl:'Model: ~170 MB przy pierwszym pobraniu', pt:'Modelo: ~170 MB no primeiro download', ru:'Модель: ~170 МБ при первой загрузке', sv:'Modell: ~170 MB vid första nedladdning', th:'โมเดล: ~170 MB ในการดาวน์โหลดครั้งแรก', tr:'Model: ilk indirmede ~170 MB', uk:'Модель: ~170 МБ під час першого завантаження', vi:'Mô hình: ~170 MB ở lần tải đầu tiên' },
  'Separate vocals / instrumental': { ar:'فصل الغناء / الموسيقى', es:'Separar voz / instrumental', fr:'Séparer voix / instrumental', de:'Gesang / Instrumental trennen', hi:'वोकल / इंस्ट्रुमेंटल अलग करें', id:'Pisahkan vokal / instrumental', it:'Separa voce / strumentale', ja:'ボーカル / インストゥルメンタルを分離', ko:'보컬 / 반주 분리', ms:'Asingkan vokal / instrumental', nl:'Vocalen / instrumentaal scheiden', pl:'Oddziel wokal / instrumental', pt:'Separar vocais / instrumental', ru:'Разделить вокал / инструментал', sv:'Separera sång / instrumental', th:'แยกเสียงร้อง / ดนตรี', tr:'Vokal / enstrümantal ayır', uk:'Відокремити вокал / інструментал', vi:'Tách giọng hát / nhạc nền' },
  'Separate vocals…': { ar:'فصل الغناء…', es:'Separando voz…', fr:'Séparation de la voix…', de:'Gesang wird getrennt…', hi:'वोकल अलग किए जा रहे हैं…', id:'Memisahkan vokal…', it:'Separazione voce…', ja:'ボーカルを分離中…', ko:'보컬 분리 중…', ms:'Mengasingkan vokal…', nl:'Vocalen scheiden…', pl:'Oddzielanie wokalu…', pt:'Separando vocais…', ru:'Разделение вокала…', sv:'Separerar sång…', th:'กำลังแยกเสียงร้อง…', tr:'Vokal ayrılıyor…', uk:'Відокремлення вокалу…', vi:'Đang tách giọng hát…' },
  'Download Vocals': { ar:'تنزيل الغناء', es:'Descargar voz', fr:'Télécharger la voix', de:'Gesang herunterladen', hi:'वोकल डाउनलोड करें', id:'Unduh vokal', it:'Scarica voce', ja:'ボーカルをダウンロード', ko:'보컬 다운로드', ms:'Muat turun vokal', nl:'Vocalen downloaden', pl:'Pobierz wokal', pt:'Baixar vocais', ru:'Скачать вокал', sv:'Ladda ner sång', th:'ดาวน์โหลดเสียงร้อง', tr:'Vokali indir', uk:'Завантажити вокал', vi:'Tải giọng hát' },
  'Download Instrumental': { ar:'تنزيل الموسيقى', es:'Descargar instrumental', fr:'Télécharger l’instrumental', de:'Instrumental herunterladen', hi:'इंस्ट्रुमेंटल डाउनलोड करें', id:'Unduh instrumental', it:'Scarica strumentale', ja:'インストゥルメンタルをダウンロード', ko:'반주 다운로드', ms:'Muat turun instrumental', nl:'Instrumentaal downloaden', pl:'Pobierz instrumental', pt:'Baixar instrumental', ru:'Скачать инструментал', sv:'Ladda ner instrumental', th:'ดาวน์โหลดดนตรี', tr:'Enstrümantali indir', uk:'Завантажити інструментал', vi:'Tải nhạc nền' },
};

function translate(value: string, locale: Locale): string {
  if (locale === 'en') return value;
  const key = value.trim();
  const exact = UI[key]?.[locale];
  return exact ? value.replace(key, exact) : value;
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

export function installAiVocalToolUiRuntimeLocalization(): () => void {
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
