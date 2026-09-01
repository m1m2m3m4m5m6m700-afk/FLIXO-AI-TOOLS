import { expect, test } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';

test.setTimeout(30_000);

test('G4 runtime trace — /ar/ai-vocal-instrumental-remover', async ({ page }, testInfo) => {
  const tracePath = testInfo.outputPath('g4-runtime-trace.jsonl');
  mkdirSync(testInfo.outputDir, { recursive: true });
  const write = (record: unknown) => appendFileSync(tracePath, `${JSON.stringify(record)}\n`, 'utf8');

  page.on('console', (message) => {
    const text = message.text();
    if (text.startsWith('[G4TRACE]')) write({ source: 'console', type: message.type(), text, hostTime: Date.now() });
  });
  page.on('pageerror', (error) => write({ source: 'pageerror', message: error.message, stack: error.stack ?? null, hostTime: Date.now() }));
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) write({ source: 'browser', event: 'framenavigated', url: frame.url(), hostTime: Date.now() });
  });

  await page.addInitScript(() => {
    const identity = new WeakMap<object, number>();
    let nextId = 1;
    const id = (value: object | null | undefined) => {
      if (!value) return null;
      const old = identity.get(value);
      if (old) return old;
      const next = nextId++;
      identity.set(value, next);
      return next;
    };
    const stack = () => new Error().stack?.split('\n').slice(2, 14).join('\n') ?? '';
    const state = () => {
      const html = document.documentElement;
      return {
        url: location.href,
        readyState: document.readyState,
        htmlId: id(html),
        lang: html?.getAttribute('lang') ?? null,
        dir: html?.getAttribute('dir') ?? null,
      };
    };
    const emit = (event: string, extra: Record<string, unknown> = {}) => {
      console.log('[G4TRACE]', JSON.stringify({ event, ...extra, ...state(), perf: performance.now() }));
    };

    let lastHtml = document.documentElement;
    let lastLang = lastHtml?.getAttribute('lang') ?? null;
    let lastDir = lastHtml?.getAttribute('dir') ?? null;

    const check = () => {
      const html = document.documentElement;
      const lang = html?.getAttribute('lang') ?? null;
      const dir = html?.getAttribute('dir') ?? null;
      if (html !== lastHtml) {
        emit('documentElement-change', {
          previousHtmlId: id(lastHtml),
          previousLang: lastLang,
          previousDir: lastDir,
          currentHtmlId: id(html),
          currentLang: lang,
          currentDir: dir,
          stack: stack(),
        });
        lastHtml = html;
        lastLang = lang;
        lastDir = dir;
        return;
      }
      if (lang !== lastLang) {
        emit('lang-transition', {
          oldValue: lastLang,
          newValue: lang,
          htmlId: id(html),
          stack: stack(),
        });
        lastLang = lang;
      }
      if (dir !== lastDir) {
        emit('dir-transition', {
          oldValue: lastDir,
          newValue: dir,
          htmlId: id(html),
          stack: stack(),
        });
        lastDir = dir;
      }
    };

    const originalSet = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name: string, value: string) {
      if (this === document.documentElement && (name === 'lang' || name === 'dir')) {
        emit('setAttribute-call', { name, value, before: this.getAttribute(name), stack: stack() });
      }
      return originalSet.call(this, name, value);
    };
    const originalRemove = Element.prototype.removeAttribute;
    Element.prototype.removeAttribute = function(name: string) {
      if (this === document.documentElement && (name === 'lang' || name === 'dir')) {
        emit('removeAttribute-call', { name, before: this.getAttribute(name), stack: stack() });
      }
      return originalRemove.call(this, name);
    };

    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.target === document && mutation.type === 'childList') {
          emit('document-childList', {
            added: [...mutation.addedNodes].map((node) => ({ id: id(node), name: node.nodeName })),
            removed: [...mutation.removedNodes].map((node) => ({ id: id(node), name: node.nodeName })),
            stack: stack(),
          });
        }
        if (mutation.target === document.documentElement && mutation.type === 'attributes' && (mutation.attributeName === 'lang' || mutation.attributeName === 'dir')) {
          emit('html-attribute-mutation', {
            attribute: mutation.attributeName,
            oldValue: mutation.oldValue,
            currentValue: document.documentElement.getAttribute(mutation.attributeName),
          });
        }
      }
      check();
    }).observe(document, { childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['lang', 'dir'] });

    document.addEventListener('DOMContentLoaded', () => emit('DOMContentLoaded'), { once: true });
    window.addEventListener('load', () => emit('window.load'), { once: true });
    window.addEventListener('beforeunload', () => emit('window.beforeunload'), { once: true });
    window.addEventListener('pagehide', () => emit('window.pagehide'), { once: true });

    const timer = window.setInterval(check, 20);
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
    emit('init');
  });

  const response = await page.goto('/ar/ai-vocal-instrumental-remover', { waitUntil: 'commit', timeout: 15_000 });
  write({ source: 'test', event: 'commit', status: response?.status() ?? null, url: page.url(), hostTime: Date.now() });
  await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch((error: unknown) => write({ source: 'test', event: 'domcontentloaded-timeout', error: String(error), hostTime: Date.now() }));

  for (const delay of [100, 500, 1000, 2000, 5000, 10000]) {
    await page.waitForTimeout(delay - (delay === 100 ? 0 : delay / 2));
    const checkpoint = await page.evaluate(() => ({
      url: location.href,
      readyState: document.readyState,
      htmlId: (globalThis as { __g4_last_html_id?: number }).__g4_last_html_id ?? null,
      lang: document.documentElement?.getAttribute('lang') ?? null,
      dir: document.documentElement?.getAttribute('dir') ?? null,
      html: document.documentElement?.outerHTML.slice(0, 500) ?? null,
    })).catch((error: unknown) => ({ evaluateError: String(error) }));
    write({ source: 'checkpoint', delayMs: delay, ...checkpoint, hostTime: Date.now() });
  }

  await page.screenshot({ path: testInfo.outputPath('g4-runtime-trace.png'), fullPage: true }).catch((error: unknown) => write({ source: 'test', event: 'screenshot-error', error: String(error) }));
  const final = await page.evaluate(() => ({
    url: location.href,
    readyState: document.readyState,
    lang: document.documentElement?.getAttribute('lang') ?? null,
    dir: document.documentElement?.getAttribute('dir') ?? null,
  })).catch((error: unknown) => ({ evaluateError: String(error) }));
  write({ source: 'test', event: 'final', ...final, hostTime: Date.now() });

  expect(final).toMatchObject({ lang: 'ar', dir: 'rtl' });
});
