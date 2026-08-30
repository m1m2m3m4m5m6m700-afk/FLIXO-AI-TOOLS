import { expect, test } from '@playwright/test';
import { LOCALES, LOCALE_METADATA } from '../src/lib/i18n/config';
import { TOOL_MANIFEST } from '../src/config/tool-manifest';
import { getLocalizedToolPath } from '../src/lib/routing/route-resolver';

test.describe('G4 all-public-route localization certification', () => {
  for (const locale of LOCALES) {
    test(`all public routes are localized and SEO-safe for ${locale}`, async ({ page }) => {
      const languageTag = LOCALE_METADATA[locale].languageTag;
      const direction = LOCALE_METADATA[locale].direction;
      const routes = new Set<string>([`/${locale}`]);
      for (const tool of TOOL_MANIFEST.filter((entry) => entry.isReady)) {
        routes.add(getLocalizedToolPath(tool, locale));
      }

      const navigationDiagnostics: string[] = [];
      page.on('pageerror', (error) => navigationDiagnostics.push(`pageerror:${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') navigationDiagnostics.push(`console:${message.text()}`);
      });

      for (const route of routes) {
        navigationDiagnostics.length = 0;
        const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30000 });
        expect(response?.status(), `${locale} ${route}`).toBe(200);
        await page.waitForLoadState('networkidle').catch(() => undefined);

        await expect(page.locator('html')).toHaveAttribute('lang', languageTag);
        await expect(page.locator('html')).toHaveAttribute('dir', direction);

        const title = await page.title();
        expect(title.trim(), `${locale} ${route} title`).not.toBe('');

        const descriptionLocator = page.locator('meta[name="description"]');
        await expect(descriptionLocator, `${locale} ${route} description meta uniqueness`).toHaveCount(1);
        const description = await descriptionLocator.getAttribute('content');
        expect(description?.trim(), `${locale} ${route} description`).not.toBe('');

        const h1 = page.locator('h1').first();
        await expect(h1, `${locale} ${route} h1`).toBeVisible();
        expect((await h1.textContent())?.trim(), `${locale} ${route} h1 text`).not.toBe('');

        const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
        expect(canonical, `${locale} ${route} canonical`).toBeTruthy();
        expect(new URL(canonical!, page.url()).origin).toBe('https://flixoai.vercel.app');
        expect(new URL(canonical!, page.url()).pathname).toBe(route);

        const alternates = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((links) =>
          links.map((link) => ({
            lang: link.getAttribute('hreflang'),
            href: link.getAttribute('href'),
          })),
        );
        const requiredLocales = [...LOCALES.map((entry) => LOCALE_METADATA[entry].languageTag), 'x-default'];
        for (const required of requiredLocales) expect(alternates.map((entry) => entry.lang)).toContain(required);
        for (const alternate of alternates) {
          expect(new URL(alternate.href!, page.url()).origin).toBe('https://flixoai.vercel.app');
        }

        const accessibilityViolations = await page.locator('[aria-label]').evaluateAll((nodes) =>
          nodes
            .filter((node) => !(node.getAttribute('aria-label') ?? '').trim())
            .map((node) => `${node.tagName}.${node.className}`),
        );
        expect(accessibilityViolations, `${locale} ${route} empty aria-labels`).toEqual([]);

        const unnamedControls = await page.locator('button, input, select, textarea').evaluateAll((nodes) =>
          nodes.filter((node) => {
            if (node.getAttribute('aria-hidden') === 'true') return false;
            const aria = (node.getAttribute('aria-label') ?? '').trim();
            const labelledBy = (node.getAttribute('aria-labelledby') ?? '').trim();
            const text = (node.textContent ?? '').trim();
            const placeholder = (node.getAttribute('placeholder') ?? '').trim();
            const id = node.getAttribute('id');
            const associatedLabel = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() : '';
            return !(aria || labelledBy || text || placeholder || associatedLabel);
          }).length,
        );
        expect(unnamedControls, `${locale} ${route} unnamed controls`).toBe(0);

        const imagesMissingAlt = await page.locator('img:not([alt])').count();
        expect(imagesMissingAlt, `${locale} ${route} images without alt`).toBe(0);

        expect(navigationDiagnostics, `${locale} ${route} browser diagnostics`).toEqual([]);
      }
    });
  }
});
