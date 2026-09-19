import { FormEvent, useEffect, useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';

const getSession = async () => {
  const response = await fetch('/api/admin/session', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  return response.ok;
};

function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void getSession()
      .then((authenticated) => {
        if (!cancelled && authenticated) window.location.assign('/admin');
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => { cancelled = true; };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim()) return;
    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'FLIXO-Admin',
        },
        body: JSON.stringify({ password }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: { code?: string } };
      if (!response.ok || body.ok !== true) {
        const code = body.error?.code;
        if (code === 'server_configuration_unavailable') {
          setError('مصادقة الإدارة غير مهيأة على الخادم.');
        } else if (code === 'login_rate_limited') {
          setError('تم تجاوز حد محاولات الدخول. حاول لاحقًا.');
        } else {
          setError('بيانات اعتماد الإدارة غير صحيحة.');
        }
        return;
      }
      window.location.assign('/admin');
    } catch {
      setError('تعذر الوصول إلى خدمة مصادقة الإدارة.');
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return <main className="admin-login-shell" lang="ar" dir="rtl"><section className="admin-login-card"><p>جارٍ التحقق من جلسة الإدارة…</p></section></main>;
  }

  return (
    <main className="admin-login-shell" lang="ar" dir="rtl">
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <div className="admin-login-mark">FX</div>
        <span className="admin-eyebrow">PRIVATE CONTROL PLANE</span>
        <h1 id="admin-login-title">دخول الإدارة</h1>
        <p>الجلسة تُنشأ على الخادم فقط، وتُحفظ في Cookie محمية HttpOnly. لا توجد هوية إدارية داخل حزمة المتصفح.</p>
        <form onSubmit={submit} className="admin-login-form">
          <label htmlFor="admin-password">كلمة مرور الإدارة</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={1}
            maxLength={256}
            required
          />
          {error && <div className="admin-notice" role="alert">{error}</div>}
          <button className="admin-primary admin-login-button" type="submit" disabled={busy || !password}>
            {busy ? 'جارٍ التحقق…' : 'تسجيل الدخول'}
          </button>
        </form>
      </section>
    </main>
  );
}

export const adminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/login',
  component: AdminLoginPage,
  head: () => ({
    meta: [
      { title: 'FLIXO — دخول الإدارة' },
      { name: 'robots', content: 'noindex,nofollow,noarchive' },
    ],
  }),
});
