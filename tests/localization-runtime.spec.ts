import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const sitemap = readFileSync('dist/sitemap.xml', 'utf8');
const routes = [...new Set([...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/gu)].map((match) => new URL(match[1]).pathname))].sort();
const localeCodes = ['en','ar','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'] as const;
const languageTags: Record<(typeof localeCodes)[number], string> = { en:'en', ar:'ar', es:'es', fr:'fr', de:'de', ru:'ru', zh:'zh-CN', hi:'hi', id:'id', ur:'ur', ja:'ja', pt:'pt', it:'it', ko:'ko', nl:'nl', pl:'pl', tr:'tr', vi:'vi', th:'th', sv:'sv' };
const rtlLocales = new Set(['ar', 'ur']);
const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/gu, ' ').trim();
const familyPath = (pathname: string): string => pathname.replace(new RegExp(`^/(?:${localeCodes.join('|')})(?=/|$)`, 'u'), '') || '/';

void familyPath;

test.describe.configure({ mode: 'parallel' });
test.setTimeout(90_000);
const batch = Number.parseInt(process.env.G4_BATCH ?? '0', 10);
const batchCount = Number.parseInt(process.env.G4_BATCH_COUNT ?? '1', 10);
const batchedRoutes = batch >= 1 && batch <= batchCount ? routes.filter((_, index) => index % batchCount === batch - 1) : routes;

for (const pathname of batchedRoutes) {
  test(`G4 all-public-route localization/SEO contract — ${pathname}`, async ({ page }, testInfo) => {
    const locale = pathname.match(new RegExp(`^/(${localeCodes.join('|')})(?:/|$)`, 'u'))?.[1];
    expect(locale, `${pathname} must have a canonical locale prefix`).toBeTruthy();
    const localeCode = locale as (typeof localeCodes)[number];
    const expectedLanguage = languageTags[localeCode];
    const expectedDirection = rtlLocales.has(localeCode) ? 'rtl' : 'ltr';
    const runtimeErrors: string[] = [];

    await page.addInitScript(({ expectedLanguage: expectedLang, expectedDirection: expectedDir }) => {
      const trace: Array<Record<string, unknown>> = [];
      const push = (entry: Record<string, unknown>) => { trace.push({ at: performance.now(), ...entry }); if (trace.length > 200) trace.shift(); };
      Object.defineProperty(window, '__g4LocaleTrace', { value: trace, configurable: true });
      const originalSetAttribute = Element.prototype.setAttribute;
      const originalRemoveAttribute = Element.prototype.removeAttribute;
      Element.prototype.setAttribute = function(name: string, value: string) { if (this === document.documentElement && (name === 'lang' || name === 'dir')) push({ type:'setAttribute', name, value, stack:new Error().stack }); return originalSetAttribute.call(this,name,value); };
      Element.prototype.removeAttribute = function(name: string) { if (this === document.documentElement && (name === 'lang' || name === 'dir')) push({ type:'removeAttribute', name, stack:new Error().stack }); return originalRemoveAttribute.call(this,name); };
      const observe = () => { const html = document.documentElement; if (!html) return; push({ type:'html-observe-start', lang:html.getAttribute('lang'), dir:html.getAttribute('dir') }); new MutationObserver((mutations) => { for (const mutation of mutations) if (mutation.type === 'attributes' && (mutation.attributeName === 'lang' || mutation.attributeName === 'dir')) push({ type:'mutation', name:mutation.attributeName, lang:html.getAttribute('lang'), dir:html.getAttribute('dir') }); }).observe(html,{ attributes:true, attributeFilter:['lang','dir'] }); };
      if (document.documentElement) observe(); else document.addEventListener('DOMContentLoaded',observe,{once:true});
      push({ type:'expected', lang:expectedLang, dir:expectedDir });
    }, { expectedLanguage, expectedDirection });

    page.on('pageerror',(error) => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on('console',(message) => { if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`); });
    page.on('requestfailed',(request) => { if (request.url().startsWith('http://127.0.0.1:3000/')) runtimeErrors.push(`requestfailed: ${request.url()} — ${request.failure()?.errorText ?? 'unknown'}`); });

    const response = await page.goto(pathname,{waitUntil:'domcontentloaded',timeout:30_000});
    expect(response?.status(),`${pathname} must return HTTP 200`).toBe(200);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const diagnostics = async () => page.evaluate(() => ({ url:location.href, htmlLang:document.documentElement.getAttribute('lang'), htmlDir:document.documentElement.getAttribute('dir'), mainLang:document.querySelector('main')?.getAttribute('lang') ?? null, mainDir:document.querySelector('main')?.getAttribute('dir') ?? null, rootOuterHTML:document.documentElement.outerHTML.slice(0,2000), scripts:[...document.scripts].map((script) => script.src || '<inline>').slice(-20), trace:(window as Window & { __g4LocaleTrace?: unknown[] }).__g4LocaleTrace ?? [] }));

    let localeStable = false;
    let lastDiagnostics: Awaited<ReturnType<typeof diagnostics>> | null = null;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      lastDiagnostics = await diagnostics();
      if (lastDiagnostics.htmlLang === expectedLanguage && lastDiagnostics.htmlDir === expectedDirection) { localeStable = true; break; }
      await page.waitForTimeout(250);
    }
    if (!localeStable) {
      await testInfo.attach('g4-locale-diagnostics.json',{ body:JSON.stringify({ ...lastDiagnostics, expected:{ lang:expectedLanguage, dir:expectedDirection }, pathname, runtimeErrors },null,2), contentType:'application/json' });
      throw new Error(`${pathname} locale bootstrap/runtime mismatch: expected html lang=${expectedLanguage} dir=${expectedDirection}; diagnostics=${JSON.stringify(lastDiagnostics)}`);
    }

    const mains = page.locator('main'); await expect(mains).toHaveCount(1); const main = mains.first(); await expect(main).toBeVisible(); await expect(main).toHaveAttribute('lang',expectedLanguage); await expect(main).toHaveAttribute('dir',expectedDirection); await expect(page.locator('h1')).toHaveCount(1); await expect(page.locator('h1').first()).toHaveText(/\S+/);
    const title = await page.title(); const description = await page.locator('meta[name="description"]').getAttribute('content'); expect(normalize(title)).not.toBe(''); expect(normalize(description)).not.toBe('');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href'); expect(canonical).toBeTruthy(); expect(new URL(canonical!).pathname).toBe(pathname);
  });
}
