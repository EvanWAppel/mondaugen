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

// QA-07: the map toolbar controls. Every third-party request (radar frames,
// wind, satellite clouds, tiles, forecast) is aborted so the assertions only
// cover the toolbar, which renders whether or not the live data arrives.
test.describe("Mondaugen map controls", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? "http://localhost:3000").origin;
    await page.route(
      (url) => url.origin !== origin,
      (route) => route.abort(),
    );
    await page.goto("/");
    // The map mounts only once its section scrolls near the viewport.
    await page.getByRole("region", { name: /radar map/i }).scrollIntoViewIfNeeded();
  });

  test("map layer toggle offers Radar, Both and Wind with radio semantics", async ({
    page,
  }) => {
    const group = page.getByRole("radiogroup", { name: /map layer/i });
    await expect(group).toBeVisible();
    for (const name of ["Radar", "Both", "Wind"]) {
      await expect(group.getByRole("radio", { name, exact: true })).toBeVisible();
    }
    // "Both" is the default; choosing Radar moves the checked state.
    const both = group.getByRole("radio", { name: "Both", exact: true });
    const radar = group.getByRole("radio", { name: "Radar", exact: true });
    await expect(both).toHaveAttribute("aria-checked", "true");
    await radar.click();
    await expect(radar).toHaveAttribute("aria-checked", "true");
    await expect(both).toHaveAttribute("aria-checked", "false");
  });

  test("clouds toggle renders as an unpressed toggle button", async ({ page }) => {
    // Only the initial state is asserted: turning clouds on fetches the
    // satellite image, and a failed fetch (aborted here) switches it back off.
    const clouds = page.getByRole("button", { name: "Clouds", exact: true });
    await expect(clouds).toBeVisible();
    await expect(clouds).toHaveAttribute("aria-pressed", "false");
  });
});
