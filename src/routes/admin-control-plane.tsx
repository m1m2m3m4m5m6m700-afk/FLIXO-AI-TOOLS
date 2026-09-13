import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import {
  ADMIN_CAPABILITIES,
  INITIAL_CONTROL_PLANE_STATE,
} from '../lib/admin/control-plane';
import {
  ADMIN_EXECUTION_CLASSES,
  ADMIN_MODULES,
  ADMIN_ROLE_CAPABILITY_MATRIX,
} from '../lib/admin/module-registry';

const statusText = {
  FOUNDATION: 'Foundation',
  PARTIAL: 'Partial',
  BLOCKED: 'Blocked',
} as const;

function AdminControlPlanePage() {
  const state = INITIAL_CONTROL_PLANE_STATE;
  const foundationCount = ADMIN_MODULES.filter((module) => module.status === 'FOUNDATION').length;
  const partialCount = ADMIN_MODULES.filter((module) => module.status === 'PARTIAL').length;
  const blockedCount = ADMIN_MODULES.filter((module) => module.status === 'BLOCKED').length;

  return (
    <main
      aria-labelledby="admin-control-plane-title"
      style={{
        maxWidth: 1240,
        margin: '0 auto',
        padding: '72px 24px 64px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <header style={{ marginBottom: 32 }}>
        <p style={{ margin: 0, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 12 }}>
          FLIXO / Admin Control Plane
        </p>
        <h1 id="admin-control-plane-title" style={{ margin: '10px 0 8px', fontSize: 42 }}>
          Operational Truth Center
        </h1>
        <p style={{ maxWidth: 840, margin: 0, opacity: 0.72, lineHeight: 1.6 }}>
          Control-plane foundation for authenticated observation, evidence, policy and controlled execution. Live production truth remains fail-closed until its server-side sources are connected.
        </p>
      </header>

      <section aria-label="Control plane status" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <StatusCard label="Connection" value={state.connected ? 'CONNECTED' : 'UNAVAILABLE'} detail={state.reason} />
        <StatusCard label="Verdict" value={state.verdict} detail="No production claim is asserted by this foundation." />
        <StatusCard label="Modules" value={`${ADMIN_MODULES.length}`} detail={`${foundationCount} foundation · ${partialCount} partial · ${blockedCount} blocked`} />
        <StatusCard label="Execution" value="LOCKED" detail="Production mutation is unavailable until policy, approval and persistence are proven." />
      </section>

      <section style={{ marginTop: 28, padding: 24, border: '1px solid currentColor', borderRadius: 16 }}>
        <SectionTitle title="Truth boundary" subtitle="Authoritative states are explicit; unavailable, stale and unknown cannot become green." />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 1fr)', gap: 20 }}>
          <dl style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px 16px', margin: 0 }}>
            <dt>Verdict</dt><dd>{state.verdict}</dd>
            <dt>Reason</dt><dd><code>{state.reason}</code></dd>
            <dt>Evidence</dt><dd>{state.evidence.length} records</dd>
            <dt>Capabilities</dt><dd>{state.capabilities.length} declared capabilities</dd>
          </dl>
          <div>
            <div style={{ fontSize: 12, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Execution path</div>
            <p style={{ margin: '8px 0 0', lineHeight: 1.7 }}>
              Intent → deterministic command → authorization → policy → preview → approval → execution → verification → evidence → audit
            </p>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 28 }} aria-labelledby="admin-modules-title">
        <SectionTitle id="admin-modules-title" title="Control modules" subtitle="Each module has an explicit implementation posture and blocker; no synthetic live data is rendered." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 12 }}>
          {ADMIN_MODULES.map((module) => (
            <article key={module.id} style={{ padding: 18, border: '1px solid currentColor', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <strong>{module.name}</strong>
                <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{statusText[module.status]}</span>
              </div>
              <p style={{ margin: '10px 0 6px', fontSize: 13, opacity: 0.72 }}>
                Capability: <code>{module.capability}</code>
              </p>
              <p style={{ margin: '4px 0', fontSize: 13 }}>
                Truth: <strong>{module.truth}</strong>
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, opacity: 0.75 }}>
                {module.blocker ?? 'No known blocker.'}
              </p>
              <div style={{ marginTop: 12, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Execution: {module.execution.replaceAll('_', ' ')}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 28, padding: 24, border: '1px solid currentColor', borderRadius: 16 }}>
        <SectionTitle title="Capability catalog" subtitle="Capability is the authorization unit; role is only a policy mapping." />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ADMIN_CAPABILITIES.map((capability) => (
            <code key={capability} style={{ padding: '7px 10px', border: '1px solid currentColor', borderRadius: 999, fontSize: 12 }}>
              {capability}
            </code>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 28, padding: 24, border: '1px solid currentColor', borderRadius: 16 }}>
        <SectionTitle title="Role → capability posture" subtitle="Policy matrix only; it is not evidence that a production principal is authenticated." />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                <th style={cellStyle}>Role</th>
                <th style={cellStyle}>Declared capabilities</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ADMIN_ROLE_CAPABILITY_MATRIX).map(([role, capabilities]) => (
                <tr key={role}>
                  <th scope="row" style={{ ...cellStyle, textAlign: 'left' }}>{role}</th>
                  <td style={cellStyle}>{capabilities.join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 28, padding: 24, border: '1px solid currentColor', borderRadius: 16 }}>
        <SectionTitle title="Execution safety" subtitle="Classes are declared now; all production mutation remains unavailable until the required persistence, authorization and approval proofs exist." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {ADMIN_EXECUTION_CLASSES.map((executionClass, index) => (
            <article key={executionClass} style={{ padding: 14, border: '1px solid currentColor', borderRadius: 12 }}>
              <div style={{ fontSize: 11, opacity: 0.62 }}>CLASS {index + 1}</div>
              <strong style={{ display: 'block', marginTop: 6 }}>{executionClass.replaceAll('_', ' ')}</strong>
              <span style={{ display: 'block', marginTop: 6, fontSize: 12 }}>{executionClass === 'READ' ? 'Allowed only through authenticated read boundaries.' : 'LOCKED'}</span>
            </article>
          ))}
        </div>
      </section>

      <footer style={{ marginTop: 32, paddingTop: 18, borderTop: '1px solid currentColor', opacity: 0.68, fontSize: 12, lineHeight: 1.6 }}>
        Production truth is not inferred from this page. Live state requires authoritative server-side adapters and exact-SHA evidence from the canonical test/certification pipeline.
      </footer>
    </main>
  );
}

const cellStyle = { padding: '12px 10px', borderBottom: '1px solid currentColor', verticalAlign: 'top', fontSize: 12 } as const;

function SectionTitle({ id, title, subtitle }: { id?: string; title: string; subtitle: string }) {
  return (
    <header id={id} style={{ marginBottom: 18 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
      <p style={{ margin: '6px 0 0', opacity: 0.68, fontSize: 13, lineHeight: 1.5 }}>{subtitle}</p>
    </header>
  );
}

function StatusCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article style={{ padding: 20, border: '1px solid currentColor', borderRadius: 14 }}>
      <div style={{ fontSize: 11, opacity: 0.62, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 700 }}>{value}</div>
      <div style={{ marginTop: 7, fontSize: 12, lineHeight: 1.45, opacity: 0.66 }}>{detail}</div>
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
