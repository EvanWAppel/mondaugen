import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RadarMap from "./RadarMap";
import type { Location } from "@/lib/types";

const mapInstances = vi.hoisted(() => [] as MockMap[]);
const remove = vi.hoisted(() => vi.fn());
const addProtocol = vi.hoisted(() => vi.fn());
const removeProtocol = vi.hoisted(() => vi.fn());

interface MockMap {
  options: {
    center: [number, number];
    zoom: number;
    maxZoom: number;
    style: { layers: { id: string; paint?: Record<string, number> }[] };
  };
  addSource: ReturnType<typeof vi.fn>;
  addLayer: ReturnType<typeof vi.fn>;
  setLayoutProperty: ReturnType<typeof vi.fn>;
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
    sources = new Set<string>();
    getSource = (id: string) => (this.sources.has(id) ? {} : undefined);
    addSource = vi.fn((id: string) => {
      this.sources.add(id);
    });
    addLayer = vi.fn();
    getLayer = () => ({});
    setPaintProperty = vi.fn();
    setLayoutProperty = vi.fn();
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
  return { Map, NavigationControl, addProtocol, removeProtocol };
});

const fetchRadarFrames = vi.hoisted(() => vi.fn());
const fetchWindField = vi.hoisted(() => vi.fn());
vi.mock("@/lib/wind", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wind")>();
  return { ...actual, fetchWindField };
});
const fetchLatestCloudTime = vi.hoisted(() => vi.fn());
vi.mock("@/lib/clouds", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/clouds")>();
  return { ...actual, fetchLatestCloudTime };
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
  fetchLatestCloudTime.mockResolvedValue("2026-10-10T20:10:00Z");
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
    .filter((call) => call[1] === "raster-opacity" && call[0] !== "clouds")
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

  it("caps zoom at the radar tiles' max so they never stretch", async () => {
    fetchRadarFrames.mockResolvedValue({ host: "https://h", frames: [], generated: 0 });
    render(<RadarMap location={NYC} />);
    await flushMap();
    expect(mapInstances[0].options.maxZoom).toBe(7);
    expect(mapInstances[0].options.zoom).toBeLessThan(7);
  });

  it("renders the base map as a muted dark layer so weather stands out", async () => {
    fetchRadarFrames.mockResolvedValue({ host: "https://h", frames: [], generated: 0 });
    render(<RadarMap location={NYC} />);
    await flushMap();
    const paint = mapInstances[0].options.style.layers[0].paint ?? {};
    expect(paint["raster-saturation"]).toBeLessThan(0);
    expect(paint["raster-brightness-max"]).toBeLessThan(paint["raster-brightness-min"]);
  });

  it("registers the clouds tile protocol and removes it on unmount", async () => {
    fetchRadarFrames.mockResolvedValue({ host: "https://h", frames: [], generated: 0 });
    const { unmount } = render(<RadarMap location={NYC} />);
    await flushMap();
    expect(addProtocol).toHaveBeenCalledWith("clouds", expect.any(Function));
    unmount();
    expect(removeProtocol).toHaveBeenCalledWith("clouds");
  });

  it("keeps clouds off by default", async () => {
    fetchRadarFrames.mockResolvedValue(TWO_FRAMES);
    render(<RadarMap location={NYC} />);
    await screen.findByRole("button", { name: "Play radar" });
    expect(screen.getByRole("button", { name: "Clouds" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(fetchLatestCloudTime).not.toHaveBeenCalled();
  });

  it("adds the latest satellite cloud layer under the radar when toggled on", async () => {
    fetchRadarFrames.mockResolvedValue(TWO_FRAMES);
    render(<RadarMap location={NYC} />);
    await screen.findByRole("button", { name: "Play radar" });

    fireEvent.click(screen.getByRole("button", { name: "Clouds" }));

    expect(screen.getByRole("button", { name: "Clouds" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByText(/Clouds 20:10 UTC/)).toBeInTheDocument();
    const map = mapInstances[0];
    await waitFor(() =>
      expect(map.addSource).toHaveBeenCalledWith(
        "clouds",
        expect.objectContaining({
          tiles: [expect.stringContaining("/2026-10-10T20:10:00Z/")],
          maxzoom: 7,
        }),
      ),
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "clouds", source: "clouds" }),
      "radar-0",
    );
  });

  it("hides the cloud layer when toggled off", async () => {
    fetchRadarFrames.mockResolvedValue(TWO_FRAMES);
    render(<RadarMap location={NYC} />);
    await screen.findByRole("button", { name: "Play radar" });
    fireEvent.click(screen.getByRole("button", { name: "Clouds" }));
    await screen.findByText(/Clouds 20:10 UTC/);

    fireEvent.click(screen.getByRole("button", { name: "Clouds" }));

    expect(screen.queryByText(/Clouds 20:10 UTC/)).not.toBeInTheDocument();
    expect(mapInstances[0].setLayoutProperty).toHaveBeenLastCalledWith(
      "clouds",
      "visibility",
      "none",
    );
  });

  it("surfaces a readable error when the satellite request fails", async () => {
    fetchRadarFrames.mockResolvedValue(TWO_FRAMES);
    fetchLatestCloudTime.mockRejectedValue(
      new Error("Satellite cloud request failed (503 Service Unavailable)."),
    );
    render(<RadarMap location={NYC} />);
    await screen.findByRole("button", { name: "Play radar" });

    fireEvent.click(screen.getByRole("button", { name: "Clouds" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Satellite cloud request failed (503 Service Unavailable).",
    );
    expect(screen.getByRole("button", { name: "Play radar" })).toBeInTheDocument();
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
    await waitFor(() => expect(radarOpacities().slice(-2)).toEqual([0, 0.6]));
  });

  it("drops the wind layer when radar is selected", async () => {
    fetchRadarFrames.mockResolvedValue(TWO_FRAMES);
    render(<RadarMap location={NYC} />);
    await screen.findByText(/Wind now/);

    fireEvent.click(screen.getByRole("radio", { name: "Radar" }));

    expect(screen.queryByText(/Wind now|Loading wind/)).not.toBeInTheDocument();
    await waitFor(() => expect(radarOpacities().slice(-2)).toEqual([0, 0.85]));
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
    await waitFor(() => expect(radarOpacities().slice(-2)).toEqual([0, 0.6]));
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
