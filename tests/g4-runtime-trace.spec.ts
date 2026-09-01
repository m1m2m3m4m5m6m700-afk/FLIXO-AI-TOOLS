import { expect, test } from '@playwright/test';
import { mkdirSync, appendFileSync } from 'node:fs';

test.setTimeout(45_000);

test('G4 runtime trace — /ar/ai-vocal-instrumental-remover', async ({ page }, testInfo) => {
  const tracePath = testInfo.outputPath('g4-runtime-trace.jsonl');
  mkdirSync(testInfo.outputDir, { recursive: true });
  const write = (event: unknown) => appendFileSync(tracePath, `${JSON.stringify(event)}\n`, 'utf8');

  page.on('console', (message) => {
    const text = message.text();
    if (text.startsWith('[G4TRACE]')) write({ source: 'console', type: message.type(), text, hostTime: Date.now() });
  });
  page.on('pageerror', (error) => write({ source: 'pageerror', message: error.message, stack: error.stack ?? null, hostTime: Date.now() }));
  page.on('requestfailed', (request) => write({ source: 'requestfailed', url: request.url(), failure: request.failure(), hostTime: Date.now() }));

  await page.addInitScript(() => {
    const identity = new WeakMap<object, number>();
    let nextId = 1;
    const getId = (value: object | null | undefined) => {
      if (!value) return null;
      const existing = identity.get(value);
      if (existing) return existing;
      const created = nextId++;
      identity.set(value, created);
      return created;
    };
    const stack = () => new Error().stack?.split('\n').slice(2, 28).join('\n') ?? '';
    const snapshot = () => ({
      url: location.href,
      readyState: document.readyState,
      htmlId: getId(document.documentElement),
      lang: document.documentElement?.getAttribute('lang') ?? null,
      dir: document.documentElement?.getAttribute('dir') ?? null,
      htmlOuter: document.documentElement?.outerHTML.slice(0, 900) ?? null,
    });
    const trace = (event: string, data: Record<string, unknown> = {}) => {
      console.log('[G4TRACE]', JSON.stringify({ event, ...data, ...snapshot(), perf: performance.now() }));
    };

    const initialHtml = document.documentElement;
    trace('init', { initialHtmlId: getId(initialHtml) });

    const originalSet = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name: string, value: string) {
      if (name === 'lang' || name === 'dir') trace('setAttribute', { name, value, targetId: getId(this), currentTargetHtml: this === document.documentElement, before: this.getAttribute(name), stack: stack() });
      return originalSet.call(this, name, value);
    };
    const originalRemove = Element.prototype.removeAttribute;
    Element.prototype.removeAttribute = function(name: string) {
      if (name === 'lang' || name === 'dir') trace('removeAttribute', { name, targetId: getId(this), currentTargetHtml: this === document.documentElement, before: this.getAttribute(name), stack: stack() });
      return originalRemove.call(this, name);
    };

    const originalReplace = Node.prototype.replaceChild;
    Node.prototype.replaceChild = function(newChild, oldChild) {
      if (this === document || this === document.documentElement || oldChild === initialHtml || newChild === initialHtml || oldChild === document.documentElement || newChild === document.documentElement) {
        trace('replaceChild', { parentId: getId(this), oldId: getId(oldChild), newId: getId(newChild), stack: stack() });
      }
      return originalReplace.call(this, newChild, oldChild);
    };
    const originalAppend = Node.prototype.appendChild;
    Node.prototype.appendChild = function(child) {
      if (this === document || this === document.documentElement || child.nodeName.toLowerCase() === 'html') trace('appendChild', { parentId: getId(this), childId: getId(child), childName: child.nodeName, stack: stack() });
      return originalAppend.call(this, child);
    };
    const originalInsert = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function(newNode, referenceNode) {
      if (this === document || this === document.documentElement || newNode.nodeName.toLowerCase() === 'html') trace('insertBefore', { parentId: getId(this), newId: getId(newNode), newName: newNode.nodeName, referenceId: getId(referenceNode), stack: stack() });
      return originalInsert.call(this, newNode, referenceNode);
    };

    const originalOpen = Document.prototype.open;
    Document.prototype.open = function(...args) { trace('document.open', { args, stack: stack() }); return originalOpen.apply(this, args); };
    const originalWrite = Document.prototype.write;
    Document.prototype.write = function(...args) { trace('document.write', { args, stack: stack() }); return originalWrite.apply(this, args); };
    const originalWriteln = Document.prototype.writeln;
    Document.prototype.writeln = function(...args) { trace('document.writeln', { args, stack: stack() }); return originalWriteln.apply(this, args); };
    const originalClose = Document.prototype.close;
    Document.prototype.close = function(...args) { trace('document.close', { args, stack: stack() }); return originalClose.apply(this, args); };

    const observeTarget = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        trace('mutation', {
          type: mutation.type,
          targetId: getId(mutation.target),
          targetName: mutation.target.nodeName,
          attribute: mutation.attributeName,
          oldValue: mutation.oldValue,
          added: [...mutation.addedNodes].map((node) => ({ id: getId(node), name: node.nodeName })),
          removed: [...mutation.removedNodes].map((node) => ({ id: getId(node), name: node.nodeName })),
          htmlIsInitial: document.documentElement === initialHtml,
        });
      }
    });
    observeTarget.observe(document, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['lang', 'dir'] });

    let previousHtml = document.documentElement;
    const poll = () => {
      const current = document.documentElement;
      if (current !== previousHtml) {
        trace('documentElement-change', {
          previousId: getId(previousHtml),
          previousLang: previousHtml?.getAttribute('lang') ?? null,
          currentId: getId(current),
          currentLang: current?.getAttribute('lang') ?? null,
          sameAsInitial: current === initialHtml,
          stack: stack(),
        });
        previousHtml = current;
      }
      if (current?.getAttribute('lang') === '') trace('EMPTY-LANG', { stack: stack() });
    };
    window.setInterval(poll, 25);
    window.requestAnimationFrame(function raf() { poll(); window.requestAnimationFrame(raf); });

    document.addEventListener('DOMContentLoaded', () => trace('DOMContentLoaded'), { once: true });
    window.addEventListener('load', () => trace('window.load'), { once: true });
    window.addEventListener('beforeunload', () => trace('window.beforeunload'), { once: true });
    window.addEventListener('pagehide', () => trace('window.pagehide'), { once: true });
  });

  const response = await page.goto('/ar/ai-vocal-instrumental-remover', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  write({ source: 'test', event: 'goto-complete', status: response?.status() ?? null, url: page.url(), hostTime: Date.now() });
  expect(response?.status()).toBe(200);

  try {
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar', { timeout: 10_000 });
  } catch (error) {
    await page.screenshot({ path: testInfo.outputPath('g4-runtime-failure.png'), fullPage: true }).catch(() => undefined);
    write({ source: 'test', event: 'assertion-failure', error: error instanceof Error ? error.stack : String(error), final: await page.evaluate(() => ({ url: location.href, readyState: document.readyState, htmlLang: document.documentElement?.getAttribute('lang') ?? null, htmlDir: document.documentElement?.getAttribute('dir') ?? null, htmlId: document.documentElement?.outerHTML.slice(0, 900) ?? null })) });
    throw error;
  }

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  write({ source: 'test', event: 'assertions-pass', hostTime: Date.now() });
});
