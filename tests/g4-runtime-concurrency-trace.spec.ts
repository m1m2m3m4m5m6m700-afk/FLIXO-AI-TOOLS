import { expect, test } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';

test.setTimeout(45_000);

test('G4 concurrent runtime trace — /ar/ai-vocal-instrumental-remover', async ({ browser }, testInfo) => {
  const outputDir = testInfo.outputDir;
  mkdirSync(outputDir, { recursive: true });
  const tracePath = testInfo.outputPath('g4-concurrency-trace.jsonl');
  const write = (record: unknown) => appendFileSync(tracePath, `${JSON.stringify(record)}\n`, 'utf8');

  const pages = await Promise.all(Array.from({ length: 12 }, async (_, index) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('console', (message) => {
      const text = message.text();
      if (text.startsWith('[G4TRACE]')) write({ page: index, source: 'console', type: message.type(), text, hostTime: Date.now() });
    });
    page.on('pageerror', (error) => write({ page: index, source: 'pageerror', message: error.message, stack: error.stack ?? null, hostTime: Date.now() }));
    page.on('crash', () => write({ page: index, source: 'browser', event: 'crash', hostTime: Date.now() }));
    await page.addInitScript((pageIndex) => {
      const ids = new WeakMap<object, number>();
      let nextId = 1;
      const id = (value: object | null | undefined) => {
        if (!value) return null;
        const found = ids.get(value);
        if (found) return found;
        const created = nextId++;
        ids.set(value, created);
        return created;
      };
      const emit = (event: string, data: Record<string, unknown> = {}) => console.log('[G4TRACE]', JSON.stringify({ pageIndex, event, ...data, htmlId: id(document.documentElement), lang: document.documentElement?.getAttribute('lang') ?? null, dir: document.documentElement?.getAttribute('dir') ?? null, readyState: document.readyState, perf: performance.now() }));
      const stack = () => new Error().stack?.split('\n').slice(2, 12).join('\n') ?? '';
      const originalSet = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function(name: string, value: string) {
        if (this === document.documentElement && (name === 'lang' || name === 'dir')) emit('setAttribute', { name, value, before: this.getAttribute(name), stack: stack() });
        return originalSet.call(this, name, value);
      };
      const originalRemove = Element.prototype.removeAttribute;
      Element.prototype.removeAttribute = function(name: string) {
        if (this === document.documentElement && (name === 'lang' || name === 'dir')) emit('removeAttribute', { name, before: this.getAttribute(name), stack: stack() });
        return originalRemove.call(this, name);
      };
      const initialHtml = document.documentElement;
      let lastHtml = initialHtml;
      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.target === document && mutation.type === 'childList') emit('document-childList', { added: [...mutation.addedNodes].map((n) => [id(n), n.nodeName]), removed: [...mutation.removedNodes].map((n) => [id(n), n.nodeName]), stack: stack() });
          if (mutation.target === document.documentElement && mutation.type === 'attributes' && (mutation.attributeName === 'lang' || mutation.attributeName === 'dir')) emit('html-attribute', { attribute: mutation.attributeName, oldValue: mutation.oldValue, current: document.documentElement.getAttribute(mutation.attributeName) });
        }
        if (document.documentElement !== lastHtml) {
          emit('documentElement-change', { previousId: id(lastHtml), currentId: id(document.documentElement), previousLang: lastHtml?.getAttribute('lang') ?? null, currentLang: document.documentElement?.getAttribute('lang') ?? null, sameAsInitial: document.documentElement === initialHtml, stack: stack() });
          lastHtml = document.documentElement;
        }
      }).observe(document, { childList: true, attributes: true, attributeOldValue: true, subtree: false, attributeFilter: ['lang', 'dir'] });
      document.addEventListener('DOMContentLoaded', () => emit('DOMContentLoaded'), { once: true });
      window.addEventListener('load', () => emit('load'), { once: true });
    }, index);
    return { page, context, index };
  }));

  await Promise.all(pages.map(async ({ page, index }) => {
    const response = await page.goto('/ar/ai-vocal-instrumental-remover', { waitUntil: 'commit', timeout: 15_000 }).catch((error: unknown) => { write({ page: index, source: 'test', event: 'goto-error', error: String(error), hostTime: Date.now() }); return null; });
    write({ page: index, source: 'test', event: 'commit', status: response?.status() ?? null, hostTime: Date.now() });
  }));

  await new Promise((resolve) => setTimeout(resolve, 8_000));

  for (const { page, index } of pages) {
    const state = await page.locator('html').evaluate((html) => ({ lang: html.getAttribute('lang'), dir: html.getAttribute('dir'), outer: html.outerHTML.slice(0, 500) }), { timeout: 1_000 }).catch((error: unknown) => ({ evaluateError: String(error) }));
    write({ page: index, source: 'test', event: 'final', state, hostTime: Date.now() });
    await page.screenshot({ path: testInfo.outputPath(`g4-concurrency-page-${index}.png`), timeout: 1_000 }).catch((error: unknown) => write({ page: index, source: 'test', event: 'screenshot-error', error: String(error), hostTime: Date.now() }));
  }

  await Promise.all(pages.map(({ context }) => context.close()));
  const successes = [];
  for (const { page, index } of pages) {
    const result = await page.locator('html').getAttribute('lang', { timeout: 100 }).catch(() => null);
    successes.push({ index, lang: result });
  }
  write({ source: 'test', event: 'aggregate', successes, hostTime: Date.now() });
  expect(successes.every(({ lang }) => lang === 'ar')).toBe(true);
});
