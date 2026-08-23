export const HOME_EN = {
  language: 'en',
  dir: 'ltr',
  nav: { tools: 'Tools', categories: 'Categories', privacy: 'Privacy', switch: 'العربية' },
  badge: 'Privacy-first · Browser-first',
  eyebrow: 'FLIXO · SMART TOOLBOX',
  heroTitle: 'The right tool, <span>without the detour.</span>',
  heroLead: 'Find the job, open the tool, finish fast. FLIXO keeps the experience focused and uses local browser processing where the tool supports it.',
  describe: 'Describe a task', searchLabel: 'Find a tool', searchPlaceholder: 'What do you need to do? Try “compress image”', smartPalette: 'Open smart command palette',
  suggested: 'Suggested:', openDirectly: 'open directly', popular: 'Popular searches',
  trust: [['Browser-first', 'Local processing where supported by the tool.'], ['Fast to start', 'Direct routes without unnecessary onboarding walls.'], ['Smart routing', 'Common tasks can jump straight to the best ready tool.']],
  quickDrop: 'QUICK-DROP', quickDropTitle: 'Drop a file. We’ll point you to the right tool.', quickDropLead: 'FLIXO does not upload your file from the homepage. It only inspects the file type locally to recommend an existing tool.',
  dropChoose: 'Drop or choose a file', dropSupport: 'Images are currently supported for smart recommendations.', suggestedTool: 'Suggested tool', openTool: 'Open tool',
  toolbox: 'TOOLBOX', toolboxTitle: 'Start with the tools people actually need.', ready: 'ready', empty: 'No matching tool yet. Try a simpler phrase or open Smart Intent with Ctrl K.',
  builtForFocus: 'BUILT FOR FOCUS', finalTitle: 'One search. One useful result.', finalLead: 'FLIXO is designed to get you from intent to action without turning a simple task into a workflow.', trySmart: 'Try Smart Intent', all: 'All', browserMeta: 'Browser-first · Instant start',
  ariaHome: 'FLIXO home', ariaPrimary: 'Primary navigation', ariaFindTool: 'Find a tool', ariaTrust: 'Trust signals', ariaCategories: 'Tool categories', quickTags: ['Image compressor', 'Background remover', 'OCR', 'PDF', 'AI image'],
} as const;

export const HOME_AR = {
  language: 'ar', dir: 'rtl',
  nav: { tools: 'الأدوات', categories: 'التصنيفات', privacy: 'الخصوصية', switch: 'English' }, badge: 'الخصوصية أولًا · المتصفح أولًا', eyebrow: 'FLIXO · صندوق أدوات ذكي',
  heroTitle: 'الأداة المناسبة، <span>بدون طريق طويل.</span>', heroLead: 'حدد المهمة، افتح الأداة، وأنهِها بسرعة. تحافظ FLIXO على تجربة مركزة وتستخدم المعالجة المحلية داخل المتصفح عندما تدعمها الأداة.',
  describe: 'صف المهمة', searchLabel: 'ابحث عن أداة', searchPlaceholder: 'ماذا تريد أن تفعل؟ جرّب «ضغط الصور»', smartPalette: 'فتح لوحة الأوامر الذكية', suggested: 'مقترح:', openDirectly: 'فتح مباشرة', popular: 'عمليات البحث الشائعة',
  trust: [['المتصفح أولًا', 'معالجة محلية عندما تدعمها الأداة.'], ['بدء سريع', 'مسارات مباشرة بدون حواجز تسجيل غير ضرورية.'], ['توجيه ذكي', 'المهام الشائعة تصل مباشرة إلى أفضل أداة جاهزة.']], quickDrop: 'السحب السريع',
  quickDropTitle: 'ضع ملفًا. وسنوجّهك إلى الأداة المناسبة.', quickDropLead: 'لا ترفع FLIXO ملفك من الصفحة الرئيسية. نفحص نوع الملف محليًا فقط لاقتراح أداة موجودة.', dropChoose: 'اسحب ملفًا أو اختره', dropSupport: 'الصور مدعومة حاليًا للتوصيات الذكية.', suggestedTool: 'الأداة المقترحة', openTool: 'فتح الأداة',
  toolbox: 'صندوق الأدوات', toolboxTitle: 'ابدأ بالأدوات التي يحتاجها الناس فعلًا.', ready: 'جاهزة', empty: 'لا توجد أداة مطابقة بعد. جرّب عبارة أبسط أو افتح النية الذكية باستخدام Ctrl K.', builtForFocus: 'مصمم للتركيز', finalTitle: 'بحث واحد. نتيجة مفيدة واحدة.', finalLead: 'صُممت FLIXO لنقلك من النية إلى التنفيذ دون تحويل المهمة البسيطة إلى سير عمل معقد.', trySmart: 'جرّب النية الذكية', all: 'الكل', browserMeta: 'محلي · بدء فوري',
  ariaHome: 'العودة إلى FLIXO', ariaPrimary: 'التنقل الرئيسي', ariaFindTool: 'العثور على أداة', ariaTrust: 'إشارات الثقة', ariaCategories: 'تصنيفات الأدوات', quickTags: ['ضغط الصور', 'إزالة الخلفية', 'OCR', 'PDF', 'صور AI'],
  tools: {
    'image-compressor': 'ضاغط الصور', 'background-remover': 'إزالة الخلفية', 'image-upscaler': 'تكبير الصور', 'image-converter': 'محول الصور', 'ai-image-generator': 'مولد الصور بالذكاء الاصطناعي', 'object-remover': 'إزالة العناصر', 'watermark-remover': 'إزالة العلامة المائية', 'image-cropper': 'قص الصور', 'image-to-svg': 'تحويل الصورة إلى SVG', 'image-ocr': 'OCR للصور', 'background-blur': 'ضبابية الخلفية', 'passport-photo-maker': 'منشئ صور جواز السفر', 'watermark-adder': 'إضافة علامة مائية', 'meme-generator': 'منشئ الميمز', 'collage-maker': 'منشئ الكولاج', 'image-effects': 'تأثيرات الصور', 'exif-cleaner': 'منظف EXIF', 'svg-optimizer': 'محسن SVG', 'mockup-generator': 'منشئ النماذج', seed: 'Seed', pix: 'Pix Studio',
  },
} as const;
