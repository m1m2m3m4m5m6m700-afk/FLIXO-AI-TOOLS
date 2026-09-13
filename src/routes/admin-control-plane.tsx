import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { INITIAL_CONTROL_PLANE_STATE } from '../lib/admin/control-plane';

function AdminControlPlanePage() {
  const state = INITIAL_CONTROL_PLANE_STATE;

  return (
    <main
      aria-labelledby="admin-control-plane-title"
      style={{ maxWidth: 1180, margin: '0 auto', padding: '96px 24px 64px', fontFamily: 'system-ui, sans-serif' }}
    >
      <header style={{ marginBottom: 32 }}>
        <p style={{ margin: 0, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 12 }}>FLIXO / Admin Control Plane</p>
        <h1 id="admin-control-plane-title" style={{ margin: '10px 0 8px', fontSize: 42 }}>Operational Truth Center</h1>
        <p style={{ maxWidth: 760, margin: 0, opacity: 0.72 }}>
          The control plane is fail-closed until a server-side identity, authorization, execution and evidence boundary is connected.
        </p>
      </header>

      <section aria-label="Control plane status" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <StatusCard label="Connection" value={state.connected ? 'CONNECTED' : 'UNAVAILABLE'} />
        <StatusCard label="Verdict" value={state.verdict} />
        <StatusCard label="Evidence" value={`${state.evidence.length} records`} />
        <StatusCard label="Execution" value="LOCKED" />
      </section>

      <section style={{ marginTop: 28, padding: 24, border: '1px solid currentColor', borderRadius: 16 }}>
        <h2 style={{ marginTop: 0 }}>Truth boundary</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '10px 18px', margin: 0 }}>
          <dt>Verdict</dt><dd>{state.verdict}</dd>
          <dt>Reason</dt><dd><code>{state.reason}</code></dd>
          <dt>Capabilities</dt><dd>{state.capabilities.join(' · ')}</dd>
          <dt>Evidence</dt><dd>None — no production claim is asserted by this foundation.</dd>
        </dl>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Control modules</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {['Command Center', 'Truth Center', 'Security Center', 'Contract Center', 'Operations Center', 'Incident Center', 'Change Center', 'Approval Center', 'Evidence Ledger', 'Truth Graph'].map((module) => (
            <article key={module} style={{ padding: 18, border: '1px solid currentColor', borderRadius: 12 }}>
              <strong>{module}</strong>
              <p style={{ marginBottom: 0, opacity: 0.65 }}>Foundation registered; runtime source is not connected.</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <article style={{ padding: 20, border: '1px solid currentColor', borderRadius: 14 }}>
      <div style={{ fontSize: 12, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700 }}>{value}</div>
    </article>
  );
}

export const adminControlPlaneRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminControlPlanePage,
  head: () => ({
    meta: [
      { title: 'FLIXO Admin Control Plane' },
      { name: 'robots', content: 'noindex,nofollow,noarchive' },
    ],
  }),
});
