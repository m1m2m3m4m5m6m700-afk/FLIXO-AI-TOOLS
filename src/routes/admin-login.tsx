import { createRoute, useNavigate } from '@tanstack/react-router';
import { FormEvent, useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { loginAdmin } from '@/lib/admin/auth';
import { rootRoute } from './__root';
import './admin.css';

export const adminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/login',
  head: () => ({
    meta: [
      { title: 'FLIXO Admin Login' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await loginAdmin({ data: { password } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await navigate({ to: '/admin' });
    } catch {
      setError('Admin authentication is not configured or unavailable.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-login-shell">
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <div className="admin-login-icon"><ShieldCheck size={22} /></div>
        <span className="admin-eyebrow">PRIVATE AREA</span>
        <h1 id="admin-login-title">FLIXO Admin</h1>
        <p>Server-side administrator authentication. No credential is stored in the browser.</p>
        <form onSubmit={submit} className="admin-login-form">
          <label htmlFor="admin-password">Administrator password</label>
          <div className="admin-password-field">
            <LockKeyhole size={17} aria-hidden="true" />
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error && <div className="admin-notice" role="alert">{error}</div>}
          <button className="admin-primary admin-login-button" type="submit" disabled={busy}>
            {busy ? 'Authenticating…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
