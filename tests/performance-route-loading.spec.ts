import { expect, test } from '@playwright/test';

test('keeps lazy tool modules out of the initial home route', async ({ page }) => {
  const homeToolRequests: string[] = [];
  const homeScriptRequests = new Set<string>();
  const routeScriptRequests: string[] = [];
  let observingRoute = false;

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/src/tools/')) {
      if (observingRoute) homeToolRequests.push(url);
      else homeToolRequests.push(url);
    }

    if (request.resourceType() !== 'script') return;
    if (observingRoute) routeScriptRequests.push(url);
    else homeScriptRequests.add(url);
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(homeToolRequests, 'home route must not eagerly request tool modules').toEqual([]);

  observingRoute = true;
  const response = await page.goto('/en/image-compressor');
  await response?.finished();
  await page.waitForLoadState('networkidle');

  const routeOnlyScripts = routeScriptRequests.filter((url) => !homeScriptRequests.has(url));
  await expect.poll(() => routeOnlyScripts.length, { timeout: 10_000 }).toBeGreaterThan(0);
});
