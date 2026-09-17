  await loadSeed(page, testInfo);
  await expect(page.getByRole('slider', { name: 'Curves' })).toBeVisible();
  await page.getByRole('slider', { name: 'Curves' }).fill('35');
  await page.getByRole('slider', { name: 'Brush strength' }).fill('40');
  await page.getByRole('slider', { name: 'Perspective X' }).fill('10');
  await page.getByRole('slider', { name: 'Perspective Y' }).fill('-8');
  await page.getByRole('slider', { name: 'Lens Blur' }).fill('8');
  await page.getByRole('slider', { name: 'Bokeh' }).fill('20');
  await page.getByRole('spinbutton', { name: 'Healing X' }).fill('1');
  await page.getByRole('spinbutton', { name: 'Healing Y' }).fill('1');

  const exportPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const download = await exportPromise;
  expect(download.suggestedFilename()).toBe('seed-edited.png');
  expect((await download.createReadStream()) ?? null).toBeTruthy();
});

test('Seed: Undo and Redo restore and reapply a GPU color change', async ({ page }, testInfo) => {
  await loadSeed(page, testInfo);
  const baseline = await gpuPixels(page);
  const baselineRevision = await canvasLocator(page).getAttribute('data-render-revision');
  await page.getByRole('slider', { name: 'brightness' }).fill('35');
  await waitForGpuRender(page, baselineRevision);
  const edited = await gpuPixels(page);
  expect(edited.equals(baseline)).toBe(false);

  const editedRevision = await canvasLocator(page).getAttribute('data-render-revision');
  const undoButton = page.getByTestId('button-canvas-undo');
  await undoButton.focus();
  await undoButton.press('Enter');
  await waitForGpuRender(page, editedRevision);
  await expectGpuPixelsEqual(page, baseline);

  const undoRevision = await canvasLocator(page).getAttribute('data-render-revision');
  const redoButton = page.getByTestId('button-canvas-redo');
  if (await redoButton.count()) {
    await redoButton.focus();
    await redoButton.press('Enter');
  } else {
    const fallbackRedoButton = page.getByRole('button', { name: 'Redo', exact: true });
    await fallbackRedoButton.focus();
    await fallbackRedoButton.press('Enter');
  }
  await waitForGpuRender(page, undoRevision);
  await expectGpuPixelsEqual(page, edited);
});

test('Seed: accepts a second image for Double Exposure', async ({ page }, testInfo) => {