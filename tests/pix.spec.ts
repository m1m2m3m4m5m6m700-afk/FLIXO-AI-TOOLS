import { expect, test } from '@playwright/test';
import { PNG, uploadFixture } from './helpers/image-tool-fixture';

test.describe('Pix Studio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/pix');
    await expect(page.getByText('افتح صورة للبدء في Pix Studio')).toBeVisible();
  });

  test('opens an image and exposes all editor modes', async ({ page }) => {
    await page.locator('#pix-image-file').setInputFiles({ name: 'pix-fixture.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByRole('heading', { name: 'Pix Studio', exact: true })).toBeVisible();
    await expect(page.getByLabel('Pix Studio preview')).toBeVisible();
    await expect(page.getByRole('button', { name: 'tune' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'liquify' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'dispersion' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'text' })).toBeVisible();
  });

  test('applies tune controls without removing the preview', async ({ page }) => {
    await uploadFixture(page, 'pix-tune.png');
    const brightness = page.getByLabel('Brightness');
    const contrast = page.getByLabel('Contrast');
    const saturation = page.getByLabel('Saturation');
    await brightness.fill('35');
    await contrast.fill('-20');
    await saturation.fill('25');
    await expect(page.getByText('Brightness: 35')).toBeVisible();
    await expect(page.getByText('Contrast: -20')).toBeVisible();
    await expect(page.getByText('Saturation: 25')).toBeVisible();
    await expect(page.getByLabel('Pix Studio preview')).toBeVisible();
  });

  test('supports text layers and history controls', async ({ page }) => {
    await uploadFixture(page, 'pix-text.png');
    await page.getByRole('button', { name: 'text' }).click();
    await page.getByLabel('Text layer').fill('FLIXO PIX');
    await page.getByRole('button', { name: 'إضافة نص' }).click();
    await expect(page.getByRole('button', { name: 'تراجع Undo' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'إعادة Redo' })).toBeDisabled();
  });

  test('supports liquify and dispersion interactions', async ({ page }) => {
    await uploadFixture(page, 'pix-effects.png');
    const canvas = page.getByLabel('Pix Studio preview');
    await page.getByRole('button', { name: 'liquify' }).click();
    await page.getByLabel('Liquify radius').fill('60');
    await page.getByLabel('Liquify strength').fill('0.8');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Pix canvas is not measurable.');
    await page.mouse.move(box.x + box.width / 2 - 10, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 5);
    await page.mouse.up();

    await page.getByRole('button', { name: 'dispersion' }).click();
    await page.getByLabel('Dispersion radius').fill('50');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(canvas).toBeVisible();
  });

  test('exports a high-resolution PNG', async ({ page }) => {
    await uploadFixture(page, 'pix-export.png');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'تصدير الصورة PNG عالي الدقة' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('pix-studio-export.png');
    expect(download.suggestedFilename()).not.toContain('undefined');
  });
});
