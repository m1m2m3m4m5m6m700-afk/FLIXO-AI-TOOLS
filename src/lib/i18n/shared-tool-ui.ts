import type { Locale } from './config';

type SharedCopy = Readonly<{ processing: string; inputs: string; browserSuffix: string; externalSuffix: string; chooseFile: string; optional: string; originalText: string; modifiedText: string; regexPattern: string; regexInput: string; topText: string; bottomText: string; watermarkText: string; foregroundColor: string; backgroundColor: string; generateQr: string; chooseQrImage: string; exportClip: string; compressImage: string; compressAllZip: string; }>;

const base = (locale: string): SharedCopy => ({
  processing: locale === 'ar' ? 'معالجة محلية' : locale === 'zh' ? '本地处理' : locale === 'ur' ? 'مقامی پروسیسنگ' : locale === 'hi' ? 'स्थानीय प्रोसेसिंग' : locale === 'ja' ? 'ローカル処理' : locale === 'ko' ? '로컬 처리' : locale === 'ru' ? 'Локальная обработка' : 'Local processing',
  inputs: locale === 'ar' ? 'المدخلات' : locale === 'zh' ? '输入' : locale === 'ur' ? 'ان پٹ' : locale === 'hi' ? 'इनपुट' : locale === 'ja' ? '入力' : locale === 'ko' ? '입력' : locale === 'ru' ? 'Входные данные' : 'Inputs',
  browserSuffix: locale === 'ar' ? 'تُعالج في متصفحك عندما تدعم الأداة ذلك.' : locale === 'zh' ? '在工具支持时会在你的浏览器中处理。' : locale === 'ur' ? 'ٹول کی معاونت ہونے پر آپ کے براؤزر میں پراسیس ہوتے ہیں۔' : locale === 'hi' ? 'टूल के समर्थन पर आपके ब्राउज़र में संसाधित होते हैं।' : locale === 'ja' ? 'ツールが対応している場合はブラウザ内で処理されます。' : locale === 'ko' ? '도구가 지원하는 경우 브라우저에서 처리됩니다.' : locale === 'ru' ? 'обрабатываются в браузере, если инструмент это поддерживает.' : 'are processed in your browser when supported by the tool.',
  externalSuffix: locale === 'ar' ? 'تستخدم نقطة معالجة خارجية مُهيأة ولا تُقدَّم على أنها محلية فقط.' : locale === 'zh' ? '使用已配置的外部处理端点，并不会标记为仅本地处理。' : locale === 'ur' ? 'مخصوص بیرونی پروسیسنگ اینڈ پوائنٹ استعمال کرتا ہے اور اسے صرف مقامی کے طور پر پیش نہیں کیا جاتا۔' : locale === 'hi' ? 'कॉन्फ़िगर किए गए बाहरी प्रोसेसिंग एंडपॉइंट का उपयोग करता है और इसे केवल स्थानीय के रूप में प्रस्तुत नहीं किया जाता।' : locale === 'ja' ? '設定済みの外部処理エンドポイントを使用し、完全なローカル処理としては表示されません。' : locale === 'ko' ? '구성된 외부 처리 엔드포인트를 사용하며 완전한 로컬 처리로 표시되지 않습니다.' : locale === 'ru' ? 'использует настроенную внешнюю точку обработки и не позиционируется как полностью локальный.' : 'uses a configured external processing endpoint and is not presented as local-only.',
  chooseFile: locale === 'ar' ? 'اختر ملفًا' : locale === 'zh' ? '选择文件' : locale === 'ur' ? 'فائل منتخب کریں' : locale === 'hi' ? 'फ़ाइल चुनें' : locale === 'ja' ? 'ファイルを選択' : locale === 'ko' ? '파일 선택' : locale === 'ru' ? 'Выберите файл' : 'Choose a file',
  optional: locale === 'ar' ? 'اختياري' : locale === 'zh' ? '可选' : locale === 'ur' ? 'اختیاری' : locale === 'hi' ? 'वैकल्पिक' : locale === 'ja' ? '任意' : locale === 'ko' ? '선택 사항' : locale === 'ru' ? 'Необязательно' : 'Optional',
  originalText: locale === 'ar' ? 'النص الأصلي' : locale === 'zh' ? '原始文本' : locale === 'ur' ? 'اصل متن' : locale === 'hi' ? 'मूल टेक्स्ट' : locale === 'ja' ? '元のテキスト' : locale === 'ko' ? '원본 텍스트' : locale === 'ru' ? 'Исходный текст' : 'Original text',
  modifiedText: locale === 'ar' ? 'النص المعدّل' : locale === 'zh' ? '修改后的文本' : locale === 'ur' ? 'ترمیم شدہ متن' : locale === 'hi' ? 'संशोधित टेक्स्ट' : locale === 'ja' ? '変更後のテキスト' : locale === 'ko' ? '수정된 텍스트' : locale === 'ru' ? 'Изменённый текст' : 'Modified text',
  regexPattern: locale === 'ar' ? 'نمط Regex' : locale === 'zh' ? '正则表达式模式' : locale === 'ur' ? 'Regex پیٹرن' : locale === 'hi' ? 'Regex पैटर्न' : locale === 'ja' ? '正規表現パターン' : locale === 'ko' ? '정규식 패턴' : locale === 'ru' ? 'Шаблон Regex' : 'Regex pattern',
  regexInput: locale === 'ar' ? 'إدخال Regex' : locale === 'zh' ? '正则输入' : locale === 'ur' ? 'Regex ان پٹ' : locale === 'hi' ? 'Regex इनपुट' : locale === 'ja' ? '正規表現入力' : locale === 'ko' ? '정규식 입력' : locale === 'ru' ? 'Ввод Regex' : 'Regex input',
  topText: locale === 'ar' ? 'النص العلوي' : locale === 'zh' ? '顶部文本' : locale === 'ur' ? 'اوپری متن' : locale === 'hi' ? 'ऊपरी टेक्स्ट' : locale === 'ja' ? '上部テキスト' : locale === 'ko' ? '위쪽 텍스트' : locale === 'ru' ? 'Верхний текст' : 'Top text',
  bottomText: locale === 'ar' ? 'النص السفلي' : locale === 'zh' ? '底部文本' : locale === 'ur' ? 'نچلا متن' : locale === 'hi' ? 'निचला टेक्स्ट' : locale === 'ja' ? '下部テキスト' : locale === 'ko' ? '아래쪽 텍스트' : locale === 'ru' ? 'Нижний текст' : 'Bottom text',
  watermarkText: locale === 'ar' ? 'نص العلامة المائية' : locale === 'zh' ? '水印文字' : locale === 'ur' ? 'واٹر مارک متن' : locale === 'hi' ? 'वॉटरमार्क टेक्स्ट' : locale === 'ja' ? '透かしテキスト' : locale === 'ko' ? '워터마크 텍스트' : locale === 'ru' ? 'Текст водяного знака' : 'Watermark text',
  foregroundColor: locale === 'ar' ? 'لون المقدمة' : locale === 'zh' ? '前景色' : locale === 'ur' ? 'پیش منظر کا رنگ' : locale === 'hi' ? 'अग्रभूमि रंग' : locale === 'ja' ? '前景色' : locale === 'ko' ? '전경색' : locale === 'ru' ? 'Цвет переднего плана' : 'Foreground color',
  backgroundColor: locale === 'ar' ? 'لون الخلفية' : locale === 'zh' ? '背景色' : locale === 'ur' ? 'پس منظر کا رنگ' : locale === 'hi' ? 'पृष्ठभूमि रंग' : locale === 'ja' ? '背景色' : locale === 'ko' ? '배경색' : locale === 'ru' ? 'Цвет фона' : 'Background color',
  generateQr: locale === 'ar' ? 'إنشاء QR' : locale === 'zh' ? '生成二维码' : locale === 'ur' ? 'QR بنائیں' : locale === 'hi' ? 'QR बनाएं' : locale === 'ja' ? 'QRを生成' : locale === 'ko' ? 'QR 생성' : locale === 'ru' ? 'Создать QR' : 'Generate QR',
  chooseQrImage: locale === 'ar' ? 'اختر صورة QR' : locale === 'zh' ? '选择二维码图片' : locale === 'ur' ? 'QR تصویر منتخب کریں' : locale === 'hi' ? 'QR छवि चुनें' : locale === 'ja' ? 'QR画像を選択' : locale === 'ko' ? 'QR 이미지 선택' : locale === 'ru' ? 'Выберите изображение QR' : 'Choose QR image',
  exportClip: locale === 'ar' ? 'تصدير المقطع' : locale === 'zh' ? '导出片段' : locale === 'ur' ? 'کلپ برآمد کریں' : locale === 'hi' ? 'क्लिप निर्यात करें' : locale === 'ja' ? 'クリップを書き出す' : locale === 'ko' ? '클립 내보내기' : locale === 'ru' ? 'Экспортировать фрагмент' : 'Export clip',
  compressImage: locale === 'ar' ? 'ضغط الصورة' : locale === 'zh' ? '压缩图片' : locale === 'ur' ? 'تصویر کمپریس کریں' : locale === 'hi' ? 'छवि संपीड़ित करें' : locale === 'ja' ? '画像を圧縮' : locale === 'ko' ? '이미지 압축' : locale === 'ru' ? 'Сжать изображение' : 'Compress image',
  compressAllZip: locale === 'ar' ? 'ضغط الكل إلى ZIP' : locale === 'zh' ? '全部压缩为 ZIP' : locale === 'ur' ? 'سب کو ZIP میں کمپریس کریں' : locale === 'hi' ? 'सभी को ZIP में संपीड़ित करें' : locale === 'ja' ? 'すべてをZIPに圧縮' : locale === 'ko' ? '모두 ZIP으로 압축' : locale === 'ru' ? 'Сжать всё в ZIP' : 'Compress all to ZIP',
});

export const SHARED_TOOL_UI_COPY: Record<Locale, SharedCopy> = Object.fromEntries((['ar','en','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'] as const).map((locale) => [locale, base(locale)])) as Record<Locale, SharedCopy>;

export function translateSharedToolText(locale: Locale, value: string): string {
  if (locale === 'en') return value;
  const copy = SHARED_TOOL_UI_COPY[locale];
  const compact = value.trim();
  const exact: Record<string, string> = {
    'Choose a file': copy.chooseFile, Optional: copy.optional, 'Original text': copy.originalText, 'Modified text': copy.modifiedText,
    'Regex pattern': copy.regexPattern, 'Regex input': copy.regexInput, 'Top text': copy.topText, 'Bottom text': copy.bottomText,
    'Watermark text': copy.watermarkText, 'Foreground color': copy.foregroundColor, 'Background color': copy.backgroundColor,
    'Generate QR': copy.generateQr, 'Choose QR image': copy.chooseQrImage, 'Export clip': copy.exportClip,
    'Compress image': copy.compressImage, 'Compress all to ZIP': copy.compressAllZip,
  };
  const replacement = exact[compact];
  return replacement ? value.replace(compact, replacement) : value;
}
