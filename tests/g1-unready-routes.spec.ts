import { expect, test } from '@playwright/test';
import { LOCALES, LOCALE_METADATA } from '../src/lib/i18n/config';
import { TOOL_MANIFEST } from '../src/config/tool-manifest';
import { getLocalizedToolPath } from '../src/lib/routing/route-resolver';

const unreadyTools = TOOL_MANIFEST.filter((tool) => !tool.isReady);

for (const locale of LOCALES) {
  test(`G1 unready-route boundary is closed for ${locale}`, async ({ page }) => {
    const languageTag = LOCALE_METADATA[locale].languageTag;
    const direction = LOCALE_METADATA[locale].direction;
    const routes = unreadyTools.length
      ? unreadyTools.map((tool) => getLocalizedToolPath(tool, locale))
      : [`/${locale}/__flixo_unregistered_tool__`];

    for (const route of routes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (response && response.status() >= 500) {
        throw new Error(`G1 route ${route} returned server failure ${response.status()}`);
      }

      const notFoundHeading = page.getByRole('heading', { name: /Tool not found/i });
      await expect(notFoundHeading, `${locale} ${route} must resolve through the not-found boundary`).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', languageTag);
      await expect(page.locator('html')).toHaveAttribute('dir', direction);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('[data-tool-workspace], .tool-page-modern__workspace, .image-tool-shell')).toHaveCount(0);
    }
  });
}
