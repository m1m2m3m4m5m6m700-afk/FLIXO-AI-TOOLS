import type { Locale } from '@/lib/i18n';

export type HomeCopy = Readonly<{
  language: string; dir: 'ltr' | 'rtl';
  nav: { tools: string; categories: string; privacy: string; switch: string };
  badge: string; eyebrow: string; heroTitle: string; heroLead: string;
  describe: string; searchLabel: string; searchPlaceholder: string; smartPalette: string;
  suggested: string; openDirectly: string; popular: string;
  trust: readonly [string, string][];
  quickDrop: string; quickDropTitle: string; quickDropLead: string; dropChoose: string; dropSupport: string;
  suggestedTool: string; openTool: string; toolbox: string; toolboxTitle: string; ready: string; empty: string;
  builtForFocus: string; finalTitle: string; finalLead: string; trySmart: string; all: string; browserMeta: string;
  ariaHome: string; ariaPrimary: string; ariaFindTool: string; ariaTrust: string; ariaCategories: string;
  quickTags: readonly string[];
}>;
const copy = (value: HomeCopy): HomeCopy => value;
const trust = (a: string, b: string, c: string) => [[a, b], [a.split(' ')[0], c]] as const;

const make = (locale: Locale, dir: 'ltr'|'rtl', labels: { tools:string; categories:string; privacy:string; hero:string; lead:string; search:string; drop:string; final:string }): HomeCopy => copy({
  language: locale, dir,
  nav:{tools:labels.tools,categories:labels.categories,privacy:labels.privacy,switch:locale==='en'?'العربية':'English'},
  badge:locale==='ar'?'الخصوصية أولًا · المتصفح أولًا':'Privacy-first · Browser-first', eyebrow:'FLIXO · SMART TOOLBOX',
  heroTitle:labels.hero, heroLead:labels.lead, describe:'Describe a task', searchLabel:labels.search, searchPlaceholder:'What do you need to do?', smartPalette:'Open smart command palette',
  suggested:'Suggested:', openDirectly:'open directly', popular:'Popular searches',
  trust: trust('Fast start','Direct routes without unnecessary steps.','Smart routing to ready tools.'),
  quickDrop:'QUICK-DROP', quickDropTitle:labels.drop, quickDropLead:'FLIXO inspects image inputs locally before recommending a ready tool.', dropChoose:'Drop or choose a file', dropSupport:'Images are supported for smart recommendations.',
  suggestedTool:'Suggested tool', openTool:'Open tool', toolbox:'TOOLBOX', toolboxTitle:'Start with useful tools.', ready:'ready', empty:'No matching tool yet.',
  builtForFocus:'BUILT FOR FOCUS', finalTitle:labels.final, finalLead:'FLIXO moves you from intent to action without unnecessary workflow.', trySmart:'Try Smart Intent', all:'All', browserMeta:'Browser-first · Instant start',
  ariaHome:'FLIXO home', ariaPrimary:'Primary navigation', ariaFindTool:'Find a tool', ariaTrust:'Trust signals', ariaCategories:'Tool categories', quickTags:['Image compressor','Background remover','OCR','AI image'],
});

export const HOME_I18N: Record<Locale, HomeCopy> = {
  en: make('en','ltr',{tools:'Tools',categories:'Categories',privacy:'Privacy',hero:'The right tool, <span>without the detour.</span>',lead:'Find the job, open the tool, finish fast. FLIXO uses local browser processing where the tool supports it.',search:'Search tools',drop:'Drop a file. We’ll point you to the right tool.',final:'One search. One useful result.'}),
  ar: copy({...make('ar','rtl',{tools:'الأدوات',categories:'التصنيفات',privacy:'الخصوصية',hero:'الأداة المناسبة، <span>بدون طريق طويل.</span>',lead:'حدد المهمة وافتح الأداة وأنجزها بسرعة؛ تستخدم FLIXO المعالجة المحلية داخل المتصفح حيث تدعمها الأداة.',search:'ابحث عن أداة',drop:'ضع ملفًا وسنوجّهك إلى الأداة المناسبة.',final:'بحث واحد. نتيجة مفيدة واحدة.'}),describe:'صف المهمة',searchLabel:'ابحث عن أداة',searchPlaceholder:'ماذا تريد أن تفعل؟',smartPalette:'فتح لوحة الأوامر الذكية',quickDrop:'السحب السريع',dropChoose:'اسحب ملفًا أو اختره',suggested:'مقترح:',openDirectly:'فتح مباشرة',popular:'عمليات البحث الشائعة',quickTags:['ضغط الصور','إزالة الخلفية','OCR','صورة AI']}),
  es: make('es','ltr',{tools:'Herramientas',categories:'Categorías',privacy:'Privacidad',hero:'La herramienta adecuada, <span>sin rodeos.</span>',lead:'Encuentra la tarea y termina rápido; FLIXO usa procesamiento local cuando es compatible.',search:'Buscar herramientas',drop:'Suelta un archivo y te mostraremos la herramienta correcta.',final:'Una búsqueda. Un resultado útil.'}),
  fr: make('fr','ltr',{tools:'Outils',categories:'Catégories',privacy:'Confidentialité',hero:'Le bon outil, <span>sans détour.</span>',lead:'Trouvez la tâche et terminez rapidement ; FLIXO utilise le traitement local quand il est disponible.',search:'Rechercher des outils',drop:'Déposez un fichier et nous indiquerons le bon outil.',final:'Une recherche. Un résultat utile.'}),
  de: make('de','ltr',{tools:'Werkzeuge',categories:'Kategorien',privacy:'Datenschutz',hero:'Das passende Tool, <span>ohne Umwege.</span>',lead:'Aufgabe finden, Tool öffnen, fertig; FLIXO nutzt lokale Browser-Verarbeitung, wenn sie unterstützt wird.',search:'Tools suchen',drop:'Datei ablegen und das passende Tool finden.',final:'Eine Suche. Ein nützliches Ergebnis.'}),
  hi: make('hi','ltr',{tools:'टूल्स',categories:'श्रेणियाँ',privacy:'गोपनीयता',hero:'सही टूल, <span>बिना भटकाव।</span>',lead:'काम चुनें, टूल खोलें और जल्दी पूरा करें; जहाँ संभव हो FLIXO स्थानीय ब्राउज़र प्रोसेसिंग का उपयोग करता है।',search:'टूल खोजें',drop:'फ़ाइल छोड़ें और सही टूल पाएँ।',final:'एक खोज। एक उपयोगी परिणाम।'}),
  id: make('id','ltr',{tools:'Alat',categories:'Kategori',privacy:'Privasi',hero:'Alat yang tepat, <span>tanpa jalan memutar.</span>',lead:'Temukan tugas, buka alat, selesai cepat; FLIXO memakai pemrosesan lokal bila didukung.',search:'Cari alat',drop:'Letakkan file dan kami tunjukkan alat yang tepat.',final:'Satu pencarian. Satu hasil berguna.'}),
  it: make('it','ltr',{tools:'Strumenti',categories:'Categorie',privacy:'Privacy',hero:'Lo strumento giusto, <span>senza deviazioni.</span>',lead:'Trova il lavoro, apri lo strumento e finisci in fretta; FLIXO usa l’elaborazione locale quando disponibile.',search:'Cerca strumenti',drop:'Rilascia un file e troviamo lo strumento giusto.',final:'Una ricerca. Un risultato utile.'}),
  ja: make('ja','ltr',{tools:'ツール',categories:'カテゴリ',privacy:'プライバシー',hero:'最適なツールを、<span>寄り道なしで。</span>',lead:'タスクを見つけてツールを開き、すぐ完了。対応時はブラウザ内でローカル処理します。',search:'ツールを検索',drop:'ファイルをドロップして最適なツールを探します。',final:'一つの検索。一つの有用な結果。'}),
  ko: make('ko','ltr',{tools:'도구',categories:'카테고리',privacy:'개인정보 보호',hero:'맞는 도구를, <span>돌아가지 않고.</span>',lead:'작업을 찾고 도구를 열어 빠르게 끝내세요. 지원되는 경우 로컬 브라우저 처리를 사용합니다.',search:'도구 검색',drop:'파일을 놓으면 맞는 도구를 안내합니다.',final:'한 번의 검색. 하나의 유용한 결과.'}),
  ms: make('ms','ltr',{tools:'Alat',categories:'Kategori',privacy:'Privasi',hero:'Alat yang tepat, <span>tanpa jalan berliku.</span>',lead:'Cari tugas, buka alat dan siapkan dengan cepat; FLIXO menggunakan pemprosesan tempatan apabila disokong.',search:'Cari alat',drop:'Lepaskan fail dan kami tunjukkan alat yang sesuai.',final:'Satu carian. Satu hasil berguna.'}),
  nl: make('nl','ltr',{tools:'Tools',categories:'Categorieën',privacy:'Privacy',hero:'Het juiste hulpmiddel, <span>zonder omweg.</span>',lead:'Vind de taak, open de tool en klaar; FLIXO gebruikt lokale verwerking waar mogelijk.',search:'Tools zoeken',drop:'Zet een bestand neer en vind de juiste tool.',final:'Eén zoekopdracht. Eén nuttig resultaat.'}),
  pl: make('pl','ltr',{tools:'Narzędzia',categories:'Kategorie',privacy:'Prywatność',hero:'Właściwe narzędzie, <span>bez objazdów.</span>',lead:'Znajdź zadanie, otwórz narzędzie i skończ szybko; FLIXO używa lokalnego przetwarzania, gdy jest dostępne.',search:'Szukaj narzędzi',drop:'Upuść plik, a wskażemy właściwe narzędzie.',final:'Jedno wyszukiwanie. Jeden użyteczny wynik.'}),
  pt: make('pt','ltr',{tools:'Ferramentas',categories:'Categorias',privacy:'Privacidade',hero:'A ferramenta certa, <span>sem desvio.</span>',lead:'Encontre a tarefa, abra a ferramenta e conclua rápido; a FLIXO usa processamento local quando disponível.',search:'Buscar ferramentas',drop:'Solte um arquivo e mostraremos a ferramenta certa.',final:'Uma busca. Um resultado útil.'}),
  ru: make('ru','ltr',{tools:'Инструменты',categories:'Категории',privacy:'Конфиденциальность',hero:'Нужный инструмент, <span>без лишних шагов.</span>',lead:'Найдите задачу, откройте инструмент и завершите быстро; FLIXO использует локальную обработку, когда это поддерживается.',search:'Поиск инструментов',drop:'Перетащите файл и найдите нужный инструмент.',final:'Один поиск. Один полезный результат.'}),
  sv: make('sv','ltr',{tools:'Verktyg',categories:'Kategorier',privacy:'Integritet',hero:'Rätt verktyg, <span>utan omvägar.</span>',lead:'Hitta uppgiften, öppna verktyget och bli klar snabbt; FLIXO använder lokal bearbetning när det stöds.',search:'Sök verktyg',drop:'Släpp en fil så pekar vi på rätt verktyg.',final:'En sökning. Ett användbart resultat.'}),
  th: make('th','ltr',{tools:'เครื่องมือ',categories:'หมวดหมู่',privacy:'ความเป็นส่วนตัว',hero:'เครื่องมือที่ใช่ <span>โดยไม่ต้องอ้อม</span>',lead:'ค้นหางาน เปิดเครื่องมือ และเสร็จได้เร็ว; FLIXO ใช้การประมวลผลในเบราว์เซอร์เมื่อรองรับ',search:'ค้นหาเครื่องมือ',drop:'วางไฟล์แล้วเราจะชี้ไปยังเครื่องมือที่เหมาะสม',final:'ค้นหาหนึ่งครั้ง ผลลัพธ์ที่มีประโยชน์หนึ่งรายการ'}),
  tr: make('tr','ltr',{tools:'Araçlar',categories:'Kategoriler',privacy:'Gizlilik',hero:'Doğru araç, <span>dolambaçsız.</span>',lead:'İşi bulun, aracı açın ve hızlıca tamamlayın; FLIXO desteklendiğinde yerel işleme kullanır.',search:'Araç ara',drop:'Bir dosya bırakın, doğru aracı gösterelim.',final:'Tek arama. Tek yararlı sonuç.'}),
  uk: make('uk','ltr',{tools:'Інструменти',categories:'Категорії',privacy:'Конфіденційність',hero:'Потрібний інструмент, <span>без зайвих кроків.</span>',lead:'Знайдіть завдання, відкрийте інструмент і завершіть швидко; FLIXO використовує локальну обробку, коли вона підтримується.',search:'Пошук інструментів',drop:'Перетягніть файл — ми покажемо потрібний інструмент.',final:'Один пошук. Один корисний результат.'}),
  vi: make('vi','ltr',{tools:'Công cụ',categories:'Danh mục',privacy:'Quyền riêng tư',hero:'Đúng công cụ, <span>không vòng vo.</span>',lead:'Tìm tác vụ, mở công cụ và hoàn tất nhanh; FLIXO xử lý cục bộ khi công cụ hỗ trợ.',search:'Tìm công cụ',drop:'Thả tệp để tìm công cụ phù hợp.',final:'Một tìm kiếm. Một kết quả hữu ích.'}),
};

export const DEFAULT_LOCALE: Locale = 'en';
export function getHomeCopy(locale: Locale): HomeCopy { return HOME_I18N[locale]; }
