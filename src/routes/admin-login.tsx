import { createRoute, useNavigate } from '@tanstack/react-router';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { loginAdmin } from '@/lib/admin/auth';
import { rootRoute } from './__root';
import './admin.css';

export const Route = createRoute({
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

/** Stable export used by the manually maintained route registry. */
export const adminLoginRoute = Route;

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
        setError(result.error ?? 'Administrator authentication is unavailable in this build.');
        return;
      }
      await navigate({ to: '/admin' });
    } catch {
      setError('Administrator authentication is not configured or available.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-login-shell">
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <div className="admin-login-icon"><ShieldCheck size={22} /></div>
        <span className="admin-eyebrow">ADMIN PREVIEW</span>
        <h1 id="admin-login-title">FLIXO Admin</h1>
        <p>This administration area is currently experimental. Secure server-side authentication will be enabled in a future backend release.</p>
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
              disabled
            />
          </div>
          {error && <div className="admin-notice" role="alert">{error}</div>}
          <button className="admin-primary admin-login-button" type="submit" disabled>
            Authentication unavailable
          </button>
        </form>
      </section>
    </main>
  );
}
