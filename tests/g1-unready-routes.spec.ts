import { expect, test } from '@playwright/test';
import { LOCALES } from '../src/lib/i18n/config';
import { TOOL_MANIFEST } from '../src/config/tool-manifest';
import { getLocalizedToolPath } from '../src/lib/routing/route-resolver';

const unreadyTools = TOOL_MANIFEST.filter((tool) => !tool.isReady);

for (const locale of LOCALES) {
  test(`G1 unready-route boundary is closed for ${locale}`, async ({ request }) => {
    const routes = unreadyTools.length
      ? unreadyTools.map((tool) => getLocalizedToolPath(tool, locale))
      : [`/${locale}/__flixo_unregistered_tool__`];

    const duplicateRoutes = routes.filter((route, index) => routes.indexOf(route) !== index);
    expect(duplicateRoutes, `G1 ${locale} must not duplicate unready-route coverage`).toEqual([]);

    for (const route of routes) {
      const response = await request.get(route, { timeout: 30000 });
      expect(response.status(), `G1 ${locale} ${route} must be a real HTTP 404`).toBe(404);
    }
  });
}
