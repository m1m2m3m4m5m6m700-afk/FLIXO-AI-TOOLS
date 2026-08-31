import type { HomeCopy } from '../../data/home-locales';
import type { QuickFlowCopy } from '../../data/quickflow-locales';
import type { Locale } from './config';

export type HomeCopyOverride = Partial<HomeCopy>;
export type QuickFlowCopyOverride = Partial<QuickFlowCopy>;

/** Human-reviewed corrections and locale additions. */
export const HOME_COPY_OVERRIDES: Readonly<Partial<Record<Locale, HomeCopyOverride>>> = Object.freeze({
  ar: Object.freeze({ browserMeta: 'معالجة داخل المتصفح · بدء فوري', quickDrop: 'السحب السريع', builtForFocus: 'مصمم للتركيز' }),
  id: Object.freeze({ badge: 'Utamakan privasi · Utamakan browser', browserMeta: 'Di browser · Mulai instan', quickDrop: 'LETAKKAN CEPAT' }),
  pl: Object.freeze({ quickDrop: 'SZYBKIE DODAWANIE', browserMeta: 'W przeglądarce · Natychmiastowy start' }),
  tr: Object.freeze({ browserMeta: 'Tarayıcı öncelikli · Anında başla' }),
  sv: Object.freeze({ browserMeta: 'Webbläsare först · Starta direkt', trust: [['Webbläsare först', 'Lokal bearbetning där verktyget stöder det.'], ['Snabb start', 'Direkta vägar utan onödig introduktion.'], ['Smart dirigering', 'Vanliga uppgifter går direkt till det bästa tillgängliga verktyget.']] as [string,string][] }),
  ms: Object.freeze({
    language: 'ms', dir: 'ltr', nav: { tools: 'Alat', categories: 'Kategori', privacy: 'Privasi', switch: 'العربية' },
    badge: 'Privasi dahulu · Pelayar dahulu', eyebrow: 'FLIXO · KIT ALAT PINTAR', heroTitle: 'Alat yang tepat, <span>tanpa jalan berliku.</span>', heroLead: 'Cari tugasan, buka alat dan selesaikan dengan pantas. FLIXO mengekalkan pengalaman yang fokus dan menggunakan pemprosesan setempat dalam pelayar apabila disokong.',
    describe: 'Terangkan tugasan', searchLabel: 'Cari alat', searchPlaceholder: 'Apa yang anda mahu lakukan? Cuba “mampat imej”', smartPalette: 'Buka palet arahan pintar', suggested: 'Cadangan:', openDirectly: 'buka terus', popular: 'Carian popular',
    trust: [['Pelayar dahulu','Pemprosesan setempat apabila disokong.'],['Mula pantas','Laluan terus tanpa pendaftaran yang tidak perlu.'],['Penghalaan pintar','Tugasan biasa terus ke alat yang sesuai.']], quickDrop: 'JATUH PANTAS', quickDropTitle: 'Letakkan fail. Kami akan tunjukkan alat yang sesuai.', quickDropLead: 'FLIXO tidak memuat naik fail dari halaman utama. Jenis fail sahaja diperiksa secara setempat untuk mencadangkan alat sedia ada.', dropChoose: 'Letak atau pilih fail', dropSupport: 'Imej kini disokong untuk cadangan pintar.', suggestedTool: 'Alat dicadangkan', openTool: 'Buka alat', toolbox: 'KIT ALAT', toolboxTitle: 'Mulakan dengan alat yang benar-benar diperlukan.', ready: 'sedia', empty: 'Tiada alat yang sepadan. Cuba frasa lebih mudah atau buka Smart Intent dengan Ctrl K.',
    builtForFocus: 'DIBINA UNTUK FOKUS', finalTitle: 'Satu carian. Satu hasil berguna.', finalLead: 'FLIXO membawa anda daripada niat kepada tindakan tanpa menjadikan tugasan mudah sebagai aliran kerja rumit.', trySmart: 'Cuba Smart Intent', all: 'Semua', browserMeta: 'Pelayar dahulu · Mula serta-merta', ariaHome: 'Halaman utama FLIXO', ariaPrimary: 'Navigasi utama', ariaFindTool: 'Cari alat', ariaTrust: 'Isyarat kepercayaan', ariaCategories: 'Kategori alat', quickTags: ['Mampat imej','Buang latar','OCR','PDF','Imej AI'],
  }),
  uk: Object.freeze({
    language: 'uk', dir: 'ltr', nav: { tools: 'Інструменти', categories: 'Категорії', privacy: 'Приватність', switch: 'العربية' },
    badge: 'Приватність передусім · Браузер передусім', eyebrow: 'FLIXO · РОЗУМНИЙ НАБІР ІНСТРУМЕНТІВ', heroTitle: 'Потрібний інструмент, <span>без зайвих кроків.</span>', heroLead: 'Знайдіть завдання, відкрийте інструмент і завершіть його швидко. FLIXO зберігає фокус і використовує локальну обробку в браузері, коли вона підтримується.',
    describe: 'Опишіть завдання', searchLabel: 'Пошук інструментів', searchPlaceholder: 'Що потрібно зробити? Спробуйте «стиснути зображення»', smartPalette: 'Відкрити розумну панель команд', suggested: 'Рекомендовано:', openDirectly: 'відкрити безпосередньо', popular: 'Популярні пошуки',
    trust: [['Браузер передусім','Локальна обробка, коли підтримується.'],['Швидкий старт','Прямі шляхи без зайвої реєстрації.'],['Розумна маршрутизація','Типові завдання одразу переходять до потрібного інструмента.']], quickDrop: 'ШВИДКЕ ДОДАВАННЯ', quickDropTitle: 'Перетягніть файл. Ми підкажемо потрібний інструмент.', quickDropLead: 'FLIXO не завантажує файл із головної сторінки. Для рекомендації на місці перевіряється лише тип файлу.', dropChoose: 'Перетягніть або виберіть файл', dropSupport: 'Зараз для розумних рекомендацій підтримуються зображення.', suggestedTool: 'Рекомендований інструмент', openTool: 'Відкрити інструмент', toolbox: 'НАБІР ІНСТРУМЕНТІВ', toolboxTitle: 'Почніть з інструментів, які справді потрібні.', ready: 'готово', empty: 'Підходящого інструмента немає. Спробуйте простішу фразу або відкрийте Smart Intent через Ctrl K.',
    builtForFocus: 'СТВОРЕНО ДЛЯ ФОКУСУ', finalTitle: 'Один пошук. Один корисний результат.', finalLead: 'FLIXO проводить від наміру до дії, не перетворюючи просте завдання на складний робочий процес.', trySmart: 'Спробувати Smart Intent', all: 'Усі', browserMeta: 'Браузер передусім · Миттєвий старт', ariaHome: 'Головна FLIXO', ariaPrimary: 'Основна навігація', ariaFindTool: 'Знайти інструмент', ariaTrust: 'Сигнали довіри', ariaCategories: 'Категорії інструментів', quickTags: ['Стиснути зображення','Видалити фон','OCR','PDF','Зображення ШІ'],
  }),
});

export const QUICKFLOW_COPY_OVERRIDES: Readonly<Partial<Record<Locale, QuickFlowCopyOverride>>> = Object.freeze({
  ar: Object.freeze({ missing: 'تعذّر العثور على QuickFlow', processing: 'تتم المعالجة داخل المتصفح.', result: 'النتيجة جاهزة', failure: 'تعذّر إكمال مسار العمل.' }),
  id: Object.freeze({ failure: 'Alur kerja tidak dapat diselesaikan.', processing: 'Pemrosesan berlangsung di browser Anda.' }),
  pl: Object.freeze({ failure: 'Nie udało się ukończyć przepływu pracy.', processing: 'Przetwarzanie odbywa się w przeglądarce.' }),
  tr: Object.freeze({ failure: 'İş akışı tamamlanamadı.', processing: 'İşleme tarayıcınızda gerçekleştirilir.' }),
  sv: Object.freeze({ failure: 'Arbetsflödet kunde inte slutföras.', processing: 'Bearbetningen sker i webbläsaren.' }),
  ms: Object.freeze({ missing: 'QuickFlow tidak ditemui', processing: 'Pemprosesan berlaku dalam pelayar anda.', result: 'Hasil sudah sedia', failure: 'Aliran kerja tidak dapat diselesaikan.' }),
  uk: Object.freeze({ missing: 'QuickFlow не знайдено', processing: 'Обробка виконується у вашому браузері.', result: 'Результат готовий', failure: 'Не вдалося завершити робочий процес.' }),
});
