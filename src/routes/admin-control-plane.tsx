import { useEffect, useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { ADMIN_CAPABILITIES, INITIAL_CONTROL_PLANE_STATE } from '../lib/admin/control-plane';
import { ADMIN_EXECUTION_CLASSES, ADMIN_MODULES, ADMIN_ROLE_CAPABILITY_MATRIX } from '../lib/admin/module-registry';

const CENTER_OPTIONS = ['truth', 'operations', 'incident', 'evidence', 'security', 'contract'] as const;
type Center = (typeof CENTER_OPTIONS)[number];

type CenterResponse = {
  ok: true;
  center: Center;
  capability: string;
  identity: { subject: string };
  truth: { state: 'AVAILABLE' | 'UNAVAILABLE'; productionConnected: boolean; reason: string };
  persistence: { state: 'CONNECTED' | 'BLOCKED'; reason: string; table?: string };
  data: { event: Record<string, unknown> | null; eventLookup: string; execution: 'READ_ONLY' };
  provenance: { exactSha: string; environment: string };
  correlationId: string;
};

type CenterError = { ok: false; error?: { code?: string; correlationId?: string } };

const toneFor = (value: string) => {
  const normalized = value.toUpperCase();
  if (normalized.includes('CONNECTED') || normalized.includes('AVAILABLE') || normalized === 'FOUNDATION' || normalized === 'READ') return 'success';
  if (normalized.includes('BLOCKED') || normalized === 'LOCKED') return 'danger';
  if (normalized.includes('PARTIAL') || normalized === 'UNAVAILABLE') return 'warning';
  return 'neutral';
};

function AdminControlPlanePage() {
  const state = INITIAL_CONTROL_PLANE_STATE;
  const [center, setCenter] = useState<Center>('truth');
  const [centerState, setCenterState] = useState<
    { status: 'IDLE' } | { status: 'LOADING' } | { status: 'READY'; data: CenterResponse } | { status: 'BLOCKED'; code: string; correlationId?: string }
  >({ status: 'IDLE' });

  const foundationCount = ADMIN_MODULES.filter((module) => module.status === 'FOUNDATION').length;
  const partialCount = ADMIN_MODULES.filter((module) => module.status === 'PARTIAL').length;
  const blockedCount = ADMIN_MODULES.filter((module) => module.status === 'BLOCKED').length;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setCenterState({ status: 'LOADING' });
      try {
        const response = await fetch(`/api/admin/centers?center=${encodeURIComponent(center)}`, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        const body = (await response.json()) as CenterResponse | CenterError;
        if (cancelled) return;
        if (!response.ok || body.ok !== true) {
          const error = 'error' in body ? body.error : undefined;
          setCenterState({ status: 'BLOCKED', code: error?.code ?? `http_${response.status}`, correlationId: error?.correlationId });
          return;
        }
        setCenterState({ status: 'READY', data: body });
      } catch {
        if (!cancelled) setCenterState({ status: 'BLOCKED', code: 'center_read_unavailable' });
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [center]);

  const activeCenter = centerState.status === 'READY' ? centerState.data : null;
  const overallTone = toneFor(state.verdict);

  return (
    <main className="admin-shell" aria-labelledby="admin-control-plane-title">
      <style>{`
        .admin-shell{--bg:#070a10;--panel:#0d121b;--panel2:#111925;--line:rgba(255,255,255,.09);--muted:#8792a6;--text:#f4f7fb;--accent:#8b7cff;--cyan:#44d7e8;min-height:100vh;background:radial-gradient(circle at 15% 0%,rgba(139,124,255,.16),transparent 34%),radial-gradient(circle at 90% 10%,rgba(68,215,232,.09),transparent 28%),var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px;box-sizing:border-box}.admin-shell *{box-sizing:border-box}.admin-wrap{max-width:1440px;margin:0 auto}.admin-topbar{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px;padding:12px 14px;border:1px solid var(--line);background:rgba(13,18,27,.72);backdrop-filter:blur(18px);border-radius:16px}.brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.08em}.brand-mark{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,var(--accent),var(--cyan));box-shadow:0 0 28px rgba(139,124,255,.25);font-size:13px}.top-meta{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:12px}.hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:end;padding:34px 4px 28px}.eyebrow{display:flex;align-items:center;gap:9px;color:#aeb8c9;text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:700}.pulse{width:7px;height:7px;border-radius:50%;background:var(--cyan);box-shadow:0 0 16px var(--cyan)}h1{margin:10px 0 8px;font-size:clamp(34px,5vw,58px);line-height:1.02;letter-spacing:-.045em} .hero-copy{max-width:760px;margin:0;color:var(--muted);line-height:1.7;font-size:14px}.hero-badge{border:1px solid rgba(139,124,255,.3);background:rgba(139,124,255,.08);border-radius:14px;padding:14px 16px;min-width:210px}.hero-badge small{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.12em}.hero-badge strong{display:block;margin-top:5px;font-size:15px}.status-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.card{border:1px solid var(--line);background:linear-gradient(180deg,rgba(17,25,37,.92),rgba(11,16,24,.92));border-radius:18px;box-shadow:0 18px 55px rgba(0,0,0,.16)}.metric{padding:18px}.metric-label{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.13em;font-weight:700}.metric-value{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:22px;font-weight:800;letter-spacing:-.02em}.metric-detail{margin-top:8px;color:#8f9aad;font-size:12px;line-height:1.5}.dot{width:8px;height:8px;border-radius:50%;display:inline-block}.dot-success{background:#42e6a4;box-shadow:0 0 14px rgba(66,230,164,.65)}.dot-warning{background:#ffc857;box-shadow:0 0 14px rgba(255,200,87,.55)}.dot-danger{background:#ff647c;box-shadow:0 0 14px rgba(255,100,124,.5)}.dot-neutral{background:#8893a7}.section{margin-top:18px;padding:20px}.section-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:18px}.section-title{margin:0;font-size:17px;letter-spacing:-.015em}.section-sub{margin:5px 0 0;color:var(--muted);font-size:12px;line-height:1.55}.center-tabs{display:flex;gap:7px;overflow:auto;padding-bottom:3px}.tab{border:1px solid var(--line);background:#0a0f17;color:#9aa6b8;border-radius:10px;padding:9px 12px;cursor:pointer;font-size:12px;font-weight:700;text-transform:capitalize;transition:.18s}.tab:hover{border-color:rgba(139,124,255,.45);color:#fff}.tab-active{color:#fff;border-color:rgba(139,124,255,.55);background:linear-gradient(135deg,rgba(139,124,255,.18),rgba(68,215,232,.07));box-shadow:inset 0 0 24px rgba(139,124,255,.06)}.read-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.mini{padding:15px;border:1px solid var(--line);background:rgba(6,10,16,.45);border-radius:14px}.mini-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.11em}.mini-value{margin-top:7px;font-size:14px;font-weight:800}.mini-detail{margin-top:5px;color:#8995a8;font-size:11px;line-height:1.45}.blocked{margin-top:14px;padding:16px;border:1px solid rgba(255,100,124,.25);background:rgba(255,100,124,.055);border-radius:14px}.blocked strong{color:#ff91a2;font-size:12px;letter-spacing:.08em}.blocked p{margin:7px 0 0;color:#aab3c2;font-size:12px;line-height:1.6}.provenance{grid-column:span 2}.provenance strong{font-family:"SFMono-Regular",Consolas,monospace;font-size:11px;word-break:break-all}.split{display:grid;grid-template-columns:1.05fr .95fr;gap:18px}.kv{display:grid;grid-template-columns:150px 1fr;gap:9px 14px;margin:0;font-size:12px}.kv dt{color:var(--muted)}.kv dd{margin:0;color:#dce2eb}.path{padding:16px;border-radius:14px;border:1px solid rgba(68,215,232,.16);background:linear-gradient(135deg,rgba(68,215,232,.06),rgba(139,124,255,.05));color:#c7d0df;line-height:1.8;font-size:12px}.module-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.module{padding:16px}.module-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.module-name{font-size:13px;font-weight:800}.pill{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;padding:5px 7px;border-radius:7px}.pill-success{color:#69edb4;background:rgba(66,230,164,.09)}.pill-warning{color:#ffd77e;background:rgba(255,200,87,.08)}.pill-danger{color:#ff91a2;background:rgba(255,100,124,.08)}.pill-neutral{color:#aeb8c8;background:rgba(174,184,200,.07)}.module p{margin:8px 0 0;color:#8d99ab;font-size:11px;line-height:1.55}.module code,.chip{color:#cdd6e5;font-family:"SFMono-Regular",Consolas,monospace}.chip-grid{display:flex;flex-wrap:wrap;gap:7px}.chip{padding:8px 10px;border:1px solid var(--line);background:#090e16;border-radius:9px;font-size:10px}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px}.admin-table{width:100%;border-collapse:collapse;min-width:720px}.admin-table th,.admin-table td{padding:12px 13px;border-bottom:1px solid var(--line);text-align:left;font-size:11px;vertical-align:top}.admin-table th{color:#a9b4c5;font-size:10px;text-transform:uppercase;letter-spacing:.1em;background:rgba(255,255,255,.02)}.admin-table td{color:#cdd5e2}.admin-table tr:last-child td{border-bottom:0}.exec-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.exec{padding:15px}.exec-num{font-size:9px;color:var(--muted);letter-spacing:.1em}.exec-name{margin-top:8px;font-size:12px;font-weight:800}.exec-state{margin-top:8px;font-size:10px;color:#ff91a2}.footer{margin:22px 2px 6px;padding:15px 0;border-top:1px solid var(--line);color:#697589;font-size:10px;line-height:1.7}@media(max-width:1050px){.status-grid,.read-grid,.exec-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.module-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hero{grid-template-columns:1fr}.split{grid-template-columns:1fr}}@media(max-width:650px){.admin-shell{padding:12px}.admin-topbar{margin-bottom:12px}.hero{padding:24px 2px}.status-grid,.read-grid,.module-grid,.exec-grid{grid-template-columns:1fr}.section{padding:15px}.section-head{display:block}.kv{grid-template-columns:1fr}.provenance{grid-column:span 1}.top-meta span{display:none}h1{font-size:38px}}
      `}</style>

      <div className="admin-wrap">
        <div className="admin-topbar">
          <div className="brand"><span className="brand-mark">FX</span><span>FLIXO / ADMIN</span></div>
          <div className="top-meta"><span>CONTROL PLANE</span><span>•</span><span>READ-ONLY FOUNDATION</span></div>
        </div>

        <header className="hero">
          <div>
            <div className="eyebrow"><span className="pulse" /> Operational control plane</div>
            <h1 id="admin-control-plane-title">Truth, evidence.<br />Zero guesswork.</h1>
            <p className="hero-copy">A high-signal command center for authenticated observation, provenance, policy and controlled execution. The interface deliberately fails closed: unavailable production truth is never presented as healthy.</p>
          </div>
          <div className="hero-badge"><small>Current posture</small><strong>{state.verdict}</strong><div style={{ marginTop: 8, color: '#8792a6', fontSize: 11 }}>{state.reason}</div></div>
        </header>

        <section className="status-grid" aria-label="Control plane status">
          <Metric label="Connection" value={state.connected ? 'CONNECTED' : 'UNAVAILABLE'} detail={state.reason} />
          <Metric label="Verdict" value={state.verdict} detail="No production claim is asserted by the UI foundation." />
          <Metric label="Modules" value={`${ADMIN_MODULES.length}`} detail={`${foundationCount} foundation · ${partialCount} partial · ${blockedCount} blocked`} />
          <Metric label="Execution" value="LOCKED" detail="Mutation requires authorization, policy, approval and evidence." />
        </section>

        <section className="card section" aria-labelledby="admin-read-model-title">
          <div className="section-head"><div><h2 className="section-title" id="admin-read-model-title">Canonical read model</h2><p className="section-sub">Authenticated server state, selected by operational center. Errors remain explicit and traceable.</p></div><span className={`pill pill-${overallTone}`}>FAIL-CLOSED</span></div>
          <div className="center-tabs" role="tablist" aria-label="Admin centers">
            {CENTER_OPTIONS.map((option) => <button key={option} type="button" role="tab" aria-selected={center === option} className={`tab ${center === option ? 'tab-active' : ''}`} onClick={() => setCenter(option)}>{option}</button>)}
          </div>
          <div style={{ marginTop: 14 }} aria-live="polite">
            {centerState.status === 'LOADING' && <div className="mini">Reading authenticated center state…</div>}
            {centerState.status === 'IDLE' && <div className="mini">Waiting for read-model initialization.</div>}
            {centerState.status === 'BLOCKED' && <div className="blocked"><strong>BLOCKED · NO PRODUCTION STATE INFERRED</strong><p>The canonical read model did not produce an authenticated result. Error <code>{centerState.code}</code>{centerState.correlationId ? ` · request ${centerState.correlationId}` : ''}.</p></div>}
            {activeCenter && <div className="read-grid">
              <Mini label="Center" value={activeCenter.center.toUpperCase()} detail={`Capability ${activeCenter.capability}`} />
              <Mini label="Truth" value={activeCenter.truth.state} detail={activeCenter.truth.reason} tone={toneFor(activeCenter.truth.state)} />
              <Mini label="Persistence" value={activeCenter.persistence.state} detail={activeCenter.persistence.reason} tone={toneFor(activeCenter.persistence.state)} />
              <Mini label="Execution" value={activeCenter.data.execution} detail="Observation only." />
              <Mini label="Identity" value={activeCenter.identity.subject} detail={`Correlation ${activeCenter.correlationId}`} />
              <div className="mini provenance"><div className="mini-label">Exact provenance</div><strong style={{ display: 'block', marginTop: 7 }}>{activeCenter.provenance.exactSha}</strong><div className="mini-detail">Environment: {activeCenter.provenance.environment}</div></div>
            </div>}
          </div>
        </section>

        <section className="card section">
          <div className="section-head"><div><h2 className="section-title">Truth boundary</h2><p className="section-sub">Authoritative states are explicit; unavailable, stale and unknown can never become green.</p></div></div>
          <div className="split">
            <dl className="kv"><dt>Verdict</dt><dd>{state.verdict}</dd><dt>Reason</dt><dd><code>{state.reason}</code></dd><dt>Evidence records</dt><dd>{state.evidence.length}</dd><dt>Declared capabilities</dt><dd>{state.capabilities.length}</dd></dl>
            <div className="path"><strong>Safe execution lifecycle</strong><br />Intent → deterministic command → authorization → policy → preview → approval → execution → verification → evidence → audit</div>
          </div>
        </section>

        <section className="section" aria-labelledby="admin-modules-title">
          <div className="section-head"><div><h2 className="section-title" id="admin-modules-title">Control modules</h2><p className="section-sub">Every module exposes an explicit implementation posture and blocker. No synthetic live data.</p></div></div>
          <div className="module-grid">
            {ADMIN_MODULES.map((module) => { const tone = toneFor(module.status); return <article className="card module" key={module.id}><div className="module-top"><strong className="module-name">{module.name}</strong><span className={`pill pill-${tone}`}>{module.status}</span></div><p>Capability · <code>{module.capability}</code></p><p>Truth · <strong style={{ color: '#dbe2ec' }}>{module.truth}</strong></p><p>{module.blocker ?? 'No known blocker.'}</p><p style={{ marginTop: 11, textTransform: 'uppercase', letterSpacing: '.08em', fontSize: 9 }}>Execution · {module.execution.replaceAll('_', ' ')}</p></article>; })}
          </div>
        </section>

        <section className="card section">
          <div className="section-head"><div><h2 className="section-title">Capability catalog</h2><p className="section-sub">Capability is the authorization unit; role is only a policy mapping.</p></div></div>
          <div className="chip-grid">{ADMIN_CAPABILITIES.map((capability) => <code className="chip" key={capability}>{capability}</code>)}</div>
        </section>

        <section className="card section">
          <div className="section-head"><div><h2 className="section-title">Role → capability posture</h2><p className="section-sub">Policy matrix only — never treated as proof of an authenticated production principal.</p></div></div>
          <div className="table-wrap"><table className="admin-table"><thead><tr><th>Role</th><th>Declared capabilities</th></tr></thead><tbody>{Object.entries(ADMIN_ROLE_CAPABILITY_MATRIX).map(([role, capabilities]) => <tr key={role}><td><strong>{role}</strong></td><td>{capabilities.join(' · ')}</td></tr>)}</tbody></table></div>
        </section>

        <section className="card section">
          <div className="section-head"><div><h2 className="section-title">Execution safety</h2><p className="section-sub">Production mutation remains unavailable until persistence, authorization and approval proofs exist.</p></div></div>
          <div className="exec-grid">{ADMIN_EXECUTION_CLASSES.map((executionClass, index) => <article className="mini exec" key={executionClass}><div className="exec-num">CLASS {String(index + 1).padStart(2, '0')}</div><div className="exec-name">{executionClass.replaceAll('_', ' ')}</div><div className={executionClass === 'READ' ? 'metric-detail' : 'exec-state'}>{executionClass === 'READ' ? 'Allowed through authenticated read boundaries.' : 'LOCKED'}</div></article>)}</div>
        </section>

        <footer className="footer">Production truth is not inferred from this page. Live state requires authoritative server-side adapters and exact-SHA evidence from the canonical test and certification pipeline.</footer>
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
  head: () => ({ meta: [{ title: 'FLIXO Admin Control Plane' }, { name: 'robots', content: 'noindex,nofollow,noarchive' }] }),
});
