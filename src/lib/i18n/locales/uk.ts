import type { Dictionary } from "./en";
import { en } from "./en";

export const uk: Dictionary = {
  ...en,

  "lang.name": "Українська",
  "lang.switch": "Змінити мову",

  "nav.tools": "Інструменти",
  "nav.categories": "Категорії",
  "nav.popular": "Популярні",
  "nav.why": "Чому Flixo",
  "nav.faq": "Поширені питання",
  "nav.openTranslator": "Відкрити перекладач",
  "nav.toggleTheme": "Змінити тему",
  "nav.toggleMenu": "Відкрити меню",

  "hero.badge": "Один простір, усі ШІ-інструменти",
  "hero.title": "Один простір для кожного ШІ-інструмента",
  "hero.description":
    "Переклад, зображення, PDF, письмо та утиліти — п'ять центрів інструментів у спокійному інтерфейсі. Без облікових записів і API-ключів; відкрийте інструмент і починайте.",
  "hero.promo.badge": "Нове",
  "hero.promo.body":
    "Спробуйте ШІ-вдосконалювач зображень — зробіть різкішим, збільшуйте та приберіть шум із ваших фото миттєво.",
  "hero.searchLabel": "Опишіть, що хочете зробити",
  "hero.searchPlaceholder":
    "Спробуйте: «перекласти арабською», «резюмувати PDF», «створити зображення»…",
  "hero.browse": "Переглянути інструменти",
  "hero.cta": "Спробувати перекладач",
  "hero.note": "Безкоштовно · Без реєстрації",

  "assistant.eyebrow": "ШІ-асистент",
  "assistant.title": "Скажіть, що потрібно — знайду відповідний інструмент",
  "assistant.placeholder": "Опишіть своє завдання… напр. «перекласти абзац французькою»",
  "assistant.button": "Знайти інструмент",
  "assistant.thinking": "Думаю…",
  "assistant.reset": "Запитати інше",
  "assistant.result.category": "Категорія",
  "assistant.result.matched": "Збіг",
  "assistant.result.open": "Відкрити інструмент",
  "assistant.result.soon": "Незабаром",
  "assistant.suggestion.translation":
    "Схоже, ви хочете перекласти текст. Перекладач готовий для вас.",
  "assistant.suggestion.images":
    "Ви хочете працювати із зображеннями. Інструментів для зображень ще немає — замовте його, і ми надамо йому пріоритет.",
  "assistant.suggestion.pdf":
    "Ви згадали PDF. Інструментів PDF ще немає — замовте його, і ми надамо йому пріоритет.",
  "assistant.suggestion.writing":
    "Вам потрібна допомога з письмом. Інструментів для письма ще немає — замовте його, і ми надамо йому пріоритет.",
  "assistant.suggestion.utilities":
    "Вам потрібна утиліта. Їх ще немає — замовте, і ми надамо пріоритет.",
  "assistant.suggestion.unknown":
    "Не впевнений, яка категорія підходить. Опишіть більше або замовте новий інструмент.",
  "assistant.empty.title": "Ваша пропозиція з'явиться тут",
  "assistant.empty.body":
    "Введіть завдання вище, і асистент спрямує вас до відповідного інструменту Flixo — або допоможе замовити новий.",

  "request.trigger": "Замовити інструмент",
  "request.title": "Замовити новий інструмент",
  "request.description": "Скажіть, що потрібно, і ми надамо цьому пріоритет у наступній версії.",
  "request.label": "Що має робити інструмент?",
  "request.placeholder": "напр. Інструмент, що конвертує PDF у Word зі збереженням форматування…",
  "request.submit": "Надіслати запит",
  "request.cancel": "Скасувати",
  "request.success":
    "Дякуємо! Ваш запит зафіксовано — ми надамо йому пріоритет у наступній версії.",
  "request.ok": "Готово",

  "categories.eyebrow": "Центри інструментів",
  "categories.title": "П'ять центрів, один простір",
  "categories.description":
    "Кожен інструмент Flixo належить до одного з цих центрів. Поки що це заповнювачі — фундамент готовий до зростання.",
  "categories.status.coming": "Незабаром",
  "categories.status.live": "{count} доступно",
  "categories.toolsLabel": "Заплановані інструменти",
  "status.live": "Доступно",
  "status.soon": "Скоро",

  "category.translation.name": "Центр перекладу",
  "category.translation.blurb":
    "Перекладайте, локалізуйте та субтитруйте понад 20 мовами з автоматичним розпізнаванням.",
  "category.translation.tools": "Перекладач · Локалізатор · Перекладач субтитрів",
  "category.images.name": "Інструменти для зображень",
  "category.images.blurb": "Створюйте, збільшуйте та видаляйте тло із зображень.",
  "category.images.tools": "Генератор зображень · Збільшувач · Видаляч тла",
  "category.pdf.name": "PDF-інструменти",
  "category.pdf.blurb": "Об'єднуйте, розділяйте, стискайте та конвертуйте PDF-документи.",
  "category.pdf.tools": "Об'єднати · Розділити · Стиснути · PDF у Word",
  "category.writing.name": "Письмо зі ШІ",
  "category.writing.blurb": "Резюмуйте, переписуйте та створюйте контент з правильним тоном.",
  "category.writing.tools": "Резюмер · Переписувач · Творець листів",
  "category.utilities.name": "Утиліти",
  "category.utilities.blurb":
    "Форматуйте, конвертуйте та генеруйте повсякденні технічні фрагменти.",
  "category.utilities.tools": "JSON-форматувальник · QR-генератор · Base64-конвертер",
  "category.developer.name": "Інструменти розробника",
  "category.developer.blurb": "Форматувальники, валідатори та генератори для щоденного коду.",
  "category.developer.tools": "JSON-форматувальник · XML-валідатор · Cron-парсер",

  "tool.back": "Усі інструменти",

  "why.eyebrow": "Чому Flixo",
  "why.title": "Створено, щоб усувати тертя, а не додавати функції",
  "why.speed.title": " миттєво за замовчуванням",
  "why.speed.body":
    "Інструменти відкриваються менш ніж за секунду і працюють у браузері — без черг і холодних стартів.",
  "why.consistency.title": "Послідовний інтерфейс",
  "why.consistency.body":
    "Кожен інструмент має однакове компонування, ярлики та дії з результатами, нічого вчити заново.",
  "why.privacy.title": "Приватність понад усе",
  "why.privacy.body":
    "Між сесіями нічого не зберігається. Ваш ввід залишається у вкладці, де ви його ввели.",
  "why.access.title": "Без облікових записів, без ключів",
  "why.access.body":
    "Без API-ключів, дашбордів чи керування місцями. Відкрийте інструмент і починайте.",
  "stats.tasks": "Оброблених завдань",
  "stats.languages": "Підтримувані мови",
  "stats.latency": "Медіана часу відповіді",
  "stats.uptime": "Доступність за останні 12 місяців",

  "faq.eyebrow": "Поширені питання",
  "faq.title": "Питання, відповіді",
  "faq.description": "Усе, що варто знати, перш ніж відкрити свій перший інструмент.",
  "faq.q1": "Flixo безкоштовний?",
  "faq.a1":
    "Так. Усі інструменти, доступні зараз у Flixo, безкоштовні та не вимагають облікового запису чи картки.",
  "faq.q2": "Як працює перекладач?",
  "faq.a2":
    "Ви вставляєте текст, обираєте вихідну та цільову мову (або залишаєте автоматичне розпізнавання), і Flixo повертає переклад. Поточна версія використовує локальний демонстраційний рушій для дослідження потоку офлайн.",
  "faq.q3": "Ви зберігаєте те, що я пишу?",
  "faq.a3":
    "Ні. Ввід і вивід існують лише у вашій вкладці браузера і зникають при закритті або очищенні інструмента.",
  "faq.q4": "Які мови підтримуються?",
  "faq.a4":
    "Двадцять мов латиницею, кирилицею, арабською, івритом, індійським і CJK письмом, плюс автоматичне розпізнавання джерела.",
  "faq.q5": "Коли з'являться інші інструменти?",
  "faq.a5":
    "П'ять центрів — Переклад, Зображення, PDF, Письмо та Утиліти — це дорожня карта. Нові інструменти під'єднуються до того ж реєстру і успадковують спільне компонування.",

  "footer.tagline":
    "Спокійний простір для кожного ШІ-інструмента, до якого ваша команда звертається протягом дня.",
  "footer.product": "Продукт",
  "footer.featured": "Рекомендовані інструменти",
  "footer.popular": "Популярні інструменти",
  "footer.numbers": "Цифри",
  "footer.categories": "Категорії",
  "footer.tools": "Інструменти",
  "footer.more": "Більше незабаром",
  "footer.rights": "© {year} Flixo. Усі права захищені.",
  "footer.built": "Створено для команд, які доставляють швидко.",

  "translator.pageDescription": "Автоматично розпізнає вихідну мову і перекладає за кілька секунд.",
  "translator.from": "З",
  "translator.to": "На",
  "translator.auto": "Автоматичне розпізнавання",
  "translator.swap": "Поміняти мови",
  "translator.inputPlaceholder": "Введіть або вставте текст для перекладу…",
  "translator.inputLabel": "Текст для перекладу",
  "translator.detected": "розпізнано {language}",
  "translator.copy": "Копіювати",
  "translator.copied": "Скопійовано",
  "translator.copyError": "Не вдалося скопіювати в буфер обміну.",
  "translator.genericError": "Щось пішло не так. Спробуйте ще раз.",
  "translator.clear": "Очистити",
  "translator.translate": "Перекласти",
  "translator.translating": "Переклад…",
  "translator.emptyTitle": "Ваш переклад з'явиться тут",
  "translator.emptyBody":
    "Оберіть цільову мову, введіть текст і натисніть «Перекласти». Автоматичне розпізнавання знайде джерело.",

  // Tool names + taglines (76 ready tools) — нативні українські технічні терміни.
  "tool.translator.name": "Перекладач ШІ",
  "tool.translator.tagline":
    "Перекладайте між 20+ мовами з автоматичним виявленням та миттєвим перемиканням.",
  "tool.image-enhancer.name": "Покращувач зображень ШІ",
  "tool.image-enhancer.tagline":
    "Збільшуйте роздільну здатність до 8x, відновлюйте обличчя, видаляйте шум і підвищуйте різкість.",
  "tool.image-compressor.name": "Стискач зображень",
  "tool.image-compressor.tagline": "Зменшуйте розмір файлів зображень безпосередньо у браузері.",
  "tool.background-remover.name": "Видалення фону",
  "tool.background-remover.tagline": "Вирізайте тло зображень і експортуйте прозорі PNG.",
  "tool.video-compressor.name": "Стискач відео",
  "tool.video-compressor.tagline":
    "Зменшуйте розмір відеофайлу з налаштовуваною якістю та параметрами виводу.",
  "tool.video-trimmer.name": "Обрізувач відео",
  "tool.video-trimmer.tagline":
    "Обрізайте вибрану частину відео з елементами керування початком і кінцем.",
  "tool.video-to-gif.name": "Відео у GIF",
  "tool.video-to-gif.tagline": "Конвертуйте підтримуваний відеофрагмент в анімований GIF.",
  "tool.audio-compressor.name": "Стискач аудіо",
  "tool.audio-compressor.tagline": "Стискайте аудіофайли, керуючи якістю та бітрейтом виводу.",
  "tool.audio-cutter.name": "Обрізувач аудіо",
  "tool.audio-cutter.tagline":
    "Вирізайте вибрану частину з аудіофайлу з елементами керування початком і кінцем.",
  "tool.text-to-speech.name": "Текст у мовлення",
  "tool.text-to-speech.tagline":
    "Перетворюйте написаний текст на природний голос із налаштовуваними голосами.",
  "tool.file-hash-generator.name": "Генератор хешу файлів",
  "tool.file-hash-generator.tagline":
    "Обчислюйте хеші MD5, SHA-1 і SHA-256 будь-якого файлу у браузері.",
  "tool.qr-generator.name": "Генератор QR-кодів",
  "tool.qr-generator.tagline": "Створюйте власні QR-коди для посилань, тексту, Wi-Fi та контактів.",
  "tool.barcode-generator.name": "Генератор штрихкодів",
  "tool.barcode-generator.tagline":
    "Генеруйте штрихкоди в різних форматах, готові до завантаження чи друку.",
  "tool.password-generator.name": "Генератор паролів",
  "tool.password-generator.tagline": "Створюйте надійні, безпечні паролі з індикатором ентропії.",
  "tool.password-checker.name": "Перевірка паролів",
  "tool.password-checker.tagline":
    "Перевіряйте надійність, ентропію та орієнтовний час зламу з практичними порадами.",
  "tool.word-counter.name": "Лічильник слів",
  "tool.word-counter.tagline":
    "Рахуйте слова, символи, речення та абзаци миттєво під час введення.",
  "tool.case-converter.name": "Конвертер регістру",
  "tool.case-converter.tagline":
    "Миттєво перемикайтеся між великими, малими літерами, заголовком та іншими форматами.",
  "tool.slug-generator.name": "Генератор slug-ів",
  "tool.slug-generator.tagline":
    "Перетворюйте заголовки на чисті, URL-сумісні slug-и з роздільниками та довжиною.",
  "tool.lorem-ipsum.name": "Lorem Ipsum",
  "tool.lorem-ipsum.tagline":
    "Генеруйте текст-заповнювач Lorem Ipsum з обраною кількістю абзаців або слів.",
  "tool.random-number.name": "Генератор випадкових чисел",
  "tool.random-number.tagline":
    "Генеруйте випадкові числа в діапазоні з опціями кількості та без дублікатів.",
  "tool.random-name.name": "Вибір випадкових імен",
  "tool.random-name.tagline":
    "Обирайте одне чи кілька випадкових імен зі списку з опцією без дублікатів.",
  "tool.json-formatter.name": "Форматувальник JSON",
  "tool.json-formatter.tagline":
    "Форматуйте, мінімізуйте та валідуйте JSON із власними параметрами відступів.",
  "tool.uuid-generator.name": "Генератор UUID",
  "tool.uuid-generator.tagline": "Створюйте унікальні ідентифікатори UUID (v4) швидко та пакетно.",
  "tool.xml-formatter.name": "Форматувальник XML",
  "tool.xml-formatter.tagline":
    "Форматуйте, мінімізуйте та валідуйте XML із власними параметрами відступів.",
  "tool.csv-viewer.name": "Переглядач CSV",
  "tool.csv-viewer.tagline":
    "Попередньо переглядайте дані CSV як таблицю з вибором роздільника та виявленням заголовків.",
  "tool.text-compare.name": "Порівнювач текстів",
  "tool.text-compare.tagline":
    "Порівнюйте два тексти рядок за рядком і підсвічуйте додавання, видалення та збіги.",
  "tool.qr-reader.name": "Зчитувач QR",
  "tool.qr-reader.tagline":
    "Скануйте та розшифровуйте QR-коди із зображень або камери у текст чи посилання.",
  "tool.find-and-replace.name": "Знайти і замінити",
  "tool.find-and-replace.tagline":
    "Знаходьте та замінюйте текст у довгих документах з опціональним regex і чутливістю до регістру.",
  "tool.remove-duplicate-lines.name": "Видалити дубльовані рядки",
  "tool.remove-duplicate-lines.tagline":
    "Видаляйте дубльовані рядки з нечутливим до регістру та чутливим до пробілів зіставленням.",
  "tool.remove-empty-lines.name": "Видалити порожні рядки",
  "tool.remove-empty-lines.tagline": "Миттєво видаляйте порожні рядки або рядки лише з пробілами.",
  "tool.text-cleaner.name": "Очищувач тексту",
  "tool.text-cleaner.tagline":
    "Очищуйте текст, видаляючи зайві пробіли, розриви рядків і небажані символи.",
  "tool.sort-lines.name": "Сортувати рядки",
  "tool.sort-lines.tagline":
    "Сортуйте рядки за абеткою, за довжиною або перемішуйте з опціями регістру та порожніх рядків.",
  "tool.reverse-text.name": "Реверс тексту",
  "tool.reverse-text.tagline":
    "Зворотно розміщуйте текст за символами, словами чи цілими рядками миттєво.",
  "tool.add-line-numbers.name": "Додати номери рядків",
  "tool.add-line-numbers.tagline":
    "Додавайте послідовні номери рядків з роздільниками, заповненням та зміщенням початку.",
  "tool.word-frequency.name": "Аналізатор частоти слів",
  "tool.word-frequency.tagline":
    "Аналізуйте частоту слів із сортуванням, чутливістю до регістру та фільтрами довжини.",
  "tool.unit-converter.name": "Конвертер одиниць",
  "tool.unit-converter.tagline": "Миттєво конвертуйте між одиницями довжини, ваги, об'єму тощо.",
  "tool.temperature-converter.name": "Конвертер температури",
  "tool.temperature-converter.tagline": "Швидко конвертуйте між Цельсієм, Фаренгейтом і Кельвіном.",
  "tool.base64-converter.name": "Конвертер Base64",
  "tool.base64-converter.tagline": "Кодуйте та декодуйте текст у Base64 і назад миттєво.",
  "tool.timestamp-converter.name": "Конвертер часових міток",
  "tool.timestamp-converter.tagline":
    "Конвертуйте часові мітки Unix у читабельні дати і назад, із підтримкою часових поясів.",
  "tool.csv-to-json.name": "CSV у JSON",
  "tool.csv-to-json.tagline":
    "Конвертуйте дані CSV у структурований JSON з автоматичним виявленням заголовків.",
  "tool.percentage-calculator.name": "Калькулятор відсотків",
  "tool.percentage-calculator.tagline":
    "Швидко та точно обчислюйте відсотки, збільшення та знижки.",
  "tool.bmi-calculator.name": "Калькулятор ІМТ",
  "tool.bmi-calculator.tagline": "Обчислюйте індекс маси тіла за вагою та зростом.",
  "tool.age-calculator.name": "Калькулятор віку",
  "tool.age-calculator.tagline": "Обчислюйте свій точний вік у роках, місяцях і днях.",
  "tool.meta-tag-generator.name": "Генератор мета-тегів",
  "tool.meta-tag-generator.tagline":
    "Створюйте HTML мета-теги для SEO з заголовком, описом і Open Graph.",
  "tool.url-encoder.name": "Кодувальник URL",
  "tool.url-encoder.tagline": "Миттєво кодуйте та декодуйте URL-адреси та компоненти URL.",
  "tool.html-entity-encoder.name": "Кодувальник HTML-сутностей",
  "tool.html-entity-encoder.tagline":
    "Перетворюйте спеціальні символи на HTML-сутності і назад у читабельний текст.",
  "tool.html-minifier.name": "Мінімізатор HTML",
  "tool.html-minifier.tagline": "Зменшуйте розмір HTML, видаляючи зайві пробіли та коментарі.",
  "tool.css-minifier.name": "Мінімізатор CSS",
  "tool.css-minifier.tagline": "Стискайте CSS, видаляючи пробіли, коментарі та надлишкові правила.",
  "tool.js-minifier.name": "Мінімізатор JS",
  "tool.js-minifier.tagline":
    "Мінімізуйте JavaScript, видаляючи пробіли та коментарі для меншого розміру.",
  "tool.json-validator.name": "Валідатор JSON",
  "tool.json-validator.tagline": "Валідуйте синтаксис JSON і миттєво знаходьте помилки.",
  "tool.regex-tester.name": "Тестер regex",
  "tool.regex-tester.tagline": "Тестуйте регулярні вирази та підсвічуйте збіги в реальному часі.",
  "tool.jwt-decoder.name": "Декодер JWT",
  "tool.jwt-decoder.tagline":
    "Декодуйте токени JWT і переглядайте вміст заголовка та корисного навантаження.",
  "tool.sql-formatter.name": "Форматувальник SQL",
  "tool.sql-formatter.tagline":
    "Форматуйте та мінімізуйте SQL-запити з ключовими словами великими літерами та налаштовуваними відступами.",
  "tool.markdown-preview.name": "Попередній перегляд Markdown",
  "tool.markdown-preview.tagline":
    "Пишіть Markdown і миттєво бачьте відрендерений HTML-попередній перегляд.",
  "tool.color-converter.name": "Конвертер кольорів",
  "tool.color-converter.tagline": "Конвертуйте між HEX, RGB і HSL та переглядайте колір.",
  "tool.cron-parser.name": "Аналізатор Cron",
  "tool.cron-parser.tagline":
    "Перекладайте cron-вирази зрозумілою мовою з розбивкою полів і наступними запусками.",
  "tool.xml-validator.name": "Валідатор XML",
  "tool.xml-validator.tagline":
    "Валідуйте коректність, баланс тегів і структуру XML з миттєвим звітом про помилки.",
  "tool.html-formatter.name": "Форматувальник HTML",
  "tool.html-formatter.tagline":
    "Форматуйте та мінімізуйте HTML з правильним вкладенням і налаштовуваними відступами.",
  "tool.yaml-formatter.name": "Форматувальник YAML",
  "tool.yaml-formatter.tagline":
    "Форматуйте та нормалізуйте YAML з налаштовуваними відступами та валідацією.",
  "tool.markdown-table-generator.name": "Генератор таблиць Markdown",
  "tool.markdown-table-generator.tagline":
    "Створюйте таблиці Markdown візуально та експортуйте їх готовими до вставляння.",
  "tool.css-gradient-generator.name": "Генератор градієнтів CSS",
  "tool.css-gradient-generator.tagline":
    "Проєктуйте лінійні, радіальні та конічні градієнти CSS з кольоровими зупинками та керуванням кутом.",
  "tool.audio-converter.name": "Конвертер аудіо",
  "tool.audio-converter.tagline": "Конвертуйте аудіофайли (MP3, OGG, FLAC тощо) у WAV у браузері.",
  "tool.video-converter.name": "Конвертер відео",
  "tool.video-converter.tagline": "Конвертуйте відео у MP4 (H.264) або AVI (MPEG-4) у браузері.",
  "tool.gif-maker.name": "Створювач GIF",
  "tool.gif-maker.tagline":
    "Створюйте анімований GIF із завантажених зображень або підтримуваного відео.",
  "tool.gif-compressor.name": "Стискач GIF",
  "tool.gif-compressor.tagline":
    "Зменшуйте розмір GIF-файлу, зберігаючи прийнятну візуальну якість.",
  "tool.image-to-gif.name": "Зображення у GIF",
  "tool.image-to-gif.tagline": "Створюйте анімований GIF із кількох завантажених зображень.",
  "tool.pdf-to-excel.name": "PDF у Excel",
  "tool.pdf-to-excel.tagline":
    "Конвертуйте відповідні таблиці та вміст PDF у файл, сумісний з Excel.",
  "tool.pdf-to-powerpoint.name": "PDF у PowerPoint",
  "tool.pdf-to-powerpoint.tagline":
    "Конвертуйте відповідні сторінки та вміст PDF у файл, сумісний з PowerPoint.",
  "tool.pdf-to-text.name": "PDF у текст",
  "tool.pdf-to-text.tagline": "Видобувайте текст, що вибирається, з документів PDF.",
  "tool.pdf-crop.name": "Обрізка PDF",
  "tool.pdf-crop.tagline": "Обрізайте сторінки PDF з налаштовуваними межами обрізки.",
  "tool.pdf-page-numbers.name": "Номери сторінок PDF",
  "tool.pdf-page-numbers.tagline": "Додавайте налаштовувані номери сторінок до сторінок PDF.",
  "tool.pdf-header-footer.name": "Верхній і нижній колонтитули PDF",
  "tool.pdf-header-footer.tagline":
    "Додавайте налаштовувані верхні та нижні колонтитули до сторінок PDF.",
  "tool.text-to-pdf.name": "Текст у PDF",
  "tool.text-to-pdf.tagline": "Конвертуйте введений або вставлений текст у PDF, що завантажується.",
  "tool.text-to-word.name": "Текст у Word",
  "tool.text-to-word.tagline":
    "Конвертуйте введений або вставлений текст у документ DOCX, що завантажується.",
  "tool.markdown-to-pdf.name": "Markdown у PDF",
  "tool.markdown-to-pdf.tagline": "Конвертуйте вміст Markdown у відформатований PDF.",
  "tool.markdown-to-word.name": "Markdown у Word",
  "tool.markdown-to-word.tagline": "Конвертуйте вміст Markdown у відформатований документ DOCX.",
};
