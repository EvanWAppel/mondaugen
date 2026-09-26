import { afterEach, describe, expect, it, vi } from "vitest";
import {
  boundsKey,
  displaySpeed,
  fetchWindField,
  flowDt,
  formatWindTime,
  gridForBounds,
  parseWindGrid,
  quantizeBounds,
  sample,
  speedColor,
  stepParticle,
  toVector,
  windForecastUrl,
  windUnitLabel,
  type WindField,
  type WindLattice,
} from "./wind";

const SQUARE: WindLattice = {
  longitudes: [0, 1],
  latitudes: [0, 1],
  points: [
    { longitude: 0, latitude: 0 },
    { longitude: 1, latitude: 0 },
    { longitude: 0, latitude: 1 },
    { longitude: 1, latitude: 1 },
  ],
  spacingDeg: 1,
  coarse: false,
  crossesAntimeridian: false,
};

function cell(
  speed: number | null,
  direction: number | null,
  time = "2026-09-26T15:00",
) {
  return {
    current: {
      time,
      wind_speed_10m: speed,
      wind_direction_10m: direction,
    },
  };
}

function mockFetch(response: Partial<Response> & { json?: () => unknown }) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({}),
    ...response,
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("gridForBounds", () => {
  it("covers the viewport with at most maxPoints, south to north and west to east", () => {
    const lattice = gridForBounds(
      { west: -74.5, south: 40.4, east: -73.5, north: 41.0 },
      { maxPoints: 120 },
    );

    expect(lattice.points.length).toBeGreaterThanOrEqual(4);
    expect(lattice.points.length).toBeLessThanOrEqual(120);
    expect(lattice.points.length).toBe(
      lattice.longitudes.length * lattice.latitudes.length,
    );
    expect(lattice.longitudes[0]).toBeCloseTo(-74.5);
    expect(lattice.longitudes.at(-1)).toBeCloseTo(-73.5);
    expect(lattice.latitudes[0]).toBeCloseTo(40.4);
    expect(lattice.latitudes.at(-1)).toBeCloseTo(41);
    expect(lattice.points[0]).toEqual({
      longitude: lattice.longitudes[0],
      latitude: lattice.latitudes[0],
    });
    expect(lattice.spacingDeg).toBeLessThan(1.5);
    expect(lattice.coarse).toBe(false);
    expect(lattice.crossesAntimeridian).toBe(false);
  });

  it("marks a continent-scale view as a coarse sketch", () => {
    const lattice = gridForBounds(
      { west: -100, south: 25, east: -70, north: 50 },
      { maxPoints: 120 },
    );

    expect(lattice.coarse).toBe(true);
    expect(lattice.spacingDeg).toBeGreaterThan(1.5);
    expect(lattice.points.length).toBeLessThanOrEqual(120);
  });

  it("unwraps a viewport that crosses the antimeridian and normalizes request points", () => {
    const lattice = gridForBounds({
      west: 170,
      south: -10,
      east: -170,
      north: 10,
    });

    expect(lattice.crossesAntimeridian).toBe(true);
    expect(lattice.longitudes[0]).toBeCloseTo(170);
    expect(lattice.longitudes.at(-1)).toBeGreaterThan(180);
    expect(
      lattice.points.every(
        (point) => point.longitude >= -180 && point.longitude <= 180,
      ),
    ).toBe(true);
  });
});

describe("quantizeBounds", () => {
  it("snaps outward so a small pan shares a cache key", () => {
    const a = quantizeBounds({
      west: -74.12,
      south: 40.61,
      east: -73.88,
      north: 40.89,
    });
    const b = quantizeBounds({
      west: -74.18,
      south: 40.66,
      east: -73.91,
      north: 40.93,
    });

    expect(a.west).toBeCloseTo(-74.25);
    expect(a.south).toBeCloseTo(40.5);
    expect(a.east).toBeCloseTo(-73.75);
    expect(a.north).toBeCloseTo(41);
    expect(boundsKey(a)).toBe(boundsKey(b));
  });

  it("keeps an antimeridian span continuous when snapping", () => {
    const snapped = quantizeBounds(
      { west: 170.2, south: -1.1, east: -170.4, north: 1.2 },
      0.25,
    );

    expect(snapped.west).toBeCloseTo(170);
    expect(snapped.east).toBeCloseTo(-170.25);
    expect(snapped.south).toBeCloseTo(-1.25);
    expect(snapped.north).toBeCloseTo(1.25);
  });
});

describe("windForecastUrl", () => {
  it("requests current 10 m wind in m/s for every point", () => {
    const url = new URL(
      windForecastUrl([
        { latitude: 40.5, longitude: -74 },
        { latitude: 41, longitude: -73.5 },
      ]),
    );

    expect(`${url.origin}${url.pathname}`).toBe(
      "https://api.open-meteo.com/v1/forecast",
    );
    expect(url.searchParams.get("latitude")).toBe("40.5,41");
    expect(url.searchParams.get("longitude")).toBe("-74,-73.5");
    expect(url.searchParams.get("current")).toBe(
      "wind_speed_10m,wind_direction_10m",
    );
    expect(url.searchParams.get("wind_speed_unit")).toBe("ms");
    expect(url.searchParams.get("forecast_days")).toBe("1");
  });
});

describe("toVector", () => {
  it("turns a west wind into an eastward vector", () => {
    const { u, v } = toVector(10, 270);
    expect(u).toBeCloseTo(10);
    expect(v).toBeCloseTo(0);
  });

  it("turns a north wind into a southward vector", () => {
    const { u, v } = toVector(10, 0);
    expect(u).toBeCloseTo(0);
    expect(v).toBeCloseTo(-10);
  });

  it("turns an east wind into a westward vector", () => {
    const { u, v } = toVector(10, 90);
    expect(u).toBeCloseTo(-10);
    expect(v).toBeCloseTo(0);
  });
});

describe("parseWindGrid", () => {
  it("parses a multi-location array into eastward and northward components", () => {
    const field = parseWindGrid(
      [
        cell(10, 270),
        cell(0, 0),
        cell(10, 270),
        cell(0, 0),
      ],
      SQUARE,
    );

    expect(field.time).toBe("2026-09-26T15:00");
    expect(field.u[0][0]).toBeCloseTo(10);
    expect(field.v[0][0]).toBeCloseTo(0);
    expect(field.u[0][1]).toBeCloseTo(0);
    expect(field.coarse).toBe(false);
  });

  it("keeps a null cell and still returns the field when enough points remain", () => {
    const rows = [0, 1, 2];
    const lattice: WindLattice = {
      longitudes: rows,
      latitudes: rows,
      points: rows.flatMap((latitude) =>
        rows.map((longitude) => ({ longitude, latitude })),
      ),
      spacingDeg: 1,
      coarse: false,
      crossesAntimeridian: false,
    };
    const payload = lattice.points.map((_, index) =>
      index === 0 ? cell(null, null) : cell(10, 270),
    );

    const field = parseWindGrid(payload, lattice);

    expect(field.u[0][0]).toBeNull();
    expect(field.u[2][2]).toBeCloseTo(10);
  });

  it("rejects a bare object when the grid asked for more than one location", () => {
    expect(() => parseWindGrid(cell(10, 270), SQUARE)).toThrow(
      /missing current wind/i,
    );
  });

  it("throws when fewer than four valid samples remain", () => {
    expect(() =>
      parseWindGrid(
        [cell(10, 270), cell(null, null), cell(null, null), cell(5, 180)],
        SQUARE,
      ),
    ).toThrow(/enough data/i);
  });

  it("throws when the payload has no locations", () => {
    expect(() => parseWindGrid(null, SQUARE)).toThrow(/missing current wind/i);
  });
});

function latticeOf(size: number): WindLattice {
  const axis = Array.from({ length: size }, (_, index) => index);
  return {
    longitudes: axis,
    latitudes: axis,
    points: axis.flatMap((latitude) =>
      axis.map((longitude) => ({ longitude, latitude })),
    ),
    spacingDeg: 1,
    coarse: false,
    crossesAntimeridian: false,
  };
}

describe("sample", () => {
  it("interpolates the components, not the compass direction", () => {
    const field = parseWindGrid(
      [cell(10, 270), cell(0, 0), cell(10, 270), cell(0, 0)],
      SQUARE,
    );

    const mid = sample(field, 0.5, 0.5);

    expect(mid?.u).toBeCloseTo(5);
    expect(mid?.v).toBeCloseTo(0);
  });

  it("returns null outside the field and on a cell with a missing corner", () => {
    const lattice = latticeOf(3);
    const field = parseWindGrid(
      lattice.points.map((_, index) =>
        index === 0 ? cell(null, null) : cell(10, 270),
      ),
      lattice,
    );

    expect(sample(field, 0, 0)).toBeNull();
    expect(sample(field, 5, 5)).toBeNull();
    expect(sample(field, 2, 2)?.u).toBeCloseTo(10);
  });

  it("samples across the antimeridian using the unwrapped grid", () => {
    const field: WindField = {
      longitudes: [170, 190],
      latitudes: [0, 10],
      u: [
        [10, 0],
        [10, 0],
      ],
      v: [
        [0, 0],
        [0, 0],
      ],
      time: null,
      coarse: false,
    };

    // -175° is 185° unwrapped, three quarters of the way from 170 to 190.
    expect(sample(field, -175, 5)?.u).toBeCloseTo(2.5);
    expect(sample(field, -175, 5)?.v).toBeCloseTo(0);
  });
});

describe("stepParticle", () => {
  it("advects eastward under a west wind", () => {
    const field = parseWindGrid(
      [cell(10, 270), cell(10, 270), cell(10, 270), cell(10, 270)],
      {
        ...SQUARE,
        longitudes: [-1, 1],
        latitudes: [-1, 1],
        points: [
          { longitude: -1, latitude: -1 },
          { longitude: 1, latitude: -1 },
          { longitude: -1, latitude: 1 },
          { longitude: 1, latitude: 1 },
        ],
      },
    );

    const next = stepParticle(
      { longitude: 0, latitude: 0 },
      field,
      11132,
    );

    expect(next.longitude).toBeCloseTo(1, 1);
    expect(next.latitude).toBeCloseTo(0, 1);
  });

  it("leaves the particle where it is when that point has no wind", () => {
    const lattice = latticeOf(3);
    const field = parseWindGrid(
      lattice.points.map((_, index) =>
        index === 0 ? cell(null, null) : cell(10, 270),
      ),
      lattice,
    );

    expect(stepParticle({ longitude: 0, latitude: 0 }, field, 100)).toEqual({
      longitude: 0,
      latitude: 0,
    });
  });
});

describe("flowDt", () => {
  it("moves a 10 m/s wind a few pixels per frame at city zoom", () => {
    const dt = flowDt(7, 0, 1 / 60);
    const metersPerPixel = 156_543.03392 / 128;
    expect((10 * dt) / metersPerPixel).toBeCloseTo(3.2, 1);
  });
});

describe("display helpers", () => {
  it("renders speed in mph or km/h to match the temperature unit", () => {
    expect(displaySpeed(10, "fahrenheit")).toBe(22);
    expect(displaySpeed(10, "celsius")).toBe(36);
    expect(windUnitLabel("fahrenheit")).toBe("mph");
    expect(windUnitLabel("celsius")).toBe("km/h");
  });

  it("labels an Open-Meteo timestamp as UTC", () => {
    expect(formatWindTime("2026-09-26T15:00")).toBe("15:00 UTC");
    expect(formatWindTime(null)).toBeNull();
  });

  it("runs from cyan through white to amber as speed increases", () => {
    expect(speedColor(0)).toBe("rgb(125, 211, 252)");
    expect(speedColor(15)).toBe("rgb(255, 255, 255)");
    expect(speedColor(30)).toBe("rgb(251, 191, 36)");
  });
});

describe("fetchWindField", () => {
  it("fetches the grid and parses components", async () => {
    const fetchMock = mockFetch({
      json: async () => [
        cell(10, 270),
        cell(10, 270),
        cell(10, 270),
        cell(10, 270),
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const field = await fetchWindField(SQUARE);

    expect(field.u[0][0]).toBeCloseTo(10);
    expect(String(fetchMock.mock.calls[0][0])).toContain("wind_speed_unit=ms");
  });

  it("surfaces HTTP failures", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ ok: false, status: 503, statusText: "Unavailable" }),
    );

    await expect(fetchWindField(SQUARE)).rejects.toThrow(
      "Wind request failed (503 Unavailable).",
    );
  });
});
