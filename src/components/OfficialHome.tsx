import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { TOOL_CATALOG } from '../config/registry';
import { ROADMAP_CATEGORIES } from '../data/roadmap-categories';
import { classifyHomeIntent, type AssistantResult } from '../lib/home-intent-classifier';

const FEATURED_IDS = [
  'background-remover',
  'image-upscaler',
  'image-cropper',
  'image-compressor',
  'image-converter',
  'image-effects',
] as const;

const CATEGORY_FAMILY_MAP: Readonly<Record<string, string>> = {
  image: 'images',
  video: 'video',
  audio: 'audio',
  ai: 'ai',
  editor: 'images',
};

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  translation: 'الترجمة',
  images: 'الصور',
  pdf: 'PDF',
  writing: 'الكتابة',
  video: 'الفيديو',
  audio: 'الصوت',
  files: 'الملفات',
  utilities: 'الأدوات',
  converters: 'المحوّلات',
  calculators: 'الحاسبات',
  web: 'الويب',
  developer: 'المطورين',
  ai: 'الذكاء الاصطناعي',
  future: 'المستقبل',
};

const FEATURED_COPY: Readonly<Record<string, { name: string; description: string }>> = {
  'background-remover': {
    name: 'إزالة الخلفية',
    description: 'إزالة الخلفيات المتصلة محليًا من المتصفح.',
  },
  'image-upscaler': {
    name: 'تكبير الصور',
    description: 'رفع أبعاد الصور بجودة محسوبة داخل المتصفح.',
  },
  'image-cropper': {
    name: 'قص الصور',
    description: 'قص وتغيير أبعاد الصورة بالمقاس المطلوب.',
  },
  'image-compressor': {
    name: 'ضغط الصور',
    description: 'تقليل حجم الملف مع تحكم واضح في الجودة.',
  },
  'image-converter': {
    name: 'تحويل الصور',
    description: 'تحويل صيغ الصور الشائعة محليًا.',
  },
  'image-effects': {
    name: 'تأثيرات الصور',
    description: 'سطوع وتباين وتشبع وتدرج رمادي.',
  },
};

function routeForTool(tool: (typeof TOOL_CATALOG.ready)[number]): string {
  return tool.routes.ar ?? tool.routes.en ?? tool.path;
}

function readyCountForCategory(categoryId: string): number {
  return TOOL_CATALOG.ready.filter((tool) => {
    const mapped = CATEGORY_FAMILY_MAP[tool.family ?? ''];
    return mapped === categoryId;
  }).length;
}

function assistantMessage(result: AssistantResult): string {
  if (result.kind === 'fallback') {
    return 'لم أجد تطابقًا موثوقًا ضمن الأدوات الحالية. يمكنك طلب أداة جديدة من زر «طلب أداة».';
  }
  const category = CATEGORY_LABELS[result.category.id] ?? result.category.name;
  if (result.toolTitle) {
    return `يبدو أن طلبك ينتمي إلى «${category}»، والأداة الحالية الأقرب هي «${result.toolTitle}».`;
  }
  return `يبدو أن طلبك ينتمي إلى «${category}»، لكن لا توجد أداة منشورة لهذا الطلب حاليًا.`;
}

export function OfficialHome() {
  const [query, setQuery] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestText, setRequestText] = useState('');
  const [assistantResult, setAssistantResult] = useState<AssistantResult | null>(null);
  const [thinking, setThinking] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem('flixo-official-theme') !== 'light';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      window.localStorage.setItem('flixo-official-theme', dark ? 'dark' : 'light');
    } catch {
      // Browser storage is optional.
    }
  }, [dark]);

  const featuredTools = useMemo(
    () =>
      FEATURED_IDS.map((id) => TOOL_CATALOG.ready.find((tool) => tool.id === id))
        .filter((tool): tool is (typeof TOOL_CATALOG.ready)[number] => Boolean(tool)),
    [],
  );

  const runAssistant = () => {
    const prompt = query.trim();
    if (!prompt) {
      setAssistantResult(null);
      return;
    }

    setThinking(true);
    window.setTimeout(() => {
      setAssistantResult(classifyHomeIntent(prompt));
      setThinking(false);
    }, 260);
  };

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openRequestWithQuery = () => {
    setRequestText(query.trim());
    setRequestOpen(true);
  };

  return (
    <div className={dark ? 'official-home official-dark' : 'official-home'} dir="rtl">
      <header className="official-nav">
        <div className="official-nav-inner">
          <a className="official-brand" href="/" aria-label="FLIXO">
            FLIXO<span>AI</span>
          </a>
          <nav className="official-nav-links" aria-label="التنقل الرئيسي">
            <button onClick={() => jump('official-categories')}>الفئات</button>
            <button onClick={() => jump('official-tools')}>الأدوات</button>
            <button onClick={() => jump('official-why')}>لماذا FLIXO؟</button>
            <button onClick={() => jump('official-faq')}>الأسئلة</button>
          </nav>
          <div className="official-nav-actions">
            <button
              className="official-icon-button"
              onClick={() => setDark((value) => !value)}
              aria-label={dark ? 'استخدام المظهر الفاتح' : 'استخدام المظهر الداكن'}
              title={dark ? 'المظهر الفاتح' : 'المظهر الداكن'}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="official-request-button" onClick={openRequestWithQuery}>
              طلب أداة
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="official-hero">
          <div className="official-container official-hero-grid">
            <div className="official-hero-copy">
              <span className="official-badge">
                <ShieldCheck size={14} />
                المتصفح أولًا · بدون حساب · بدون تنفيذ وكيل
              </span>
              <h1>
                كل أدواتك الرقمية.
                <em> في مساحة واحدة.</em>
              </h1>
              <p>
                FLIXO يبني تجربة موحّدة للوصول إلى أدوات الصور والملفات والنصوص والتحويلات،
                مع إبقاء التنفيذ اليدوي هو المسار الرسمي الحالي.
              </p>

              <div className="official-assistant">
                <div className="official-assistant-label">
                  <span>
                    <Sparkles size={17} />
                    مساعد FLIXO
                  </span>
                  <small>Mock محلي</small>
                </div>
                <div className="official-prompt">
                  <Sparkles size={20} />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setAssistantResult(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') runAssistant();
                    }}
                    placeholder="اكتب ما تريد إنجازه… مثال: أريد إزالة خلفية صورة"
                    aria-label="اكتب ما تريد إنجازه"
                  />
                  <button onClick={runAssistant}>
                    {thinking ? 'يفكر…' : 'حلّل الطلب'}
                    <ArrowUpLeft size={17} />
                  </button>
                </div>

                {thinking && (
                  <div className="official-assistant-state" role="status" aria-live="polite">
                    <span className="official-thinking-dot" />
                    تصنيف الطلب محليًا…
                  </div>
                )}

                {assistantResult && !thinking && (
                  <div className="official-assistant-result" role="status" aria-live="polite">
                    <div>
                      <strong>{assistantMessage(assistantResult)}</strong>
                      {assistantResult.kind === 'match' && (
                        <small>
                          ثقة تصنيف تقريبية: {Math.round(assistantResult.confidence * 100)}٪
                        </small>
                      )}
                    </div>
                    {assistantResult.kind === 'match' && assistantResult.toolPath ? (
                      <a className="official-result-link" href={assistantResult.toolPath}>
                        افتح الأداة
                        <ArrowUpLeft size={15} />
                      </a>
                    ) : (
                      <button className="official-result-link" onClick={openRequestWithQuery}>
                        طلب أداة
                        <ArrowUpLeft size={15} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="official-trust">
                <span><Check size={14} /> التنفيذ اليدوي</span>
                <span><Check size={14} /> ملفاتك لا تُرسل للمساعد</span>
                <span><Check size={14} /> تجربة سريعة من المتصفح</span>
              </div>
            </div>

            <div className="official-hero-panel" aria-hidden="true">
              <div className="official-orbit">
                <div className="official-orbit-core">F</div>
                <span className="orbit-a">Images</span>
                <span className="orbit-b">PDF</span>
                <span className="orbit-c">Files</span>
                <span className="orbit-d">Convert</span>
              </div>
              <div className="official-panel-caption">
                <small>FLIXO SYSTEM</small>
                <strong>One surface. Many workflows.</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="official-section" id="official-categories">
          <div className="official-container">
            <div className="official-heading">
              <div>
                <small>خريطة المنتج</small>
                <h2>14 فئة، جاهزة للتوسّع.</h2>
                <p>هذه طبقة Roadmap للواجهة فقط. حالة التنفيذ الفعلية تبقى من السجل القانوني الحالي.</p>
              </div>
              <span className="official-section-count">14 فئة</span>
            </div>

            <div className="official-category-grid">
              {ROADMAP_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const liveCount = readyCountForCategory(category.id);
                return (
                  <article className="official-category-card" id={category.anchor} key={category.id}>
                    <div className="official-category-icon"><Icon size={20} /></div>
                    <div className="official-category-top">
                      <span>0{category.order}</span>
                      {liveCount > 0 ? (
                        <small>{liveCount} متاح</small>
                      ) : (
                        <small>قيد التوسع</small>
                      )}
                    </div>
                    <h3>{category.name}</h3>
                    <p>{category.description}</p>
                    <button onClick={liveCount > 0 ? () => jump('official-tools') : openRequestWithQuery}>
                      {liveCount > 0 ? 'استكشف الأدوات' : 'اطلب أداة'}
                      <ArrowUpLeft size={15} />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="official-section official-tools-section" id="official-tools">
          <div className="official-container">
            <div className="official-heading">
              <div>
                <small>متاح الآن</small>
                <h2>الأدوات التي يمكنك تشغيلها مباشرة.</h2>
                <p>لا توجد إضافة لأدوات جديدة هنا؛ هذه البطاقات مرتبطة بالأدوات المسجلة والجاهزة حاليًا.</p>
              </div>
              <div className="official-tool-count">
                <strong>{TOOL_CATALOG.ready.length}</strong>
                <span>أداة جاهزة في السجل</span>
              </div>
            </div>

            <div className="official-featured-grid">
              {featuredTools.map((tool) => {
                const copy = FEATURED_COPY[tool.id] ?? {
                  name: tool.title,
                  description: tool.description,
                };
                return (
                  <a key={tool.id} className="official-featured-card" href={routeForTool(tool)}>
                    <div className="official-card-top">
                      <span>متاح الآن</span>
                      <ArrowUpRight size={16} />
                    </div>
                    <h3>{copy.name}</h3>
                    <p>{copy.description}</p>
                    <small>{tool.title}</small>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <section className="official-section official-why" id="official-why">
          <div className="official-container">
            <div className="official-heading">
              <div>
                <small>Why FLIXO?</small>
                <h2>بنية هادئة بدل تعقيد غير ضروري.</h2>
              </div>
            </div>
            <div className="official-benefits">
              <article>
                <ShieldCheck size={21} />
                <h3>خصوصية عملية</h3>
                <p>المسار اليدوي لا يحتاج إلى حساب أو إلى إرسال ملفك للمساعد المحلي الوهمي.</p>
              </article>
              <article>
                <Sparkles size={21} />
                <h3>واجهة واحدة</h3>
                <p>الفئات والبحث والمساعد والمفضلات المستقبلية يمكن أن تتوسع من سطح واحد.</p>
              </article>
              <article>
                <ArrowUpRight size={21} />
                <h3>نمو مضبوط</h3>
                <p>الواجهة لا تمنح الأدوات الوهمية صفة التنفيذ؛ الجاهزية تأتي من السجل الحالي فقط.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="official-section official-faq" id="official-faq">
          <div className="official-container official-faq-container">
            <div className="official-heading">
              <div>
                <small>الأسئلة الشائعة</small>
                <h2>قبل أن تبدأ.</h2>
              </div>
            </div>
            {[
              ['هل أحتاج إلى حساب؟', 'لا. الواجهة الرسمية الحالية تبدأ من الأدوات مباشرة.'],
              ['هل المساعد الذكي ينفّذ الأدوات؟', 'لا. المساعد هنا مصنّف محلي Mock، يعرض اقتراحًا فقط ولا يملك مسار تنفيذ.'],
              ['ماذا يحدث عندما لا توجد أداة؟', 'يعرض المساعد زر «طلب أداة» بدل اختراع وظيفة غير منشورة.'],
              ['أين توجد الأدوات الفعلية؟', 'الأداة لا تُعتبر جاهزة إلا عندما تكون موجودة في السجل القانوني الحالي ومسارها منشورًا.'],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown size={17} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="official-section official-cta">
          <div className="official-container">
            <div className="official-cta-card">
              <div>
                <small>لا تجد ما تحتاجه؟</small>
                <h2>اطلب الأداة بدل اختلاق نتيجة.</h2>
                <p>النموذج محلي حاليًا ولا يرسل أي بيانات إلى خدمة خارجية.</p>
              </div>
              <button onClick={openRequestWithQuery}>Request a Tool <ArrowUpLeft size={17} /></button>
            </div>
          </div>
        </section>
      </main>

      <footer className="official-footer">
        <div className="official-container official-footer-inner">
          <strong>FLIXO<span>AI</span></strong>
          <span>Browser-first tools for everyday digital work.</span>
          <span>© {new Date().getFullYear()} FLIXO</span>
        </div>
      </footer>

      {requestOpen && (
        <div
          className="official-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRequestOpen(false);
          }}
        >
          <div className="official-modal" role="dialog" aria-modal="true" aria-labelledby="request-tool-title">
            <button className="official-close" onClick={() => setRequestOpen(false)} aria-label="إغلاق">
              <X size={18} />
            </button>
            <small>REQUEST A TOOL</small>
            <h2 id="request-tool-title">ما الأداة التي تحتاجها؟</h2>
            <p>هذا النموذج محلي فقط في نسخة الـMVP الحالية.</p>
            <textarea
              value={requestText}
              onChange={(event) => setRequestText(event.target.value)}
              placeholder="مثال: أحتاج أداة لتحويل HEIC إلى JPG…"
              autoFocus
            />
            <div className="official-modal-actions">
              <button className="official-modal-secondary" onClick={() => setRequestOpen(false)}>إغلاق</button>
              <button
                className="official-submit"
                onClick={() => {
                  setRequestOpen(false);
                  setRequestText('');
                }}
                disabled={!requestText.trim()}
              >
                حفظ الطلب محليًا
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
