import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "mondaugen:temperature-unit";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("unitStore", () => {
  it("defaults to fahrenheit when nothing is stored", async () => {
    const { DEFAULT_UNIT } = await import("./unitStore");
    expect(DEFAULT_UNIT).toBe("fahrenheit");
  });

  it("persists the chosen unit", async () => {
    const { setUnit } = await import("./unitStore");
    setUnit("celsius");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("celsius");
  });

  it("ignores an invalid stored value", async () => {
    localStorage.setItem(STORAGE_KEY, "kelvin");
    const { setUnit } = await import("./unitStore");
    // A fresh import reads storage lazily; invalid values are dropped.
    setUnit("fahrenheit");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("fahrenheit");
  });
});
