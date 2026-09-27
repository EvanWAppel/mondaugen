import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addFavorite,
  favoriteKey,
  isFavorite,
  readFavorites,
  removeFavorite,
  toggleFavorite,
} from "./favoritesStore";
import type { Location } from "./types";

const NYC: Location = {
  id: 1,
  name: "New York",
  latitude: 40.7128,
  longitude: -74.006,
};
const PARIS: Location = { id: 2, name: "Paris", latitude: 48.8566, longitude: 2.3522 };

beforeEach(() => {
  window.localStorage.clear();
  // Reset module-level state by removing every current favorite.
  readFavorites()
    .slice()
    .forEach(removeFavorite);
});

afterEach(() => {
  window.localStorage.clear();
});

describe("favoritesStore", () => {
  it("keys on rounded coordinates, not the synthesized id", () => {
    const renamedId: Location = { ...NYC, id: 999 };
    expect(favoriteKey(NYC)).toBe("40.713,-74.006");
    expect(favoriteKey(renamedId)).toBe(favoriteKey(NYC));
  });

  it("adds without duplicating the same place", () => {
    addFavorite(NYC);
    addFavorite({ ...NYC, id: 42 });
    expect(readFavorites()).toHaveLength(1);
    expect(isFavorite(NYC)).toBe(true);
  });

  it("removes a favorite", () => {
    addFavorite(NYC);
    addFavorite(PARIS);
    removeFavorite(NYC);
    expect(isFavorite(NYC)).toBe(false);
    expect(readFavorites()).toHaveLength(1);
  });

  it("toggles on and off", () => {
    toggleFavorite(PARIS);
    expect(isFavorite(PARIS)).toBe(true);
    toggleFavorite(PARIS);
    expect(isFavorite(PARIS)).toBe(false);
  });

  it("persists to localStorage", () => {
    addFavorite(NYC);
    expect(window.localStorage.getItem("mondaugen:favorites")).toContain(
      "New York",
    );
  });
});
