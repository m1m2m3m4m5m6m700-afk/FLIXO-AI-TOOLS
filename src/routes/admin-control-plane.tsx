import { useEffect, useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { ADMIN_CAPABILITIES, INITIAL_CONTROL_PLANE_STATE } from '../lib/admin/control-plane';
import { ADMIN_EXECUTION_CLASSES, ADMIN_MODULES, ADMIN_ROLE_CAPABILITY_MATRIX } from '../lib/admin/module-registry';

const CENTER_OPTIONS = ['truth', 'operations', 'incident', 'evidence', 'security', 'contract'] as const;
type المركز = (typeof CENTER_OPTIONS)[number];
const CENTER_LABELS: Record<المركز, string> = { truth: 'الحقيقة', operations: 'العمليات', incident: 'الحوادث', evidence: 'الأدلة', security: 'الأمان', contract: 'العقود' };
const STATUS_LABELS: Record<string, string> = {
  CONNECTED: 'متصل',
  UNAVAILABLE: 'غير متاح',
  VERIFIED: 'متحقق',
  FAILED: 'فشل',
  BLOCKED: 'محظور',
  STALE: 'قديم',
  UNKNOWN: 'غير معروف',
  FOUNDATION: 'أساسي',
  PARTIAL: 'جزئي',
  مقفل: 'مقفل',
  LOCKED: 'مقفل',
  READ: 'قراءة',
  READ_ONLY: 'للقراءة فقط',
  IMPLEMENTATION_PRESENT: 'التنفيذ موجود',
  RUNTIME_UNAVAILABLE: 'وقت التشغيل غير متاح',
  PROVENANCE_BLOCKED: 'إثبات المصدر محظور',
  AVAILABLE: 'متاح',
  LOW_RISK_WRITE: 'كتابة منخفضة المخاطر',
  HIGH_RISK_WRITE: 'كتابة عالية المخاطر',
  DESTRUCTIVE: 'تغيير هدّام',
  PRODUCTION_CHANGE: 'تغيير إنتاج',
};

const MODULE_LABELS: Record<string, string> = {
  'command-center': 'مركز الأوامر',
  'truth-center': 'مركز الحقيقة',
  'security-center': 'مركز الأمان',
  'contract-center': 'مركز العقود',
  'operations-center': 'مركز العمليات',
  'incident-center': 'مركز الحوادث',
  'change-center': 'مركز التغييرات',
  'approval-center': 'مركز الموافقات',
  'evidence-ledger': 'سجل الأدلة',
  'truth-graph': 'رسم الحقيقة',
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'المالك',
  ADMIN: 'المشرف',
  OPERATOR: 'المشغّل',
  ANALYST: 'المحلل',
  AUDITOR: 'المدقق',
};

const BLOCKER_LABELS: Record<string, string> = {
  'server-side production identity and command authorization are not connected': 'هوية الإنتاج وتفويض الأوامر على الخادم غير متصلين بعد.',
  'live production truth is bounded to the canonical persistence/evidence read model': 'حقيقة الإنتاج المباشرة محكومة بنموذج القراءة المرجعي للاستمرارية والأدلة.',
  'production identity/session policy is not proven end-to-end': 'لم يتم إثبات سياسة هوية وجلسة الإنتاج من البداية إلى النهاية.',
  'live contract evidence adapter is not connected': 'موصل أدلة العقود المباشر غير متصل بعد.',
  'bounded persistence read model is available; broader live observability is not connected': 'نموذج قراءة الاستمرارية المحدود متاح، لكن المراقبة المباشرة الأوسع غير متصلة.',
  'incident reads are bounded to the canonical persisted event source; alerting/triage is not connected': 'قراءات الحوادث محكومة بمصدر الأحداث المرجعي المخزن، بينما التنبيه والفرز غير متصلين.',
  'deployment/change evidence adapter is not connected': 'موصل أدلة النشر والتغييرات غير متصل بعد.',
  'approval persistence and production execution boundary are not connected': 'استمرارية الموافقات وحدّ تنفيذ الإنتاج غير متصلين بعد.',
  'canonical persisted event read-back is available; complete evidence aggregation is not connected': 'إعادة قراءة الحدث المرجعي المخزن متاحة، لكن تجميع الأدلة الكامل غير متصل.',
  'live evidence nodes are not connected': 'عُقد الأدلة المباشرة غير متصلة بعد.',
};

const labelFor = (value: string) => STATUS_LABELS[value] ?? value;
const moduleLabelFor = (id: string, fallback: string) => MODULE_LABELS[id] ?? fallback;
const roleLabelFor = (role: string) => ROLE_LABELS[role] ?? role;
const blockerLabelFor = (blocker: string | null) => blocker ? (BLOCKER_LABELS[blocker] ?? blocker) : 'لا توجد عوائق معروفة.';


type المركزResponse = {
  ok: true;
  center: المركز;
  capability: string;
  identity: { subject: string };
  truth: { state: 'AVAILABLE' | 'UNAVAILABLE'; productionConnected: boolean; reason: string };
  persistence: { state: 'CONNECTED' | 'BLOCKED'; reason: string; table?: string };
  data: { event: Record<string, unknown> | null; eventLookup: string; execution: 'READ_ONLY' };
  provenance: { exactSha: string; environment: string };
  correlationId: string;
};

type المركزError = { ok: false; error?: { code?: string; correlationId?: string } };

const toneFor = (value: string) => {
  const normalized = value.toUpperCase();
  if (normalized.includes('CONNECTED') || normalized.includes('AVAILABLE') || normalized === 'FOUNDATION' || normalized === 'READ') return 'success';
  if (normalized.includes('BLOCKED') || normalized === 'مقفل') return 'danger';
  if (normalized.includes('PARTIAL') || normalized === 'UNAVAILABLE') return 'warning';
  return 'neutral';
};

function AdminControlPlanePage() {
  const state = INITIAL_CONTROL_PLANE_STATE;
  const [center, setالمركز] = useState<المركز>('truth');
  const [centerState, setالمركزState] = useState<
    { status: 'IDLE' } | { status: 'LOADING' } | { status: 'READY'; data: المركزResponse } | { status: 'BLOCKED'; code: string; correlationId?: string }
  >({ status: 'IDLE' });

  const foundationCount = ADMIN_MODULES.filter((module) => module.status === 'FOUNDATION').length;
  const partialCount = ADMIN_MODULES.filter((module) => module.status === 'PARTIAL').length;
  const blockedCount = ADMIN_MODULES.filter((module) => module.status === 'BLOCKED').length;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setالمركزState({ status: 'LOADING' });
      try {
        const response = await fetch(`/api/admin/centers?center=${encodeURIComponent(center)}`, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        const body = (await response.json()) as المركزResponse | المركزError;
        if (cancelled) return;
        if (!response.ok || body.ok !== true) {
          const error = 'error' in body ? body.error : undefined;
          setالمركزState({ status: 'BLOCKED', code: error?.code ?? `http_${response.status}`, correlationId: error?.correlationId });
          return;
        }
        setالمركزState({ status: 'READY', data: body });
      } catch {
        if (!cancelled) setالمركزState({ status: 'BLOCKED', code: 'center_read_unavailable' });
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [center]);

  const activeالمركز = centerState.status === 'READY' ? centerState.data : null;
  const overallTone = toneFor(state.verdict);

  return (
    <main className="admin-shell" lang="ar" dir="rtl" aria-labelledby="admin-control-plane-title">
      <style>{`
        .admin-shell{--bg:#070a10;--panel:#0d121b;--panel2:#111925;--line:rgba(255,255,255,.09);--muted:#8792a6;--text:#f4f7fb;--accent:#8b7cff;--cyan:#44d7e8;min-height:100vh;background:radial-gradient(circle at 15% 0%,rgba(139,124,255,.16),transparent 34%),radial-gradient(circle at 90% 10%,rgba(68,215,232,.09),transparent 28%),var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px;box-sizing:border-box}.admin-shell *{box-sizing:border-box}.admin-wrap{max-width:1440px;margin:0 auto}.admin-topbar{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px;padding:12px 14px;border:1px solid var(--line);background:rgba(13,18,27,.72);backdrop-filter:blur(18px);border-radius:16px}.brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.08em}.brand-mark{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,var(--accent),var(--cyan));box-shadow:0 0 28px rgba(139,124,255,.25);font-size:13px}.top-meta{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:12px}.hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:end;padding:34px 4px 28px}.eyebrow{display:flex;align-items:center;gap:9px;color:#aeb8c9;text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:700}.pulse{width:7px;height:7px;border-radius:50%;background:var(--cyan);box-shadow:0 0 16px var(--cyan)}h1{margin:10px 0 8px;font-size:clamp(34px,5vw,58px);line-height:1.02;letter-spacing:-.045em} .hero-copy{max-width:760px;margin:0;color:var(--muted);line-height:1.7;font-size:14px}.hero-badge{border:1px solid rgba(139,124,255,.3);background:rgba(139,124,255,.08);border-radius:14px;padding:14px 16px;min-width:210px}.hero-badge small{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.12em}.hero-badge strong{display:block;margin-top:5px;font-size:15px}.status-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.card{border:1px solid var(--line);background:linear-gradient(180deg,rgba(17,25,37,.92),rgba(11,16,24,.92));border-radius:18px;box-shadow:0 18px 55px rgba(0,0,0,.16)}.metric{padding:18px}.metric-label{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.13em;font-weight:700}.metric-value{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:22px;font-weight:800;letter-spacing:-.02em}.metric-detail{margin-top:8px;color:#8f9aad;font-size:12px;line-height:1.5}.dot{width:8px;height:8px;border-radius:50%;display:inline-block}.dot-success{background:#42e6a4;box-shadow:0 0 14px rgba(66,230,164,.65)}.dot-warning{background:#ffc857;box-shadow:0 0 14px rgba(255,200,87,.55)}.dot-danger{background:#ff647c;box-shadow:0 0 14px rgba(255,100,124,.5)}.dot-neutral{background:#8893a7}.section{margin-top:18px;padding:20px}.section-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:18px}.section-title{margin:0;font-size:17px;letter-spacing:-.015em}.section-sub{margin:5px 0 0;color:var(--muted);font-size:12px;line-height:1.55}.center-tabs{display:flex;gap:7px;overflow:auto;padding-bottom:3px}.tab{border:1px solid var(--line);background:#0a0f17;color:#9aa6b8;border-radius:10px;padding:9px 12px;cursor:pointer;font-size:12px;font-weight:700;text-transform:capitalize;transition:.18s}.tab:hover{border-color:rgba(139,124,255,.45);color:#fff}.tab-active{color:#fff;border-color:rgba(139,124,255,.55);background:linear-gradient(135deg,rgba(139,124,255,.18),rgba(68,215,232,.07));box-shadow:inset 0 0 24px rgba(139,124,255,.06)}.read-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.mini{padding:15px;border:1px solid var(--line);background:rgba(6,10,16,.45);border-radius:14px}.mini-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.11em}.mini-value{margin-top:7px;font-size:14px;font-weight:800}.mini-detail{margin-top:5px;color:#8995a8;font-size:11px;line-height:1.45}.blocked{margin-top:14px;padding:16px;border:1px solid rgba(255,100,124,.25);background:rgba(255,100,124,.055);border-radius:14px}.blocked strong{color:#ff91a2;font-size:12px;letter-spacing:.08em}.blocked p{margin:7px 0 0;color:#aab3c2;font-size:12px;line-height:1.6}.provenance{grid-column:span 2}.provenance strong{font-family:"SFMono-Regular",Consolas,monospace;font-size:11px;word-break:break-all}.split{display:grid;grid-template-columns:1.05fr .95fr;gap:18px}.kv{display:grid;grid-template-columns:150px 1fr;gap:9px 14px;margin:0;font-size:12px}.kv dt{color:var(--muted)}.kv dd{margin:0;color:#dce2eb}.path{padding:16px;border-radius:14px;border:1px solid rgba(68,215,232,.16);background:linear-gradient(135deg,rgba(68,215,232,.06),rgba(139,124,255,.05));color:#c7d0df;line-height:1.8;font-size:12px}.module-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.module{padding:16px}.module-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.module-name{font-size:13px;font-weight:800}.pill{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;padding:5px 7px;border-radius:7px}.pill-success{color:#69edb4;background:rgba(66,230,164,.09)}.pill-warning{color:#ffd77e;background:rgba(255,200,87,.08)}.pill-danger{color:#ff91a2;background:rgba(255,100,124,.08)}.pill-neutral{color:#aeb8c8;background:rgba(174,184,200,.07)}.module p{margin:8px 0 0;color:#8d99ab;font-size:11px;line-height:1.55}.module code,.chip{color:#cdd6e5;font-family:"SFMono-Regular",Consolas,monospace}.chip-grid{display:flex;flex-wrap:wrap;gap:7px}.chip{padding:8px 10px;border:1px solid var(--line);background:#090e16;border-radius:9px;font-size:10px}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px}.admin-table{width:100%;border-collapse:collapse;min-width:720px}.admin-table th,.admin-table td{padding:12px 13px;border-bottom:1px solid var(--line);text-align:right;font-size:11px;vertical-align:top}.admin-table th{color:#a9b4c5;font-size:10px;text-transform:uppercase;letter-spacing:.1em;background:rgba(255,255,255,.02)}.admin-table td{color:#cdd5e2}.admin-table tr:last-child td{border-bottom:0}.exec-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.exec{padding:15px}.exec-num{font-size:9px;color:var(--muted);letter-spacing:.1em}.exec-name{margin-top:8px;font-size:12px;font-weight:800}.exec-state{margin-top:8px;font-size:10px;color:#ff91a2}.footer{margin:22px 2px 6px;padding:15px 0;border-top:1px solid var(--line);color:#697589;font-size:10px;line-height:1.7}@media(max-width:1050px){.status-grid,.read-grid,.exec-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.module-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hero{grid-template-columns:1fr}.split{grid-template-columns:1fr}}@media(max-width:650px){.admin-shell{padding:12px}.admin-topbar{margin-bottom:12px}.hero{padding:24px 2px}.status-grid,.read-grid,.module-grid,.exec-grid{grid-template-columns:1fr}.section{padding:15px}.section-head{display:block}.kv{grid-template-columns:1fr}.provenance{grid-column:span 1}.top-meta span{display:none}h1{font-size:38px}}
      `}</style>

      <div className="admin-wrap">
        <div className="admin-topbar">
          <div className="brand"><span className="brand-mark">FX</span><span>FLIXO / الإدارة</span></div>
          <div className="top-meta"><span>مركز التحكم</span><span>•</span><span>أساس للقراءة فقط</span></div>
        </div>

        <header className="hero">
          <div>
            <div className="eyebrow"><span className="pulse" /> مركز التحكم التشغيلي</div>
            <h1 id="admin-control-plane-title">الحقيقة والأدلة.<br />دون تخمين.</h1>
            <p className="hero-copy">مركز تحكم عالي الإشارة للمراقبة الموثقة، وإثبات المصدر، والسياسات، والتنفيذ المنضبط. الواجهة تعمل بمنطق الإغلاق الآمن: لا تُعرض حقيقة إنتاج غير متاحة على أنها سليمة.</p>
          </div>
          <div className="hero-badge"><small>الحالة الحالية</small><strong>{labelFor(state.verdict)}</strong><div style={{ marginTop: 8, color: '#8792a6', fontSize: 11 }}>{state.reason}</div></div>
        </header>

        <section className="status-grid" aria-label="حالة مركز التحكم">
          <Metric label="الاتصال" value={labelFor(state.connected ? 'CONNECTED' : 'UNAVAILABLE')} detail={state.reason} />
          <Metric label="الحكم" value={labelFor(state.verdict)} detail="لا تدّعي طبقة الواجهة أي حالة إنتاج غير مثبتة." />
          <Metric label="الوحدات" value={`${ADMIN_MODULES.length}`} detail={`${foundationCount} أساسية · ${partialCount} جزئية · ${blockedCount} محظورة`} />
          <Metric label="التنفيذ" value="مقفل" detail="أي تغيير يتطلب التفويض والسياسة والموافقة والأدلة." />
        </section>

        <section className="card section" aria-labelledby="admin-read-model-title">
          <div className="section-head"><div><h2 className="section-title" id="admin-read-model-title">نموذج القراءة المرجعي</h2><p className="section-sub">حالة الخادم الموثقة بحسب المركز التشغيلي المختار. تبقى الأخطاء صريحة وقابلة للتتبع.</p></div><span className={`pill pill-${overallTone}`}>إغلاق آمن</span></div>
          <div className="center-tabs" role="tablist" aria-label="مراكز الإدارة">
            {CENTER_OPTIONS.map((option) => <button key={option} type="button" role="tab" aria-selected={center === option} className={`tab ${center === option ? 'tab-active' : ''}`} onClick={() => setالمركز(option)}>{CENTER_LABELS[option]}</button>)}
          </div>
          <div style={{ marginTop: 14 }} aria-live="polite">
            {centerState.status === 'LOADING' && <div className="mini">جارٍ قراءة حالة المركز الموثقة…</div>}
            {centerState.status === 'IDLE' && <div className="mini">في انتظار تهيئة نموذج القراءة.</div>}
            {centerState.status === 'BLOCKED' && <div className="blocked"><strong>محظور · لم يتم استنتاج حالة إنتاج</strong><p>لم ينتج نموذج القراءة المرجعي نتيجة موثقة. الخطأ <code>{centerState.code}</code>{centerState.correlationId ? ` · الطلب ${centerState.correlationId}` : ''}.</p></div>}
            {activeالمركز && <div className="read-grid">
              <Mini label="المركز" value={activeالمركز.center.toUpperCase()} detail={`الصلاحية ${activeالمركز.capability}`} />
              <Mini label="الحقيقة" value={activeالمركز.truth.state} detail={activeالمركز.truth.reason} tone={toneFor(activeالمركز.truth.state)} />
              <Mini label="الاستمرارية" value={activeالمركز.persistence.state} detail={activeالمركز.persistence.reason} tone={toneFor(activeالمركز.persistence.state)} />
              <Mini label="التنفيذ" value={activeالمركز.data.execution} detail="للمراقبة فقط." />
              <Mini label="الهوية" value={activeالمركز.identity.subject} detail={`معرّف التتبع ${activeالمركز.correlationId}`} />
              <div className="mini provenance"><div className="mini-label">إثبات المصدر الدقيق</div><strong style={{ display: 'block', marginTop: 7 }}>{activeالمركز.provenance.exactSha}</strong><div className="mini-detail">البيئة: {activeالمركز.provenance.environment}</div></div>
            </div>}
          </div>
        </section>

        <section className="card section">
          <div className="section-head"><div><h2 className="section-title">حدود الحقيقة</h2><p className="section-sub">الحالات الموثقة صريحة؛ ولا يمكن أبدًا تحويل غير المتاح أو القديم أو غير المعروف إلى حالة سليمة.</p></div></div>
          <div className="split">
            <dl className="kv"><dt>الحكم</dt><dd>{state.verdict}</dd><dt>السبب</dt><dd><code>{state.reason}</code></dd><dt>سجلات الأدلة</dt><dd>{state.evidence.length}</dd><dt>الصلاحيات المعلنة</dt><dd>{state.capabilities.length}</dd></dl>
            <div className="path"><strong>دورة التنفيذ الآمن</strong><br />النية ← أمر حتمي ← تفويض ← سياسة ← معاينة ← موافقة ← تنفيذ ← تحقق ← دليل ← تدقيق</div>
          </div>
        </section>

        <section className="section" aria-labelledby="admin-modules-title">
          <div className="section-head"><div><h2 className="section-title" id="admin-modules-title">وحدات التحكم</h2><p className="section-sub">كل وحدة تعرض حالة تنفيذها والعائق المرتبط بها بوضوح. لا توجد بيانات مباشرة مصطنعة.</p></div></div>
          <div className="module-grid">
            {ADMIN_MODULES.map((module) => { const tone = toneFor(module.status); return <article className="card module" key={module.id}><div className="module-top"><strong className="module-name">{moduleLabelFor(module.id, module.name)}</strong><span className={`pill pill-${tone}`}>{labelFor(module.status)}</span></div><p>الصلاحية · <code>{module.capability}</code></p><p>الحقيقة · <strong style={{ color: '#dbe2ec' }}>{labelFor(module.truth)}</strong></p><p>{blockerLabelFor(module.blocker)}</p><p style={{ marginTop: 11, textTransform: 'uppercase', letterSpacing: '.08em', fontSize: 9 }}>حالة التنفيذ · {labelFor(module.execution)}</p></article>; })}
          </div>
        </section>

        <section className="card section">
          <div className="section-head"><div><h2 className="section-title">دليل الصلاحيات</h2><p className="section-sub">الصلاحية هي وحدة التفويض؛ أما الدور فهو مجرد ربط بالسياسة.</p></div></div>
          <div className="chip-grid">{ADMIN_CAPABILITIES.map((capability) => <code className="chip" key={capability}>{capability}</code>)}</div>
        </section>

        <section className="card section">
          <div className="section-head"><div><h2 className="section-title">الدور ← الصلاحيات</h2><p className="section-sub">هذه مصفوفة سياسات فقط، ولا تُعد إثباتًا لهوية إنتاج موثقة.</p></div></div>
          <div className="table-wrap"><table className="admin-table"><thead><tr><th>الدور</th><th>الصلاحيات المعلنة</th></tr></thead><tbody>{Object.entries(ADMIN_ROLE_CAPABILITY_MATRIX).map(([role, capabilities]) => <tr key={role}><td><strong>{roleLabelFor(role)}</strong></td><td>{capabilities.join(' · ')}</td></tr>)}</tbody></table></div>
        </section>

        <section className="card section">
          <div className="section-head"><div><h2 className="section-title">سلامة التنفيذ</h2><p className="section-sub">تغييرات الإنتاج تظل غير متاحة حتى تتوفر أدلة الاستمرارية والتفويض والموافقة.</p></div></div>
          <div className="exec-grid">{ADMIN_EXECUTION_CLASSES.map((executionClass, index) => <article className="mini exec" key={executionClass}><div className="exec-num">الفئة {String(index + 1).padStart(2, '0')}</div><div className="exec-name">{labelFor(executionClass)}</div><div className={executionClass === 'READ' ? 'metric-detail' : 'exec-state'}>{executionClass === 'READ' ? 'مسموح عبر حدود القراءة الموثقة.' : 'مقفل'}</div></article>)}</div>
        </section>

        <footer className="footer">لا يتم استنتاج حقيقة الإنتاج من هذه الصفحة. تتطلب الحالة المباشرة موصلات خادمية موثوقة وأدلة SHA دقيقة من مسار الاختبار والاعتماد المرجعي.</footer>
      </div>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  const tone = toneFor(value);
  return <article className="card metric"><div className="metric-label">{label}</div><div className="metric-value"><span className={`dot dot-${tone}`} />{value}</div><div className="metric-detail">{detail}</div></article>;
}

function Mini({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail: string; tone?: string }) {
  return <article className="mini"><div className="mini-label">{label}</div><div className="mini-value"><span className={`dot dot-${tone}`} style={{ marginRight: 7 }} />{value}</div><div className="mini-detail">{detail}</div></article>;
}

export const adminControlPlaneRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminControlPlanePage,
  head: () => ({ meta: [{ title: 'FLIXO — مركز إدارة النظام' }, { name: 'robots', content: 'noindex,nofollow,noarchive' }] }),
});
