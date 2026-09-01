import { expect, test } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';

test.setTimeout(15_000);

test('G4 runtime trace — /ar/ai-vocal-instrumental-remover', async ({ page }, testInfo) => {
  const tracePath = testInfo.outputPath('g4-runtime-trace.jsonl');
  mkdirSync(testInfo.outputDir, { recursive: true });
  const write = (record: unknown) => appendFileSync(tracePath, `${JSON.stringify(record)}\n`, 'utf8');

  page.on('console', (message) => {
    const text = message.text();
    if (text.startsWith('[G4TRACE]')) write({ source: 'console', type: message.type(), text, hostTime: Date.now() });
  });
  page.on('pageerror', (error) => write({ source: 'pageerror', message: error.message, stack: error.stack ?? null, hostTime: Date.now() }));
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) write({ source: 'browser', event: 'framenavigated', url: frame.url(), hostTime: Date.now() }); });
  page.on('crash', () => write({ source: 'browser', event: 'page-crash', hostTime: Date.now() }));

  await page.addInitScript(() => {
    const identity = new WeakMap<object, number>();
    let nextId = 1;
    const id = (value: object | null | undefined) => {
      if (!value) return null;
      const found = identity.get(value);
      if (found) return found;
      const created = nextId++;
      identity.set(value, created);
      return created;
    };
    const originalSet = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name: string, value: string) {
      if (this === document.documentElement && (name === 'lang' || name === 'dir')) {
        console.log('[G4TRACE]', JSON.stringify({
          event: 'setAttribute-call', name, value, before: this.getAttribute(name),
          htmlId: id(this), url: location.href, perf: performance.now(),
          stack: new Error().stack?.split('\n').slice(2, 10).join('\n') ?? '',
        }));
      }
      return originalSet.call(this, name, value);
    };
    const originalRemove = Element.prototype.removeAttribute;
    Element.prototype.removeAttribute = function(name: string) {
      if (this === document.documentElement && (name === 'lang' || name === 'dir')) {
        console.log('[G4TRACE]', JSON.stringify({ event: 'removeAttribute-call', name, before: this.getAttribute(name), htmlId: id(this), url: location.href, perf: performance.now(), stack: new Error().stack?.split('\n').slice(2, 10).join('\n') ?? '' }));
      }
      return originalRemove.call(this, name);
    };

    let lastHtml = document.documentElement;
    let lastLang = lastHtml?.getAttribute('lang') ?? null;
    let lastDir = lastHtml?.getAttribute('dir') ?? null;
    let mutationCount = 0;
    let attrMutationCount = 0;
    let childListCount = 0;
    let characterDataCount = 0;
    let lastReport = performance.now();

    const report = (kind: string) => {
      const html = document.documentElement;
      console.log('[G4TRACE]', JSON.stringify({
        event: kind,
        mutationCount,
        attrMutationCount,
        childListCount,
        characterDataCount,
        htmlId: id(html),
        lang: html?.getAttribute('lang') ?? null,
        dir: html?.getAttribute('dir') ?? null,
        perf: performance.now(),
      }));
    };

    const observer = new MutationObserver((mutations) => {
      mutationCount += mutations.length;
      for (const m of mutations) {
        if (m.type === 'attributes') attrMutationCount += 1;
        if (m.type === 'childList') childListCount += 1;
        if (m.type === 'characterData') characterDataCount += 1;
      }
      const now = performance.now();
      if (now - lastReport >= 250) {
        lastReport = now;
        report('mutation-rate');
      }
      const html = document.documentElement;
      const lang = html?.getAttribute('lang') ?? null;
      const dir = html?.getAttribute('dir') ?? null;
      if (html !== lastHtml) {
        report('documentElement-change');
        lastHtml = html;
        lastLang = lang;
        lastDir = dir;
      } else if (lang !== lastLang || dir !== lastDir) {
        report('locale-transition');
        lastLang = lang;
        lastDir = dir;
      }
    });
    observer.observe(document, { attributes: true, childList: true, characterData: true, subtree: true, attributeOldValue: true, attributeFilter: ['lang', 'dir', 'aria-label', 'title', 'placeholder'] });

    document.addEventListener('DOMContentLoaded', () => report('DOMContentLoaded'), { once: true });
    window.addEventListener('load', () => report('window.load'), { once: true });
    window.setTimeout(() => report('snapshot-1s'), 1000);
    window.setTimeout(() => report('snapshot-3s'), 3000);
    window.setTimeout(() => report('snapshot-5s'), 5000);
    emitInitial();

    function emitInitial() {
      console.log('[G4TRACE]', JSON.stringify({ event: 'init', htmlId: id(document.documentElement), lang: document.documentElement?.getAttribute('lang') ?? null, dir: document.documentElement?.getAttribute('dir') ?? null, perf: performance.now() }));
    }
  });

  const response = await page.goto('/ar/ai-vocal-instrumental-remover', { waitUntil: 'commit', timeout: 10_000 });
  write({ source: 'test', event: 'commit', status: response?.status() ?? null, url: page.url(), hostTime: Date.now() });
  await page.waitForLoadState('domcontentloaded', { timeout: 8_000 }).catch((error: unknown) => write({ source: 'test', event: 'domcontentloaded-timeout', error: String(error), hostTime: Date.now() }));
  await page.waitForTimeout(7_000).catch((error: unknown) => write({ source: 'test', event: 'wait-timeout', error: String(error), hostTime: Date.now() }));

  const final = await page.locator('html').evaluate((html) => ({ lang: html.getAttribute('lang'), dir: html.getAttribute('dir'), outer: html.outerHTML.slice(0, 700) })).catch((error: unknown) => ({ evaluateError: String(error) }));
  write({ source: 'test', event: 'final', final, hostTime: Date.now() });
  await page.screenshot({ path: testInfo.outputPath('g4-runtime-trace.png'), fullPage: true, timeout: 2_000 }).catch((error: unknown) => write({ source: 'test', event: 'screenshot-error', error: String(error) }));

  expect(final).toMatchObject({ lang: 'ar', dir: 'rtl' });
});
