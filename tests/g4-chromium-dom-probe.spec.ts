import { expect, test } from '@playwright/test';

const routes = ['/sv/ai-vocal-instrumental-remover', '/sv'];

test.setTimeout(30_000);

test.describe.configure({ mode: 'parallel' });

for (const pathname of routes) {
  test(`G4 Chromium DOM probe — ${pathname}`, async ({ page }) => {
    const consoleTrace: string[] = [];

    page.on('console', (message) => {
      const text = message.text();
      if (text.startsWith('[G4 TRACE LIVE]')) {
        consoleTrace.push(text);
        console.log(text);
      }
    });

    await page.addInitScript(() => {
      const html = document.documentElement as HTMLElement & { __g4DomTraceId?: string };
      html.__g4DomTraceId ??= Math.random().toString(36).slice(2);

      const publish = (label: string, extra: Record<string, unknown> = {}) => {
        const record = {
          route: location.pathname,
          label,
          lang: html.getAttribute('lang'),
          dir: html.getAttribute('dir'),
          time: performance.now(),
          htmlId: html.__g4DomTraceId,
          ...extra,
        };

        html.dataset.g4Trace = JSON.stringify(record);
        html.dataset.g4TraceLabel = label;
        html.dataset.g4TraceLang = record.lang ?? '';
        html.dataset.g4TraceTime = String(Math.round(record.time));
        console.log('[G4 TRACE LIVE]', JSON.stringify(record));
      };

      publish('init');

      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.attributeName !== 'lang') continue;
          publish('lang-mutation', { oldLang: mutation.oldValue });
        }
      }).observe(html, {
        attributes: true,
        attributeFilter: ['lang'],
        attributeOldValue: true,
      });

      let lastHeartbeat = performance.now();
      setInterval(() => {
        const now = performance.now();
        publish('heartbeat', { deltaMs: Math.round(now - lastHeartbeat) });
        lastHeartbeat = now;
      }, 1_000);

      window.addEventListener('DOMContentLoaded', () => publish('DOMContentLoaded'), { once: true });
      window.addEventListener('load', () => publish('load'), { once: true });
    });

    const response = await page.goto(pathname, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    console.log('[G4 DOM PROBE STATUS]', JSON.stringify({ route: pathname, status: response?.status() ?? null }));

    const html = page.locator('html');
    const observedLabels: string[] = [];
    const observedLangs: string[] = [];
    const heartbeatDeltas: number[] = [];
    let previousTrace = '';

    for (let i = 0; i < 10; i += 1) {
      await page.waitForTimeout(1_000);
      const trace = await html.getAttribute('data-g4-trace');
      const label = await html.getAttribute('data-g4-trace-label');
      const lang = await html.getAttribute('data-g4-trace-lang');

      if (trace && trace !== previousTrace) {
        previousTrace = trace;
        try {
          const parsed = JSON.parse(trace) as { label?: string; lang?: string; deltaMs?: number };
          if (parsed.label) observedLabels.push(parsed.label);
          if (parsed.lang !== undefined) observedLangs.push(parsed.lang);
          if (typeof parsed.deltaMs === 'number') heartbeatDeltas.push(parsed.deltaMs);
          console.log('[G4 DOM PROBE]', JSON.stringify(parsed));
        } catch {
          console.log('[G4 DOM PROBE] invalid trace payload', trace);
        }
      } else if (label) {
        console.log('[G4 DOM PROBE] stable', JSON.stringify({ label, lang }));
      }
    }

    expect(response?.status(), `${pathname} HTTP status`).toBe(200);
    expect(previousTrace, `${pathname} must publish a trace record into DOM`).not.toBe('');
    expect(observedLabels.length, `${pathname} DOM trace labels`).toBeGreaterThan(0);

    console.log('[G4 DOM PROBE SUMMARY]', JSON.stringify({
      route: pathname,
      consoleTraceCount: consoleTrace.length,
      observedLabels,
      observedLangs,
      heartbeatDeltas,
    }));
  });
}
