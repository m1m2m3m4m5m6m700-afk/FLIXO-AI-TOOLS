import { expect, test } from "@playwright/test";

test.describe("FLIXO Agent Editor end-to-end", () => {
  test("streams a remove-background request into the live canvas", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Chat workspace" })).toBeVisible();
    await expect(page.getByText("Untitled Creative Project", { exact: false })).toBeVisible();
    const initialCanvas = await page.locator('[data-testid="media-preview"] canvas').evaluate((element) => (element as HTMLCanvasElement).toDataURL());
    await page.getByLabel("Describe the edit").fill("Remove background from image");
    await page.getByRole("button", { name: "Send" }).click();

    // Red-Team regression: a generated local mutation must not execute before confirmation.
    await expect(page.getByTestId("confirmation-prompt")).toBeVisible();
    await expect(page.getByText(/Untitled Creative Project · v2/u)).toHaveCount(0);
    await expect(page.getByTestId("active-tool")).toHaveCount(0);

    await page.getByTestId("confirmation-prompt").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText(/Untitled Creative Project · v2/u)).toBeVisible();
    await expect(page.getByTestId("active-tool")).toHaveCount(0);
    await expect.poll(
      async () => page.locator('[data-testid="media-preview"] canvas').evaluate((element) => (element as HTMLCanvasElement).toDataURL()),
    ).not.toBe(initialCanvas);
    expect(consoleErrors).toEqual([]);
  });

  test("scrubs by frame and exports the rendered canvas through a dedicated worker", async ({ page }) => {
    await page.goto("/");
    const scrubber = page.getByTestId("frame-scrubber");
    await expect(scrubber).toBeVisible();
    await scrubber.focus();
    await scrubber.press("ArrowRight");
    await expect(page.getByText("Frame 1 ·", { exact: false })).toBeVisible();

    const workerPromise = page.waitForEvent("worker");

    await page.getByRole("combobox", { name: "Export format" }).selectOption("png");
    await page.getByRole("button", { name: "Export" }).click();

    await workerPromise;
    await expect(page.getByTestId("export-progress")).toContainText("Export ready.");
    const downloadPromise = page.waitForEvent("download");
    const download = await page.getByRole("link", { name: "Download export" }).click().then(
      () => downloadPromise,
    );

    expect(download.suggestedFilename()).toMatch(/\.png$/u);
  });

  test("Stop aborts the active SSE request without losing the last valid state", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });
    await page.goto("/");
    await page.getByLabel("Describe the edit").fill("Remove background from image");
    await page.getByRole("button", { name: "Send" }).click();
    const stopButton = page.getByRole("button", { name: "Stop" });
    await expect(stopButton).toBeVisible();
    await expect(stopButton).toBeEnabled();
    await stopButton.click();
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
    await expect(page.getByText("Untitled Creative Project", { exact: false })).toBeVisible();
  });
});
