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
      <style>{`\
        .admin-login-shell{min-height:100vh;display:grid;place-items:center;padding:24px;background:#070a10;color:#f4f7fb;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.admin-login-card{width:min(460px,100%);padding:30px;border:1px solid rgba(255,255,255,.09);border-radius:22px;background:#0d121b;box-shadow:0 24px 80px rgba(0,0,0,.3)}.admin-login-mark{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#8b7cff,#44d7e8);color:#fff;font-size:13px;font-weight:900;margin-bottom:18px}.admin-eyebrow{display:block;color:#8b7cff;font-size:10px;font-weight:800;letter-spacing:.16em}.admin-login-card h1{margin:10px 0 8px;font-size:32px;letter-spacing:-.03em}.admin-login-card p{margin:0 0 22px;color:#8f9aad;font-size:13px;line-height:1.7}.admin-login-form{display:grid;gap:9px}.admin-login-form label{color:#cfd7e3;font-size:12px;font-weight:700}.admin-login-form input{width:100%;min-height:48px;border:1px solid #2a4352;border-radius:13px;background:#081017;color:#effcff;padding:11px 13px;outline:none}.admin-login-form input:focus{border-color:#67e8f9;box-shadow:0 0 0 3px rgba(103,232,249,.08)}.admin-login-button{width:100%;min-height:46px}.admin-notice{padding:11px 12px;border:1px solid rgba(255,100,124,.25);border-radius:12px;background:rgba(255,100,124,.055);color:#ffb0bc;font-size:12px;line-height:1.5}.admin-primary{border:0;border-radius:12px;background:linear-gradient(135deg,#8b7cff,#44d7e8);color:#fff;padding:11px 14px;font-weight:800;cursor:pointer}.admin-primary:disabled{opacity:.55;cursor:not-allowed}
      `}</style>
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
