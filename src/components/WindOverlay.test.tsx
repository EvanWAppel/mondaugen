import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as MapLibreMap } from "maplibre-gl";
import WindOverlay from "./WindOverlay";
import type { WindField } from "@/lib/wind";

const fetchWindField = vi.hoisted(() => vi.fn());
const ASYNC = { timeout: 5000 };

vi.mock("@/lib/wind", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wind")>();
  return { ...actual, fetchWindField };
});

const field: WindField = {
  longitudes: [-75, -74, -73],
  latitudes: [40, 41, 42],
  u: [
    [5, 5, 5],
    [5, 5, 5],
    [5, 5, 5],
  ],
  v: [
    [2, 2, 2],
    [2, 2, 2],
    [2, 2, 2],
  ],
  time: "2026-10-22T18:00",
  coarse: false,
};

function fakeMap() {
  return {
    getBounds: () => ({
      getWest: () => -75,
      getSouth: () => 40,
      getEast: () => -73,
      getNorth: () => 42,
    }),
    getZoom: () => 6,
    project: () => ({ x: 10, y: 10 }),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as MapLibreMap;
}

function fakeContext() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    globalAlpha: 1,
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
  };
}

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("reduce") ? matches : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe("WindOverlay", () => {
  let ctx: ReturnType<typeof fakeContext>;
  let raf: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchWindField.mockReset();
    ctx = fakeContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    raf = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("draws static arrows, not an animation, under reduced motion (FR-15)", async () => {
    stubReducedMotion(true);
    fetchWindField.mockResolvedValue(field);
    const onStatus = vi.fn();
    render(<WindOverlay map={fakeMap()} onError={vi.fn()} onStatus={onStatus} />);

    await waitFor(() => expect(ctx.stroke).toHaveBeenCalled(), ASYNC);
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ loading: false, failed: false, time: field.time }),
    );
  });

  it("animates particles when motion is allowed", async () => {
    stubReducedMotion(false);
    fetchWindField.mockResolvedValue(field);
    render(<WindOverlay map={fakeMap()} onError={vi.fn()} onStatus={vi.fn()} />);

    await waitFor(() => expect(raf).toHaveBeenCalled(), ASYNC);
  });

  it("surfaces a fetch failure instead of hiding it (FR-6)", async () => {
    stubReducedMotion(true);
    fetchWindField.mockRejectedValue(
      new Error("Wind request failed (503 Service Unavailable)."),
    );
    const onError = vi.fn();
    const onStatus = vi.fn();
    render(<WindOverlay map={fakeMap()} onError={onError} onStatus={onStatus} />);

    await waitFor(
      () =>
        expect(onError).toHaveBeenCalledWith(
          "Wind request failed (503 Service Unavailable).",
        ),
      ASYNC,
    );
    expect(onStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ loading: false, failed: true, speedMs: null }),
    );
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it("falls back to a readable message when the failure is not an Error", async () => {
    stubReducedMotion(true);
    fetchWindField.mockRejectedValue("boom");
    const onError = vi.fn();
    render(<WindOverlay map={fakeMap()} onError={onError} onStatus={vi.fn()} />);

    await waitFor(() => expect(onError).toHaveBeenCalledWith("Couldn't load wind."), ASYNC);
  });

  it("never touches the network directly", async () => {
    stubReducedMotion(true);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    fetchWindField.mockResolvedValue(field);
    render(<WindOverlay map={fakeMap()} onError={vi.fn()} onStatus={vi.fn()} />);
    await waitFor(() => expect(fetchWindField).toHaveBeenCalledTimes(1), ASYNC);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
