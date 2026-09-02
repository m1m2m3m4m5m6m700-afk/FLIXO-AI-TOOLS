import { expect, test, type Page } from '@playwright/test';

const routes = ['/sv/ai-vocal-instrumental-remover', '/sv'];

test.setTimeout(60_000);

test.describe.configure({ mode: 'parallel' });

for (const pathname of routes) {
  test(`G4 live lang trace — ${pathname}`, async ({ page }) => {
    const traceLines: string[] = [];
    const runtimeErrors: string[] = [];

    page.on('console', (message) => {
      const text = message.text();
      if (text.startsWith('[G4 TRACE LIVE]')) {
        traceLines.push(text);
        console.log(text);
        return;
      }
      if (message.type() === 'error') runtimeErrors.push(`console: ${text}`);
    });
    page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on('requestfailed', (request) => {
      if (request.url().startsWith('http://127.0.0.1:3000/')) {
        runtimeErrors.push(`requestfailed: ${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`);
      }
    });

    await page.addInitScript(() => {
      const html = document.documentElement as HTMLElement & { __g4LiveTraceId?: string };
      html.__g4LiveTraceId ??= Math.random().toString(36).slice(2);

      const emit = (label: string, extra: Record<string, unknown> = {}) => {
        console.log('[G4 TRACE LIVE]', JSON.stringify({
          route: location.pathname,
          label,
          lang: html.getAttribute('lang'),
          dir: html.getAttribute('dir'),
          time: performance.now(),
          htmlId: html.__g4LiveTraceId,
          ...extra,
        }));
      };

      emit('init');

      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.attributeName !== 'lang') continue;
          emit('lang-mutation', { oldLang: mutation.oldValue });
        }
      }).observe(html, {
        attributes: true,
        attributeFilter: ['lang'],
        attributeOldValue: true,
      });

      let lastHeartbeat = performance.now();
      const heartbeat = setInterval(() => {
        const now = performance.now();
        emit('heartbeat', { deltaMs: Math.round(now - lastHeartbeat) });
        lastHeartbeat = now;
      }, 1_000);

      window.addEventListener('DOMContentLoaded', () => emit('DOMContentLoaded'), { once: true });
      window.addEventListener('load', () => emit('load'), { once: true });
      window.addEventListener('unload', () => clearInterval(heartbeat), { once: true });
    });

    const response = await page.goto(pathname, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    console.log('[G4 LIVE STATUS]', JSON.stringify({ route: pathname, status: response?.status() ?? null }));

    await page.waitForTimeout(12_000);

    expect(traceLines.length, `${pathname} must emit live trace events`).toBeGreaterThan(0);
    expect(runtimeErrors, `${pathname} runtime errors`).toEqual([]);
  });
}
