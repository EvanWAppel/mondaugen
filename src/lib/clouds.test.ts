import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CLOUD_PROTOCOL,
  cloudAlpha,
  cloudify,
  cloudTileUrl,
  fetchLatestCloudTime,
  loadCloudTile,
} from "./clouds";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function headerResponse(
  headers: Record<string, string>,
  init: Partial<Response> = {},
): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers(headers),
    ...init,
  } as Response;
}

describe("cloudAlpha", () => {
  it("keeps bright white cloud pixels opaque", () => {
    expect(cloudAlpha(240, 240, 240)).toBe(255);
  });

  it("drops dark ocean and land pixels", () => {
    expect(cloudAlpha(10, 30, 70)).toBe(0); // deep ocean
    expect(cloudAlpha(60, 80, 40)).toBe(0); // forest
  });

  it("drops bright but saturated pixels (desert, city lights)", () => {
    expect(cloudAlpha(200, 140, 80)).toBe(0); // tan desert
    expect(cloudAlpha(255, 200, 40)).toBe(0); // sodium city lights
  });

  it("fades mid-grey thin cloud partially", () => {
    const a = cloudAlpha(128, 128, 128);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(255);
  });
});

describe("cloudify", () => {
  it("rewrites alpha in place and leaves colour untouched", () => {
    const data = new Uint8ClampedArray([240, 240, 240, 255, 10, 30, 70, 255]);
    cloudify(data);
    expect(Array.from(data)).toEqual([240, 240, 240, 255, 10, 30, 70, 0]);
  });

  it("never raises alpha above the source pixel's", () => {
    const data = new Uint8ClampedArray([240, 240, 240, 0]);
    cloudify(data);
    expect(data[3]).toBe(0);
  });
});

describe("cloudTileUrl", () => {
  it("builds a GIBS GOES-East GeoColor template on the clouds protocol", () => {
    expect(cloudTileUrl("2026-10-10T20:10:00Z")).toBe(
      `${CLOUD_PROTOCOL}://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_GeoColor/default/2026-10-10T20:10:00Z/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
    );
  });
});

describe("fetchLatestCloudTime", () => {
  it("reads the resolved image time from GIBS's layer-time-actual header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        headerResponse({ "layer-time-actual": "2026-10-10T20:10:00Z" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLatestCloudTime()).resolves.toBe("2026-10-10T20:10:00Z");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/GOES-East_ABI_GeoColor/default/default/");
    expect(init.method).toBe("HEAD");
  });

  it("throws on an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          headerResponse({}, { ok: false, status: 503, statusText: "Service Unavailable" }),
        ),
    );
    await expect(fetchLatestCloudTime()).rejects.toThrow(
      "image time request failed (503 Service Unavailable).",
    );
  });

  it("omits the empty HTTP/2 status text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(headerResponse({}, { ok: false, status: 503, statusText: "" })),
    );
    await expect(fetchLatestCloudTime()).rejects.toThrow(
      "image time request failed (503).",
    );
  });

  it("throws when the time header is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(headerResponse({})));
    await expect(fetchLatestCloudTime()).rejects.toThrow(
      "response was missing its image time.",
    );
  });
});

describe("loadCloudTile", () => {
  it("fetches the https tile and returns a processed bitmap", async () => {
    const pixels = new Uint8ClampedArray([240, 240, 240, 255, 10, 30, 70, 255]);
    const ctx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: pixels })),
      putImageData: vi.fn(),
    };
    class FakeCanvas {
      constructor(
        public width: number,
        public height: number,
      ) {}
      getContext() {
        return ctx;
      }
    }
    const output = { width: 2, height: 1, close: vi.fn() };
    const createImageBitmap = vi
      .fn()
      .mockResolvedValueOnce({ width: 2, height: 1, close: vi.fn() })
      .mockResolvedValueOnce(output);
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, statusText: "OK", blob: async () => new Blob() });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("OffscreenCanvas", FakeCanvas);
    vi.stubGlobal("createImageBitmap", createImageBitmap);

    const res = await loadCloudTile(
      { url: `${CLOUD_PROTOCOL}://gibs.example/5/11/8.png` },
      new AbortController(),
    );

    expect(fetchMock.mock.calls[0][0]).toBe("https://gibs.example/5/11/8.png");
    expect(Array.from(pixels)).toEqual([240, 240, 240, 255, 10, 30, 70, 0]);
    expect(ctx.putImageData).toHaveBeenCalled();
    expect(res.data).toBe(output);
  });

  it("throws a readable error when the tile request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" }),
    );
    await expect(
      loadCloudTile({ url: `${CLOUD_PROTOCOL}://gibs.example/1/0/0.png` }, new AbortController()),
    ).rejects.toThrow("tile request failed (404 Not Found).");
  });
});
