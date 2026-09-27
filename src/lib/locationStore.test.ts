import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Location } from "./types";

const STORAGE_KEY = "mondaugen:active-location";

const PARIS: Location = {
  id: 2988507,
  name: "Paris",
  latitude: 48.85,
  longitude: 2.35,
  country: "France",
};

beforeEach(() => {
  localStorage.clear();
  vi.resetModules(); // fresh module singleton (current/hydrated) per test
});

describe("locationStore", () => {
  it("falls back to the default when nothing is stored", async () => {
    const { DEFAULT_LOCATION, readActiveLocation } = await import(
      "./locationStore"
    );
    expect(DEFAULT_LOCATION.name).toBe("New York");
    expect(readActiveLocation()).toEqual(DEFAULT_LOCATION);
  });

  it("persists the active location to localStorage", async () => {
    const { setActiveLocation } = await import("./locationStore");
    setActiveLocation(PARIS);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({
      name: "Paris",
      latitude: 48.85,
    });
  });

  it("rehydrates a previously stored location on next load", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(PARIS));
    const { readActiveLocation } = await import("./locationStore");
    expect(readActiveLocation().name).toBe("Paris");
  });

  it("ignores a corrupt stored value and uses the default", async () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    const { readActiveLocation, DEFAULT_LOCATION } = await import(
      "./locationStore"
    );
    expect(readActiveLocation()).toEqual(DEFAULT_LOCATION);
  });
});
