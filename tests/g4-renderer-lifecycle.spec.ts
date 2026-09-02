import { expect, test } from '@playwright/test';

const appRoutes = ['/sv/ai-vocal-instrumental-remover', '/sv'];

test.setTimeout(25_000);

test('Chromium control page remains responsive', async ({ page }) => {
  const events: string[] = [];
  page.on('crash', () => events.push('crash'));
  page.on('close', () => events.push('close'));
  page.on('pageerror', (error) => events.push(`pageerror:${error.message}`));

  await page.goto('data:text/html,<html><head><title>control</title></head><body>baseline</body></html>', {
    waitUntil: 'load',
    timeout: 5_000,
  });

  expect(await page.title()).toBe('control');
  expect(await page.locator('html').count()).toBe(1);
  expect(await page.locator('body').textContent()).toBe('baseline');
  expect(events.filter((event) => event === 'crash')).toEqual([]);
});

for (const pathname of appRoutes) {
  test(`Chromium renderer lifecycle — ${pathname}`, async ({ browser }) => {
    const browserEvents: string[] = [];
    const page = await browser.newPage();

    page.on('crash', () => browserEvents.push('crash'));
    page.on('close', () => browserEvents.push('close'));
    page.on('pageerror', (error) => browserEvents.push(`pageerror:${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') browserEvents.push(`console-error:${message.text()}`);
    });
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) browserEvents.push(`navigated:${frame.url()}`);
    });
    page.on('requestfailed', (request) => {
      if (request.url().startsWith('http://127.0.0.1:3000/')) {
        browserEvents.push(`requestfailed:${request.url()}:${request.failure()?.errorText ?? 'unknown'}`);
      }
    });

    const response = await page.goto(pathname, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    console.log('[G4 RENDERER PROBE]', JSON.stringify({ route: pathname, status: response?.status() ?? null }));

    let bodyCount: number | null = null;
    let bodyText: string | null = null;
    let domError: string | null = null;

    try {
      bodyCount = await page.locator('body').count({ timeout: 3_000 });
      bodyText = await page.locator('body').textContent({ timeout: 3_000 });
    } catch (error) {
      domError = error instanceof Error ? error.message : String(error);
    }

    console.log('[G4 RENDERER PROBE RESULT]', JSON.stringify({
      route: pathname,
      url: page.url(),
      status: response?.status() ?? null,
      bodyCount,
      bodyTextLength: bodyText?.length ?? null,
      domError,
      events: browserEvents,
    }));

    expect(response?.status(), `${pathname} HTTP status`).toBe(200);
    expect(browserEvents.filter((event) => event === 'crash'), `${pathname} renderer crash`).toEqual([]);
    expect(domError, `${pathname} DOM bridge error`).toBeNull();
    expect(bodyCount, `${pathname} body count`).toBe(1);

    await page.close();
  });
}