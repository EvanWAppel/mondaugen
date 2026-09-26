import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommandPalette from "./CommandPalette";
import {
  addFavorite,
  readFavorites,
  removeFavorite,
} from "@/lib/favoritesStore";
import type { Location } from "@/lib/types";

const NYC: Location = {
  id: 1,
  name: "New York",
  latitude: 40.7128,
  longitude: -74.006,
};
const PARIS: Location = {
  id: 2,
  name: "Paris",
  latitude: 48.8566,
  longitude: 2.3522,
};

beforeEach(() => {
  window.localStorage.clear();
  readFavorites()
    .slice()
    .forEach(removeFavorite);
});

afterEach(() => {
  window.localStorage.clear();
});

describe("CommandPalette", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <CommandPalette
        open={false}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        activeLocation={NYC}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("lists favorites and selects one", () => {
    addFavorite(PARIS);
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandPalette
        open
        onClose={onClose}
        onSelect={onSelect}
        activeLocation={NYC}
      />,
    );
    fireEvent.click(screen.getByRole("option", { name: /Paris/ }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Paris" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("removes a favorite via the star toggle", () => {
    addFavorite(PARIS);
    render(
      <CommandPalette
        open
        onClose={vi.fn()}
        onSelect={vi.fn()}
        activeLocation={NYC}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /remove favorite/i }));
    expect(readFavorites().some((f) => f.name === "Paris")).toBe(false);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <CommandPalette
        open
        onClose={onClose}
        onSelect={vi.fn()}
        activeLocation={NYC}
      />,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
