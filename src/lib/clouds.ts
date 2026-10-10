import type { GetResourceResponse, RequestParameters } from "maplibre-gl";

/**
 * Satellite cloud cover from NASA GIBS: GOES-East ABI GeoColor, keyless WMTS
 * tiles refreshed every 10 minutes. GeoColor is a full true-colour image, so
 * each tile is run through `cloudify` client-side to keep only the clouds.
 * Coverage is the Americas; outside it GIBS returns fully transparent tiles.
 */
const GIBS_HOST = "gibs.earthdata.nasa.gov";
const CLOUD_LAYER = "GOES-East_ABI_GeoColor";
const TILE_MATRIX_SET = "GoogleMapsCompatible_Level7";

/** GeoColor is published down to zoom 7 (matches the radar cap). */
export const CLOUD_MAX_ZOOM = 7;

/** MapLibre custom protocol that routes tiles through `loadCloudTile`. */
export const CLOUD_PROTOCOL = "clouds";

function layerPath(time: string): string {
  return `${GIBS_HOST}/wmts/epsg3857/best/${CLOUD_LAYER}/default/${time}/${TILE_MATRIX_SET}`;
}

/** MapLibre raster tile template for one GeoColor image time. */
export function cloudTileUrl(time: string): string {
  return `${CLOUD_PROTOCOL}://${layerPath(time)}/{z}/{y}/{x}.png`;
}

/**
 * Resolve the latest GeoColor image time. GIBS answers `default` with the
 * newest image and names it in `layer-time-actual`; pinning that time keeps
 * every tile in a session from the same scan. Errors surface (FR-6).
 */
export async function fetchLatestCloudTime({
  signal,
}: { signal?: AbortSignal } = {}): Promise<string> {
  const res = await fetch(`https://${layerPath("default")}/0/0/0.png`, {
    method: "HEAD",
    signal,
  });
  if (!res.ok) {
    throw new Error(
      `Satellite cloud request failed (${res.status} ${res.statusText}).`,
    );
  }
  const time = res.headers.get("layer-time-actual");
  if (!time) {
    throw new Error("Satellite cloud response was missing its image time.");
  }
  return time;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Cloud opacity (0–255) for a GeoColor pixel: clouds are bright and nearly
 * colourless, while ocean and land are dark and desert and city lights are
 * strongly tinted. Snow cover also passes, as it does on any visible image.
 */
export function cloudAlpha(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const sat = max === 0 ? 0 : (max - min) / max;
  return Math.round(255 * smoothstep(0.3, 0.7, lum) * (1 - smoothstep(0.12, 0.35, sat)));
}

/** Rewrite RGBA pixel alpha in place so only clouds stay visible. */
export function cloudify(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] = Math.min(data[i + 3], cloudAlpha(data[i], data[i + 1], data[i + 2]));
  }
}

/** `addProtocol` loader: fetch the GIBS tile and return a clouds-only bitmap. */
export async function loadCloudTile(
  params: Pick<RequestParameters, "url">,
  abortController: AbortController,
): Promise<GetResourceResponse<ImageBitmap>> {
  const url = params.url.replace(`${CLOUD_PROTOCOL}://`, "https://");
  const res = await fetch(url, { signal: abortController.signal });
  if (!res.ok) {
    throw new Error(
      `Satellite cloud tile failed (${res.status} ${res.statusText}).`,
    );
  }
  const source = await createImageBitmap(await res.blob());
  const canvas = new OffscreenCanvas(source.width, source.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Satellite cloud tile: 2D canvas unavailable.");
  ctx.drawImage(source, 0, 0);
  source.close();
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  cloudify(image.data);
  ctx.putImageData(image, 0, 0);
  return { data: await createImageBitmap(canvas) };
}
