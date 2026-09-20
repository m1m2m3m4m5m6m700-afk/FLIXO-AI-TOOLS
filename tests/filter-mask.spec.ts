import { test, expect } from '@playwright/test';

test.describe('Filter Mask live camera surface', () => {
  test('exposes the canonical live-filter catalog and selection controls', async ({ page }) => {
    await page.goto('/en/filter-mask');

    const section = page.getByRole('region', { name: 'Filter Mask' });
    await expect(section).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Filter Mask' })).toBeVisible();

    const allButtons = section.getByRole('button');
    await expect(allButtons).toHaveCount(75);

    const original = section.getByRole('button', { name: /Original effect\.original/ });
    await expect(original).toHaveAttribute('aria-pressed', 'true');

    const firstNonOriginal = section.getByRole('button', { name: /Warm/ }).first();
    await firstNonOriginal.click();
    await expect(firstNonOriginal).toHaveAttribute('aria-pressed', 'true');
    await expect(original).toHaveAttribute('aria-pressed', 'false');

    const search = section.getByRole('textbox', { name: 'Search filters' });
    await search.fill('cinematic');
    await expect(section.getByRole('button', { name: /Cinematic/ }).first()).toBeVisible();
    await expect(section.getByRole('button', { name: /Original effect\.original/ })).toHaveCount(0);

    const intensity = section.locator('input[type="range"]');
    await expect(intensity).toHaveValue('100');
    await intensity.fill('60');
    await expect(intensity).toHaveValue('60');
  });

  test('reports a clear error when camera permission is denied', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            throw new DOMException('Permission denied', 'NotAllowedError');
          },
        },
      });
    });

    await page.goto('/en/filter-mask');
    const section = page.getByRole('region', { name: 'Filter Mask' });
    await section.getByRole('button', { name: 'Start camera' }).first().click();
    await expect(section.getByRole('alert')).toHaveText('Camera or microphone access was denied or unavailable.');
  });

  test('keeps camera-dependent actions fail-closed before camera startup', async ({ page }) => {
    await page.goto('/en/filter-mask');

    const section = page.getByRole('region', { name: 'Filter Mask' });
    await expect(section.getByRole('button', { name: 'Start camera' }).first()).toBeEnabled();
    await expect(section.getByRole('button', { name: 'Stop' }).first()).toBeDisabled();
    await expect(section.getByRole('button', { name: 'Switch camera' }).first()).toBeDisabled();
    await expect(section.getByRole('button', { name: 'Photo' }).first()).toBeDisabled();
    await expect(section.getByRole('button', { name: 'Record video' }).first()).toBeDisabled();
    await expect(section.getByRole('region', { name: 'Filter Mask' }).getByText('Download result')).toHaveCount(0);
  });
});
