import { test, expect } from '@playwright/test';

test.describe('Color Picker & Palette output contracts', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/en/color-picker-palette'); });
  test('converts HEX to RGB and HSL', async ({ page }) => {
    await page.getByLabel('HEX').fill('#FF0000');
    await expect(page.getByText('RGB: 255, 0, 0')).toBeVisible();
    await expect(page.getByText(/HSL: 0\.0°/)).toBeVisible();
  });
  test('generates deterministic palette', async ({ page }) => {
    await page.getByLabel('HEX').fill('#000000');
    await expect(page.getByRole('button', { name: '#000000' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#FFFFFF' })).toBeVisible();
  });
  test('computes WCAG contrast', async ({ page }) => {
    await page.getByLabel('HEX').fill('#000000');
    await page.getByLabel('Background').fill('#FFFFFF');
    await expect(page.getByText('Contrast: 21.00:1')).toBeVisible();
    await expect(page.getByText('WCAG AA normal text: PASS')).toBeVisible();
  });
  test('rejects invalid HEX', async ({ page }) => {
    await page.getByLabel('HEX').fill('#GGGGGG');
    await expect(page.getByRole('alert')).toContainText('Invalid HEX color');
  });
});
