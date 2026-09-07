import { expect, test } from '@playwright/test';

test('keeps lazy tool modules out of the initial home route and loads the tool chunk on demand', async ({ page }) => {
  const homeToolRequests: string[] = [];
  const homeScriptRequests = new Set<string>();
  const routeScriptRequests = new Set<string>();
  let observingRoute = false;

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/src/tools/')) {
      if (!observingRoute) homeToolRequests.push(url);
    }

    if (request.resourceType() !== 'script') return;
    if (observingRoute) routeScriptRequests.add(url);
    else homeScriptRequests.add(url);
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(homeToolRequests, 'home route must not eagerly request tool source modules').toEqual([]);

  observingRoute = true;
  const response = await page.goto('/en/image-compressor');
  await response?.finished();
  await page.waitForLoadState('networkidle');

  const newRouteScripts = [...routeScriptRequests].filter((url) => !homeScriptRequests.has(url));
  expect(newRouteScripts.length, 'opening the tool route must load a script not required by home').toBeGreaterThan(0);
  expect(newRouteScripts.some((url) => /image-compressor/u.test(url)), 'image-compressor must load its own lazy chunk').toBe(true);
});
