import { expect, test } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';

test.setTimeout(12_000);

test('G4 runtime trace — /ar/ai-vocal-instrumental-remover', async ({ page }, testInfo) => {
  const tracePath = testInfo.outputPath('g4-runtime-trace.jsonl');
  mkdirSync(testInfo.outputDir, { recursive: true });
  const write = (record: unknown) => appendFileSync(tracePath, `${JSON.stringify(record)}\n`, 'utf8');

  page.on('console', (message) => {
    const text = message.text();
    if (text.startsWith('[G4TRACE]')) write({ source: 'console', type: message.type(), text, hostTime: Date.now() });
  });
  page.on('pageerror', (error) => write({ source: 'pageerror', message: error.message, stack: error.stack ?? null, hostTime: Date.now() }));
  page.on('crash', () => write({ source: 'browser', event: 'page-crash', hostTime: Date.now() }));
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) write({ source: 'browser', event: 'framenavigated', url: frame.url(), hostTime: Date.now() }); });

  await page.addInitScript(() => {
    const ids = new WeakMap<object, number>();
    let nextId = 1;
    const id = (value: object | null | undefined) => {
      if (!value) return null;
      const old = ids.get(value);
      if (old) return old;
      const created = nextId++;
      ids.set(value, created);
      return created;
    };
    const stack = () => new Error().stack?.split('\n').slice(2, 12).join('\n') ?? '';
    const snapshot = () => {
      const html = document.documentElement;
      return { url: location.href, readyState: document.readyState, htmlId: id(html), lang: html?.getAttribute('lang') ?? null, dir: html?.getAttribute('dir') ?? null };
    };
    const emit = (event: string, data: Record<string, unknown> = {}) => console.log('[G4TRACE]', JSON.stringify({ event, ...data, ...snapshot(), perf: performance.now() }));

    const originalSet = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name: string, value: string) {
      if (this === document.documentElement && (name === 'lang' || name === 'dir')) emit('setAttribute-call', { name, value, before: this.getAttribute(name), stack: stack() });
      return originalSet.call(this, name, value);
    };
    const originalRemove = Element.prototype.removeAttribute;
    Element.prototype.removeAttribute = function(name: string) {
      if (this === document.documentElement && (name === 'lang' || name === 'dir')) emit('removeAttribute-call', { name, before: this.getAttribute(name), stack: stack() });
      return originalRemove.call(this, name);
    };

    const NativeObserver = window.MutationObserver;
    let observerSerial = 0;
    type Stats = { serial: number; calls: number; records: number; constructorStack: string; lastReport: number };
    const stats = new WeakMap<object, Stats>();
    class TracedMutationObserver extends NativeObserver {
      constructor(callback: MutationCallback) {
        const serial = ++observerSerial;
        const constructorStack = stack();
        let calls = 0;
        let records = 0;
        let lastReport = performance.now();
        super((mutations, observer) => {
          calls += 1;
          records += mutations.length;
          const now = performance.now();
          if (calls === 1 || calls === 10 || calls === 100 || calls === 1000 || now - lastReport >= 500) {
            lastReport = now;
            emit('observer-callback', { observerSerial: serial, callbackCalls: calls, mutationRecords: records, batchSize: mutations.length, constructorStack });
          }
          callback(mutations, observer);
        });
        stats.set(this, { serial, calls, records, constructorStack, lastReport });
        emit('observer-constructed', { observerSerial: serial, constructorStack });
      }
    }
    window.MutationObserver = TracedMutationObserver as typeof MutationObserver;

    document.addEventListener('DOMContentLoaded', () => emit('DOMContentLoaded'), { once: true });
    window.addEventListener('load', () => emit('window.load'), { once: true });
    emit('init');
  });

  const response = await page.goto('/ar/ai-vocal-instrumental-remover', { waitUntil: 'commit', timeout: 8_000 });
  write({ source: 'test', event: 'commit', status: response?.status() ?? null, url: page.url(), hostTime: Date.now() });
  await page.waitForLoadState('domcontentloaded', { timeout: 8_000 }).catch((error: unknown) => write({ source: 'test', event: 'domcontentloaded-timeout', error: String(error), hostTime: Date.now() }));
  await page.waitForTimeout(6_000).catch((error: unknown) => write({ source: 'test', event: 'wait-timeout', error: String(error), hostTime: Date.now() }));
  const final = await page.locator('html').evaluate((html) => ({ lang: html.getAttribute('lang'), dir: html.getAttribute('dir'), outer: html.outerHTML.slice(0, 700) })).catch((error: unknown) => ({ evaluateError: String(error) }));
  write({ source: 'test', event: 'final', final, hostTime: Date.now() });
  await page.screenshot({ path: testInfo.outputPath('g4-runtime-trace.png'), fullPage: true, timeout: 1_500 }).catch((error: unknown) => write({ source: 'test', event: 'screenshot-error', error: String(error) }));
  expect(final).toMatchObject({ lang: 'ar', dir: 'rtl' });
});
