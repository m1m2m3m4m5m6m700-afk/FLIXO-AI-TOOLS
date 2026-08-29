import { expect, test } from '@playwright/test';

test('application boots with image-first homepage', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}\n${error.stack ?? ''}`));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(`console.error: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    runtimeErrors.push(`requestfailed: ${request.url()}\n${request.failure()?.errorText ?? 'unknown'}`);
  });

  await page.goto('/');

  try {
    await expect(page.locator('#home-title')).toBeVisible();
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      url: location.href,
      readyState: document.readyState,
      rootHTML: document.getElementById('root')?.innerHTML ?? null,
      runtimeDiagnostics: localStorage.getItem('flixo:runtime-diagnostics'),
    }));
    throw new Error(
      [
        error instanceof Error ? error.message : String(error),
        '--- S4 BOOT DIAGNOSTICS ---',
        JSON.stringify(diagnostics, null, 2),
        runtimeErrors.join('\n'),
      ].filter(Boolean).join('\n'),
    );
  }

  await expect(page.locator('a[href="/en/image-compressor"]')).toBeVisible();
});
