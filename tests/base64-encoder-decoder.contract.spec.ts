import { test, expect } from '@playwright/test';

test.describe('Base64 Encoder / Decoder output contracts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/base64-encoder-decoder');
  });

  test('UTF-8 text round-trip', async ({ page }) => {
    await page.locator('#base64-input').fill('مرحبا FLIXO 🌍');
    await page.getByRole('button', { name: 'Encode' }).click();
    await page.getByRole('button', { name: 'Run' }).click();
    const encoded = await page.locator('#base64-output').inputValue();
    expect(encoded).toBe('2YXYsdit2KjYpyBGTElYTyDwn4yN');
    await page.getByRole('button', { name: 'Decode' }).click();
    await page.locator('#base64-input').fill(encoded);
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.locator('#base64-output')).toHaveValue('مرحبا FLIXO 🌍');
  });

  test('rejects malformed Base64', async ({ page }) => {
    await page.getByRole('button', { name: 'Decode' }).click();
    await page.locator('#base64-input').fill('%%%invalid%%%');
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByRole('alert')).toContainText('Invalid Base64 input');
  });

  test('accepts data URI preview', async ({ page }) => {
    await page.locator('#base64-input').fill('data:text/plain;base64,SGVsbG8=');
    await page.getByRole('button', { name: 'Preview Data URI' }).click();
    await expect(page.locator('#base64-output')).toHaveValue('data:text/plain;base64,SGVsbG8=');
  });

  test('exposes no external network requirement in UI', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.locator('#base64-input').fill('FLIXO local');
    await page.getByRole('button', { name: 'Run' }).click();
    const external = requests.filter((requestUrl) => {
      const url = new URL(requestUrl);
      const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
      return (url.protocol === 'http:' || url.protocol === 'https:') && !isLocal;
    });
    expect(external).toHaveLength(0);
  });
});
