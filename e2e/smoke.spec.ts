import { test, expect } from "@playwright/test";

// Deterministic, network-independent smoke tests — they exercise the shell and
// client interactions (palette, colophon) without depending on the live weather
// APIs (the data layer is covered by the Vitest unit suite with mocks).
test.describe("Mondaugen smoke", () => {
  test("renders the app shell", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /Mondaugen home/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /jump/i })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /live radar/i }),
    ).toBeVisible();
    await expect(page.getByText(/ad-free/i)).toBeVisible();
  });

  test("opens and closes the command palette", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /jump/i }).click();
    const dialog = page.getByRole("dialog", { name: /search locations/i });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("opens the colophon", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /how it.s built/i }).click();
    await expect(
      page.getByRole("dialog", { name: /how it.s built/i }),
    ).toBeVisible();
  });
});
