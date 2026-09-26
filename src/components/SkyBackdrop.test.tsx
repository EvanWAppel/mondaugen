import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SkyBackdrop from "./SkyBackdrop";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Stub matchMedia so the reduced-motion hook is deterministic. */
function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: reduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

describe("SkyBackdrop", () => {
  it("renders nothing until a sky is known", () => {
    stubReducedMotion(false);
    const { container } = render(<SkyBackdrop sky={null} />);
    expect(container.querySelector(".sky-grad")).toBeNull();
  });

  it("renders a gradient layer and its ambient effect for the sky", async () => {
    stubReducedMotion(false);
    const { container } = render(<SkyBackdrop sky="rain" />);
    await waitFor(() =>
      expect(
        container.querySelector('.sky-grad[data-sky="rain"]'),
      ).toBeTruthy(),
    );
    expect(container.querySelector(".fx-rain")).toBeTruthy();
  });

  it("crossfades: keeps both layers mid-transition", async () => {
    stubReducedMotion(false);
    const { container, rerender } = render(<SkyBackdrop sky="clear-day" />);
    await waitFor(() =>
      expect(container.querySelector('[data-sky="clear-day"]')).toBeTruthy(),
    );
    rerender(<SkyBackdrop sky="rain" />);
    // The new layer stacks over the old one; pruning waits for animationend.
    await waitFor(() =>
      expect(container.querySelector('[data-sky="rain"]')).toBeTruthy(),
    );
    expect(container.querySelectorAll(".sky-grad").length).toBe(2);
  });

  it("swaps instantly to a single layer under reduced motion", async () => {
    stubReducedMotion(true);
    const { container, rerender } = render(<SkyBackdrop sky="clear-day" />);
    await waitFor(() =>
      expect(container.querySelector('[data-sky="clear-day"]')).toBeTruthy(),
    );
    rerender(<SkyBackdrop sky="snow" />);
    await waitFor(() =>
      expect(container.querySelector('[data-sky="snow"]')).toBeTruthy(),
    );
    // No crossfade stack — exactly one layer, the newest.
    expect(container.querySelectorAll(".sky-grad").length).toBe(1);
  });
});
