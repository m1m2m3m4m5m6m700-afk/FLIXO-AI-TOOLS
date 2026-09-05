import { expect, test, type Page } from '@playwright/test';

const ratioInput = (page: Page) => page.getByRole('textbox', { name: 'Aspect ratio', exact: true });
const numericInput = (page: Page, label: 'Width' | 'Height') =>
  page.getByRole('textbox', { name: label, exact: true });

test('aspect-ratio-calculator: presets and proportional height', async ({ page }) => {
  await page.goto('/en/aspect-ratio-calculator');
  await expect(page.getByRole('heading', { name: 'Aspect Ratio Calculator' })).toBeVisible();
  await ratioInput(page).fill('16:9');
  await numericInput(page, 'Width').fill('1920');
  await expect(page.getByLabel('Calculated height')).toContainText('1080');
  await expect(page.getByLabel('Simplified ratio')).toContainText('16:9');
});

test('aspect-ratio-calculator: height drives width', async ({ page }) => {
  await page.goto('/en/aspect-ratio-calculator');
  await ratioInput(page).fill('4:3');
  await numericInput(page, 'Height').fill('900');
  await expect(page.getByLabel('Calculated width')).toContainText('1200');
});

test('aspect-ratio-calculator: invalid ratio is rejected', async ({ page }) => {
  await page.goto('/en/aspect-ratio-calculator');
  await ratioInput(page).fill('0:9');
  await expect(page.getByRole('alert')).toContainText('valid ratio');
});
