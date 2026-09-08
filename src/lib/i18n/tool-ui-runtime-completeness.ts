import { LOCALES, normalizeLocale, type CanonicalLocale } from './config';
import { getLocalizedToolTitle } from '../seo/tool-seo';

type LocaleMap = Partial<Record<CanonicalLocale, string>>;

const UI: Readonly<Record<string, LocaleMap>> = {
  'Local processing': { ar: 'معالجة محلية', zh: '本地处理', ur: 'مقامی پروسیسنگ', hi: 'स्थानीय प्रोसेसिंग', ja: 'ローカル処理', ko: '로컬 처리', ru: 'Локальная обработка' },
  'Choose a file': { ar: 'اختر ملفًا', zh: '选择文件', ur: 'فائل منتخب کریں', hi: 'फ़ाइल चुनें', ja: 'ファイルを選択', ko: '파일 선택', ru: 'Выберите файл' },
  Optional: { ar: 'اختياري', zh: '可选', ur: 'اختیاری', hi: 'वैकल्पिक', ja: '任意', ko: '선택 사항', ru: 'Необязательно' },
  'Run tool': { ar: 'تشغيل الأداة', zh: '运行工具', ur: 'ٹول چلائیں', hi: 'टूल चलाएँ', ja: 'ツールを実行', ko: '도구 실행', ru: 'Запустить инструмент' },
  'Compress image': { ar: 'ضغط الصورة', zh: '压缩图片', ur: 'تصویر کمپریس کریں', hi: 'छवि संपीड़ित करें', ja: '画像を圧縮', ko: '이미지 압축', ru: 'Сжать изображение' },
  'Original text': { ar: 'النص الأصلي', zh: '原始文本', ur: 'اصل متن', hi: 'मूल टेक्स्ट', ja: '元のテキスト', ko: '원본 텍스트', ru: 'Исходный текст' },
  'Modified text': { ar: 'النص المعدّل', zh: '修改后的文本', ur: 'ترمیم شدہ متن', hi: 'संशोधित टेक्स्ट', ja: '変更後のテキスト', ko: '수정된 텍스트', ru: 'Изменённый текст' },
  Compare: { ar: 'مقارنة', zh: '比较', ur: 'موازنہ', hi: 'तुलना करें', ja: '比較', ko: '비교', ru: 'Сравнить' },
  'Copy text': { ar: 'نسخ النص', zh: '复制文本', ur: 'متن کاپی کریں', hi: 'टेक्स्ट कॉपी करें', ja: 'テキストをコピー', ko: '텍스트 복사', ru: 'Копировать текст' },
};

const PREFIXES: ReadonlyArray<readonly [string, LocaleMap]> = [
  ['Download ', { ar: 'تنزيل ', zh: '下载 ', ur: 'ڈاؤن لوڈ ', hi: 'डाउनलोड ', ja: 'ダウンロード ', ko: '다운로드 ', ru: 'Скачать ' }],
  ['Input: ', { ar: 'الإدخال: ', zh: '输入：', ur: 'ان پٹ: ', hi: 'इनपुट: ', ja: '入力: ', ko: '입력: ', ru: 'Вход: ' }],
  ['Output: ', { ar: 'الإخراج: ', zh: '输出：', ur: 'آؤٹ پٹ: ', hi: 'आउटपुट: ', ja: '出力: ', ko: '출력: ', ru: 'Результат: ' }],
];

function translateValue(locale: CanonicalLocale, value: string): string {
  if (locale === 'en') return value;
  const trimmed = value.trim();
  const exact = UI[trimmed]?.[locale];
  if (exact) return value.replace(trimmed, exact);
  for (const [prefix, map] of PREFIXES) if (value.startsWith(prefix)) return `${map[locale] ?? prefix}${value.slice(prefix.length)}`;
  return value;
}

function shouldSkip(node: Text): boolean {
  const parent = node.parentElement;
  return !parent || Boolean(parent.closest('script,style,pre,textarea,[contenteditable="true"],[data-no-auto-i18n]'));
}

function localizeRoot(root: HTMLElement, locale: CanonicalLocale, toolId: string): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) { const node = walker.currentNode as Text; if (node.nodeValue?.trim() && !shouldSkip(node)) texts.push(node); }
  for (const node of texts) { const current = node.nodeValue ?? ''; const next = translateValue(locale, current); if (next !== current) node.nodeValue = next; }
  root.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((element) => {
    if (element.matches('[data-no-auto-i18n]')) return;
    for (const attribute of ['aria-label', 'title', 'placeholder'] as const) { const current = element.getAttribute(attribute); if (!current) continue; const next = translateValue(locale, current); if (next !== current) element.setAttribute(attribute, next); }
  });
  const firstHeading = root.querySelector<HTMLElement>('h1');
  if (firstHeading) firstHeading.textContent = getLocalizedToolTitle(locale, toolId, firstHeading.textContent?.trim() || toolId);
}

export function installToolUiRuntimeCompleteness(): () => void {
  const apply = () => {
    const locale = normalizeLocale(typeof document !== 'undefined' ? document.documentElement.lang : 'en');
    if (!LOCALES.includes(locale) || locale === 'en') return;
    const root = document.querySelector<HTMLElement>('.tool-page-modern, .tool-shell, main');
    if (!root) return;
    const toolId = root.getAttribute('data-tool-id') ?? document.body.getAttribute('data-tool-id') ?? '';
    root.lang = locale;
    localizeRoot(root, locale, toolId);
  };
  let scheduled = false;
  const schedule = () => { if (scheduled) return; scheduled = true; queueMicrotask(() => { scheduled = false; apply(); }); };
  apply();
  const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(schedule);
  const root = typeof document !== 'undefined' ? document.body : null;
  if (observer && root) observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });
  return () => observer?.disconnect();
}
