import { useMemo, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, Moon, Search, ShieldCheck, Sparkles, Sun, X } from 'lucide-react';
import { categories, sortedCategories } from '../data/categories';
import { tools } from '../data/tools';

export function OfficialHome() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [requestOpen, setRequestOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('flixo-official-theme') === 'dark');

  const visible = useMemo(() => tools.filter((tool) => {
    const matchesCategory = filter === 'all' || tool.categoryId === filter;
    const q = query.trim().toLowerCase();
    return matchesCategory && (!q || [tool.name, tool.description, ...(tool.tags ?? [])].join(' ').toLowerCase().includes(q));
  }), [filter, query]);

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
            <p>FLIXO يجمع أدوات الصور والملفات وPDF والنصوص والمحوّلات في تجربة سريعة وواضحة تعمل من المتصفح.</p>
            <div className="official-prompt">
              <Sparkles size={20}/>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن أداة أو اكتب ما تريد فعله…" onKeyDown={(e) => e.key === 'Enter' && jump('official-tools')}/>
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
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>الكل</button>
            {sortedCategories.slice(0, 8).map((category) => <button key={category.id} className={filter === category.id ? 'active' : ''} onClick={() => setFilter(category.id)}>{category.name}</button>)}
          </div>
          <div className="official-grid">
            {visible.slice(0, 36).map((tool) => <a key={tool.id} href={tool.slug ? `/tools/${tool.slug}` : `#${tool.categoryId}`} className="official-tool-card">
              <div className="official-card-top"><span>{categories.find((c) => c.id === tool.categoryId)?.name}</span><ArrowUpRight size={15}/></div>
              <h3>{tool.name}</h3><p>{tool.description}</p>
              <small>{tool.status === 'ready' ? 'متاح الآن' : tool.status === 'planned' ? 'قريباً' : 'قيد التخطيط'}</small>
            </a>)}
          </div>
        </section>

        <section className="official-section official-why" id="official-why">
          <div className="official-heading"><div><small>لماذا FLIXO</small><h2>أدوات بسيطة، بدون تعقيد.</h2></div></div>
          <div className="official-benefits">
            <article><ShieldCheck size={21}/><h3>الخصوصية أولاً</h3><p>التصميم يستهدف معالجة الملفات داخل المتصفح عندما تكون الأداة قادرة على ذلك.</p></article>
            <article><Sparkles size={21}/><h3>تجربة موحّدة</h3><p>نظام واجهة واحد يجعل اكتشاف الأدوات واستخدامها متسقاً عبر الفئات.</p></article>
            <article><ArrowUpRight size={21}/><h3>ابدأ مباشرة</h3><p>لا تحتاج إلى المرور بلوحة تحكم معقدة للوصول إلى الأداة المطلوبة.</p></article>
          </div>
        </section>

        <section className="official-section official-faq" id="official-faq">
          <div className="official-heading"><div><small>الأسئلة الشائعة</small><h2>أسئلة قبل البدء.</h2></div></div>
          {[
            ['هل أحتاج إلى حساب؟','لا. الواجهة الرسمية مصممة لتبدأ من الأدوات مباشرة.'],
            ['هل كل الأدوات تعمل الآن؟','لا. حالة كل أداة معروضة بوضوح؛ الأدوات غير الجاهزة لا تُقدّم على أنها متاحة.'],
            ['أين أجد جميع الأدوات؟','استخدم قسم دليل الأدوات أو زر الأدوات في أعلى الصفحة.']
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
