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
    await page.getByLabel("Describe the edit").fill("Remove background from image");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Background Removed Layer", { exact: true })).toBeVisible();
    await expect(page.getByText("remove_background", { exact: true })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("Stop aborts the active SSE request without losing the last valid state", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Describe the edit").fill("Remove background from image");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
    await expect(page.getByText("Untitled Creative Project", { exact: false })).toBeVisible();
  });
});
