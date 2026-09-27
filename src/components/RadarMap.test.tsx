import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RadarMap from "./RadarMap";
import type { Location } from "@/lib/types";

const mapInstances = vi.hoisted(() => [] as MockMap[]);
const remove = vi.hoisted(() => vi.fn());

interface MockMap {
  options: { center: [number, number] };
}

vi.mock("maplibre-gl", () => {
  class Map {
    options: unknown;
    constructor(options: unknown) {
      this.options = options;
      mapInstances.push(this as unknown as MockMap);
    }
    addControl = vi.fn();
    on = vi.fn();
    once = vi.fn();
    easeTo = vi.fn();
    remove = remove;
    isStyleLoaded = () => true;
    getSource = () => undefined;
    addSource = vi.fn();
    addLayer = vi.fn();
    getLayer = () => ({});
    setPaintProperty = vi.fn();
    off = vi.fn();
    getZoom = () => 7;
    project = () => ({ x: 0, y: 0 });
    getBounds = () => ({
      getWest: () => -75,
      getSouth: () => 40,
      getEast: () => -73,
      getNorth: () => 42,
    });
  }
  class NavigationControl {}
  return { Map, NavigationControl };
});

const fetchRadarFrames = vi.hoisted(() => vi.fn());
const fetchWindField = vi.hoisted(() => vi.fn());
vi.mock("@/lib/wind", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wind")>();
  return { ...actual, fetchWindField };
});
vi.mock("@/lib/radar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/radar")>();
  return { ...actual, fetchRadarFrames };
});

const NYC: Location = {
  id: 1,
  name: "New York",
  latitude: 40.71,
  longitude: -74.01,
};

const WIND_FIELD = {
  longitudes: [-75, -73],
  latitudes: [40, 42],
  u: [
    [1, 1],
    [1, 1],
  ],
  v: [
    [0, 0],
    [0, 0],
  ],
  time: "2026-09-26T15:00",
  coarse: false,
};

const TWO_FRAMES = {
  host: "https://tilecache.rainviewer.com",
  frames: [
    { time: 1, path: "/v2/radar/a", kind: "past" as const },
    { time: 2, path: "/v2/radar/b", kind: "past" as const },
  ],
  generated: 0,
};

beforeEach(() => {
  fetchWindField.mockResolvedValue(WIND_FIELD);
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

async function flushMap() {
  await act(async () => {
    await Promise.resolve();
  });
}

afterEach(() => {
  mapInstances.length = 0;
  vi.clearAllMocks();
});

function radarOpacities(): number[] {
  const map = mapInstances[0] as unknown as {
    setPaintProperty: ReturnType<typeof vi.fn>;
  };
  return map.setPaintProperty.mock.calls
    .filter((call) => call[1] === "raster-opacity")
    .map((call) => call[2] as number);
}

describe("RadarMap", () => {
  it("initializes a MapLibre map centered on the location (lng, lat)", async () => {
    fetchRadarFrames.mockResolvedValue({ host: "https://h", frames: [], generated: 0 });
    render(<RadarMap location={NYC} />);
    await flushMap();
    expect(mapInstances).toHaveLength(1);
    expect(mapInstances[0].options.center).toEqual([-74.01, 40.71]);
  });

  it("adds a radar raster layer per frame once frames load", async () => {
    fetchRadarFrames.mockResolvedValue({
      host: "https://tilecache.rainviewer.com",
      frames: [
        { time: 1, path: "/v2/radar/a", kind: "past" },
        { time: 2, path: "/v2/radar/b", kind: "past" },
      ],
      generated: 0,
    });
    render(<RadarMap location={NYC} />);
    await waitFor(() => {
      const map = mapInstances[0] as unknown as { addLayer: ReturnType<typeof vi.fn> };
      expect(map.addLayer).toHaveBeenCalledTimes(2);
    });
  });

  it("recenters the map when the active location changes (MAP-05)", async () => {
    fetchRadarFrames.mockResolvedValue({ host: "https://h", frames: [], generated: 0 });
    const { rerender } = render(<RadarMap location={NYC} />);
    await flushMap();
    const map = mapInstances[0] as unknown as {
      easeTo: ReturnType<typeof vi.fn>;
    };

    const paris: Location = {
      id: 2,
      name: "Paris",
      latitude: 48.85,
      longitude: 2.35,
    };
    rerender(<RadarMap location={paris} />);

    expect(map.easeTo).toHaveBeenCalledWith({ center: [2.35, 48.85] });
  });

  it("removes the map on unmount", async () => {
    fetchRadarFrames.mockResolvedValue({ host: "https://h", frames: [], generated: 0 });
    const { unmount } = render(<RadarMap location={NYC} />);
    await flushMap();
    unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("shows wind streams with the radar by default", async () => {
    fetchRadarFrames.mockResolvedValue(TWO_FRAMES);
    render(<RadarMap location={NYC} />);
    expect(screen.getByRole("radio", { name: "Both" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByText("Loading wind…")).toBeInTheDocument();
    await waitFor(() => expect(fetchWindField).toHaveBeenCalled());
    expect(await screen.findByText(/Wind now · 15:00 UTC/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play radar" })).toBeInTheDocument();
    await waitFor(() => expect(radarOpacities().slice(-2)).toEqual([0, 0.35]));
  });

  it("drops the wind layer when radar is selected", async () => {
    fetchRadarFrames.mockResolvedValue(TWO_FRAMES);
    render(<RadarMap location={NYC} />);
    await screen.findByText(/Wind now/);

    fireEvent.click(screen.getByRole("radio", { name: "Radar" }));

    expect(screen.queryByText(/Wind now|Loading wind/)).not.toBeInTheDocument();
    await waitFor(() => expect(radarOpacities().slice(-2)).toEqual([0, 0.7]));
  });

  it("hides the timeline and drops radar opacity in wind mode", async () => {
    fetchRadarFrames.mockResolvedValue(TWO_FRAMES);
    render(<RadarMap location={NYC} />);
    await screen.findByRole("button", { name: "Play radar" });

    fireEvent.click(screen.getByRole("radio", { name: "Wind" }));

    expect(screen.queryByRole("button", { name: "Play radar" })).not.toBeInTheDocument();
    await waitFor(() => expect(fetchWindField).toHaveBeenCalled());
    await waitFor(() => expect(radarOpacities().slice(-2)).toEqual([0, 0]));
  });

  it("dims the radar and keeps the timeline when both layers are on", async () => {
    fetchRadarFrames.mockResolvedValue(TWO_FRAMES);
    render(<RadarMap location={NYC} />);
    await screen.findByRole("button", { name: "Play radar" });

    fireEvent.click(screen.getByRole("radio", { name: "Both" }));

    expect(screen.getByRole("button", { name: "Play radar" })).toBeInTheDocument();
    // The visible frame (the latest past one) is dimmed; the other stays hidden.
    await waitFor(() => expect(radarOpacities().slice(-2)).toEqual([0, 0.35]));
  });

  it("keeps the map mounted when the wind request fails", async () => {
    fetchRadarFrames.mockResolvedValue(TWO_FRAMES);
    fetchWindField.mockRejectedValue(
      new Error("Wind request failed (503 Unavailable)."),
    );
    render(<RadarMap location={NYC} />);
    await screen.findByRole("button", { name: "Play radar" });

    fireEvent.click(screen.getByRole("radio", { name: "Wind" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wind request failed (503 Unavailable).",
    );
    expect(screen.getByLabelText("Wind map")).toBeInTheDocument();
  });
});
