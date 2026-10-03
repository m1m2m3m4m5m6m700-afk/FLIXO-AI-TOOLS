import { useMemo, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, Moon, Search, ShieldCheck, Sparkles, Sun, X } from 'lucide-react';

const tools = [
  { id: 'background-remover', name: 'إزالة الخلفية', description: 'إزالة خلفية الصور مباشرة من المتصفح.', category: 'الصور', slug: 'background-remover' },
  { id: 'image-upscaler', name: 'تكبير الصور', description: 'رفع دقة الصورة مع الحفاظ على الجودة.', category: 'الصور', slug: 'image-upscaler' },
  { id: 'image-cropper', name: 'قص الصور', description: 'قص وتحديد أبعاد الصور بسرعة.', category: 'الصور', slug: 'image-cropper' },
  { id: 'image-compressor', name: 'ضغط الصور', description: 'تقليل حجم الصور مع التحكم في الجودة.', category: 'الصور', slug: 'image-compressor' },
  { id: 'image-converter', name: 'تحويل الصور', description: 'تحويل الصور بين الصيغ المدعومة.', category: 'الصور', slug: 'image-converter' },
  { id: 'image-effects', name: 'تأثيرات الصور', description: 'تطبيق تأثيرات وتعديلات بصرية على الصور.', category: 'الصور', slug: 'image-effects' },
  { id: 'translator', name: 'مترجم النصوص', description: 'ترجمة النصوص ضمن تجربة FLIXO.', category: 'النصوص', slug: 'translator' },
];

const categories = ['الكل', 'الصور', 'النصوص'];

export function OfficialHome() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('الكل');
  const [requestOpen, setRequestOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('flixo-official-theme') === 'dark');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter((tool) => {
      const matchesCategory = filter === 'الكل' || tool.category === filter;
      const matchesQuery = !q || [tool.name, tool.description, tool.category].join(' ').toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [filter, query]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('flixo-official-theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
  };

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className={dark ? 'official-home official-dark' : 'official-home'}>
      <header className="official-nav">
        <a className="official-brand" href="/" aria-label="FLIXO">FLIXO</a>
        <nav>
          <button onClick={() => jump('official-tools')}>الأدوات</button>
          <button onClick={() => jump('official-why')}>لماذا FLIXO</button>
          <button onClick={() => jump('official-faq')}>الأسئلة</button>
        </nav>
        <div className="official-nav-actions">
          <button className="official-icon" onClick={toggleTheme} aria-label="تبديل المظهر">{dark ? <Sun size={17}/> : <Moon size={17}/>}</button>
          <button className="official-lang" onClick={() => setRequestOpen(true)}>طلب أداة</button>
        </div>
      </header>

      <main>
        <section className="official-hero">
          <div className="official-hero-copy">
            <span className="official-badge"><ShieldCheck size={14}/> معالجة محلية أولاً • بدون تسجيل</span>
            <h1>كل أدواتك الرقمية.<br/><em>في مكان واحد.</em></h1>
            <p>FLIXO يجمع أدوات الصور والملفات والنصوص في تجربة سريعة وواضحة تعمل من المتصفح.</p>
            <div className="official-prompt">
              <Sparkles size={20}/>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن أداة…" onKeyDown={(e) => e.key === 'Enter' && jump('official-tools')}/>
              <button onClick={() => jump('official-tools')}>استكشف <ArrowUpRight size={16}/></button>
            </div>
            <div className="official-trust"><span><Check size={14}/> خصوصية أولاً</span><span><Check size={14}/> بدون حساب</span><span><Check size={14}/> تجربة مباشرة</span></div>
          </div>
          <div className="official-orbit" aria-hidden="true">
            <div className="official-orbit-core">F</div>
            <span>Images</span><span>PDF</span><span>Files</span><span>Convert</span>
          </div>
        </section>

        <section className="official-section" id="official-tools">
          <div className="official-heading">
            <div><small>دليل الأدوات</small><h2>اختر ما تحتاجه مباشرة.</h2></div>
            <div className="official-search"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث سريع…"/></div>
          </div>
          <div className="official-pills">
            {categories.map((category) => <button key={category} className={filter === category ? 'active' : ''} onClick={() => setFilter(category)}>{category}</button>)}
          </div>
          <div className="official-grid">
            {visible.map((tool) => <a key={tool.id} href={`/tools/${tool.slug}`} className="official-tool-card">
              <div className="official-card-top"><span>{tool.category}</span><ArrowUpRight size={15}/></div>
              <h3>{tool.name}</h3><p>{tool.description}</p>
              <small>متاح الآن</small>
            </a>)}
          </div>
        </section>

        <section className="official-section official-why" id="official-why">
          <div className="official-heading"><div><small>لماذا FLIXO</small><h2>أدوات بسيطة، بدون تعقيد.</h2></div></div>
          <div className="official-benefits">
            <article><ShieldCheck size={21}/><h3>الخصوصية أولاً</h3><p>المسار اليدوي هو المسار الرسمي، ومعالجة الملفات محلياً حيث تدعمها الأداة.</p></article>
            <article><Sparkles size={21}/><h3>تجربة موحّدة</h3><p>واجهة واحدة لاكتشاف الأدوات والوصول المباشر إلى وظائفها.</p></article>
            <article><ArrowUpRight size={21}/><h3>ابدأ مباشرة</h3><p>اختر الأداة ثم ارفع ملفك ونفّذ العملية من دون وكيل أو تنفيذ تلقائي.</p></article>
          </div>
        </section>

        <section className="official-section official-faq" id="official-faq">
          <div className="official-heading"><div><small>الأسئلة الشائعة</small><h2>أسئلة قبل البدء.</h2></div></div>
          {[
            ['هل أحتاج إلى حساب؟','لا. الواجهة الرسمية مصممة لتبدأ من الأدوات مباشرة.'],
            ['هل كل الأدوات تعمل الآن؟','يعرض دليل الأدوات الوظائف المعتمدة فقط في هذه الواجهة.'],
            ['هل توجد عمليات وكيل تلقائية؟','لا. هذه الواجهة الرسمية تعتمد على الأدوات اليدوية المباشرة.']
          ].map(([q,a]) => <details key={q}><summary>{q}<ChevronDown size={17}/></summary><p>{a}</p></details>)}
        </section>
      </main>

      <footer className="official-footer"><strong>FLIXO</strong><span>Browser-first tools for everyday work.</span></footer>

      {requestOpen && <div className="official-modal-backdrop" onClick={() => setRequestOpen(false)}>
        <div className="official-modal" onClick={(e) => e.stopPropagation()}>
          <button className="official-close" onClick={() => setRequestOpen(false)} aria-label="إغلاق"><X size={18}/></button>
          <h2>طلب أداة جديدة</h2><p>أخبرنا بالأداة التي تريدها وسنضيف الطلب إلى قائمة التطوير.</p>
          <textarea placeholder="مثال: أريد أداة لتحويل صور HEIC إلى JPG…" />
          <button className="official-submit" onClick={() => setRequestOpen(false)}>إرسال الطلب</button>
        </div>
      </div>}
    </div>
  );
}
