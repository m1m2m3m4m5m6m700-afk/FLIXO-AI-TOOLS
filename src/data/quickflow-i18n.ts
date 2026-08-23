export const QUICKFLOW_I18N = {
  en: {
    missing: 'QuickFlow not found', back: 'Back to FLIXO', eyebrow: 'QUICKFLOW · LOCAL-FIRST', runLabel: 'Run QuickFlow',
    choose: 'Choose an image to start', processing: 'Processing stays in your browser.', result: 'Result ready', download: 'Download result', chooseError: 'Choose an image first.', failure: 'Workflow failed.',
    running: 'Running…', run: 'Run workflow', resultAlt: 'FLIXO QuickFlow result', percent: 'progress',
  },
  ar: {
    missing: 'QuickFlow غير موجود', back: 'العودة إلى فليكسو', eyebrow: 'QUICKFLOW · تنفيذ محلي', runLabel: 'تشغيل QuickFlow',
    choose: 'اختر صورة للبدء', processing: 'تتم المعالجة داخل متصفحك ولا تحتاج الصورة إلى الرفع إلى خادم.', result: 'النتيجة جاهزة', download: 'تنزيل النتيجة', chooseError: 'اختر صورة أولًا.', failure: 'حدث خطأ أثناء تنفيذ المسار.',
    running: 'جارٍ التنفيذ…', run: 'تشغيل المسار', resultAlt: 'نتيجة QuickFlow من فليكسو', percent: 'التقدم',
  },
} as const;

export const QUICKFLOW_TOOL_LABELS_AR: Record<string, string> = {
  'background-remover': 'إزالة الخلفية', 'image-upscaler': 'تحسين الجودة', 'image-cropper': 'قص وتحديد الأبعاد', 'image-compressor': 'ضغط الصورة', 'image-converter': 'تحويل الصيغة', 'image-effects': 'تحسين المظهر',
};

export const QUICKFLOW_NAMES_AR: Record<string, string> = {
  'product-ready': 'جاهزة للمتجر', 'social-ready': 'جاهزة للسوشيال', 'profile-ready': 'جاهزة للصورة الشخصية', 'web-ready': 'جاهزة للموقع', 'print-ready': 'جاهزة للطباعة', 'improve-image': 'تحسين الصورة',
};
