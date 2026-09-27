import type { TemperatureUnit } from "./forecast";

/** Metres in one degree of latitude. Longitude is scaled by cos(latitude). */
const METERS_PER_DEGREE = 111_320;

/** Wider than this, the lattice is only a broad sketch of the flow. */
const COARSE_SPACING_DEG = 1.5;

const DEFAULT_MAX_POINTS = 120;
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export interface LngLat {
  longitude: number;
  latitude: number;
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface WindLattice {
  /** Unwrapped longitudes, west to east. May exceed 180 across the antimeridian. */
  longitudes: number[];
  /** South to north. */
  latitudes: number[];
  /** Row-major south → north, west → east. Longitude normalized to [-180, 180]. */
  points: LngLat[];
  spacingDeg: number;
  coarse: boolean;
  crossesAntimeridian: boolean;
}

export interface WindField {
  longitudes: number[];
  latitudes: number[];
  /** `u[latIndex][lonIndex]`, m/s eastward. Null where the response had no wind. */
  u: (number | null)[][];
  /** m/s northward. */
  v: (number | null)[][];
  time: string | null;
  coarse: boolean;
}

interface CurrentWind {
  time?: string;
  wind_speed_10m?: number | null;
  wind_direction_10m?: number | null;
}

interface LocationPayload {
  current?: CurrentWind;
}

function normalizeLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function span(bounds: Bounds): {
  west: number;
  width: number;
  crosses: boolean;
} {
  const crosses = bounds.east < bounds.west;
  const width = crosses ? bounds.east + 360 - bounds.west : bounds.east - bounds.west;
  return { west: bounds.west, width, crosses };
}

/** Snap a viewport outward onto `step` degrees so a small pan reuses a grid. */
export function quantizeBounds(bounds: Bounds, step = 0.25): Bounds {
  const { west, width } = span(bounds);
  const eastUnwrapped = west + width;
  const snappedWest = Math.floor(west / step) * step;
  let snappedEast = Math.ceil(eastUnwrapped / step) * step;
  const snappedSouth = Math.floor(bounds.south / step) * step;
  let snappedNorth = Math.ceil(bounds.north / step) * step;
  if (snappedEast <= snappedWest) snappedEast = snappedWest + step;
  if (snappedNorth <= snappedSouth) snappedNorth = snappedSouth + step;

  return {
    west: normalizeLon(snappedWest),
    south: Math.max(-90, snappedSouth),
    east: normalizeLon(snappedEast),
    north: Math.min(90, snappedNorth),
  };
}

/** Cache key for a viewport. Nearby pans that quantize together share a key. */
export function boundsKey(bounds: Bounds, step = 0.25): string {
  const snapped = quantizeBounds(bounds, step);
  return [snapped.west, snapped.south, snapped.east, snapped.north]
    .map((value) => value.toFixed(2))
    .join(",");
}

/**
 * A lat/lon lattice over the visible bounds, capped at `maxPoints`.
 * Longitudes are unwrapped so a view across ±180 stays one continuous grid.
 */
export function gridForBounds(
  bounds: Bounds,
  { maxPoints = DEFAULT_MAX_POINTS }: { maxPoints?: number } = {},
): WindLattice {
  const { west, width, crosses } = span(bounds);
  const safeWidth = Math.max(width, 1e-6);
  const height = Math.max(bounds.north - bounds.south, 1e-6);
  const aspect = safeWidth / height;

  let cols = Math.max(2, Math.round(Math.sqrt(maxPoints * aspect)));
  let rows = Math.max(2, Math.round(Math.sqrt(maxPoints / aspect)));
  while (cols * rows > maxPoints && (cols > 2 || rows > 2)) {
    if (cols >= rows && cols > 2) cols -= 1;
    else rows -= 1;
  }

  const longitudes = Array.from({ length: cols }, (_, col) => {
    const t = cols === 1 ? 0 : col / (cols - 1);
    return west + t * safeWidth;
  });
  const latitudes = Array.from({ length: rows }, (_, row) => {
    const t = rows === 1 ? 0 : row / (rows - 1);
    return bounds.south + t * height;
  });

  const points = latitudes.flatMap((latitude) =>
    longitudes.map((longitude) => ({
      latitude,
      longitude: normalizeLon(longitude),
    })),
  );

  const lonStep = cols > 1 ? safeWidth / (cols - 1) : safeWidth;
  const latStep = rows > 1 ? height / (rows - 1) : height;
  const spacingDeg = Math.max(lonStep, latStep);

  return {
    longitudes,
    latitudes,
    points,
    spacingDeg,
    coarse: spacingDeg > COARSE_SPACING_DEG,
    crossesAntimeridian: crosses,
  };
}

function formatCoord(value: number): string {
  return String(Math.round(value * 1e4) / 1e4);
}

/** Open-Meteo current-wind URL for a lattice. Speed comes back in m/s. */
export function windForecastUrl(points: LngLat[]): string {
  const url = new URL(FORECAST_URL);
  url.searchParams.set(
    "latitude",
    points.map((point) => formatCoord(point.latitude)).join(","),
  );
  url.searchParams.set(
    "longitude",
    points.map((point) => formatCoord(point.longitude)).join(","),
  );
  url.searchParams.set("current", "wind_speed_10m,wind_direction_10m");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("forecast_days", "1");
  return url.toString();
}

/**
 * Meteorological direction (degrees clockwise from north, the direction the
 * wind comes *from*) to an eastward `u` and northward `v`, in m/s.
 */
export function toVector(
  speedMs: number,
  directionDeg: number,
): { u: number; v: number } {
  const rad = (directionDeg * Math.PI) / 180;
  return {
    u: -speedMs * Math.sin(rad),
    v: -speedMs * Math.cos(rad),
  };
}

function asLocations(payload: unknown): LocationPayload[] {
  if (Array.isArray(payload)) return payload as LocationPayload[];
  if (payload && typeof payload === "object") return [payload as LocationPayload];
  throw new Error("Wind response was missing current wind data.");
}

/** Build a grid of u/v components. Null cells stay null; too few points is an error. */
export function parseWindGrid(payload: unknown, lattice: WindLattice): WindField {
  const locations = asLocations(payload);
  if (locations.length !== lattice.points.length) {
    throw new Error("Wind response was missing current wind data.");
  }

  const rows = lattice.latitudes.length;
  const cols = lattice.longitudes.length;
  const u: (number | null)[][] = [];
  const v: (number | null)[][] = [];
  let valid = 0;
  let time: string | null = null;

  for (let row = 0; row < rows; row += 1) {
    const uRow: (number | null)[] = [];
    const vRow: (number | null)[] = [];
    for (let col = 0; col < cols; col += 1) {
      const current = locations[row * cols + col]?.current;
      if (current?.time && !time) time = current.time;
      const speed = current?.wind_speed_10m;
      const direction = current?.wind_direction_10m;
      if (typeof speed !== "number" || typeof direction !== "number") {
        uRow.push(null);
        vRow.push(null);
        continue;
      }
      const vector = toVector(speed, direction);
      uRow.push(vector.u);
      vRow.push(vector.v);
      valid += 1;
    }
    u.push(uRow);
    v.push(vRow);
  }

  if (valid < 4) {
    throw new Error("Wind response didn't include enough data for this view.");
  }

  return {
    longitudes: lattice.longitudes,
    latitudes: lattice.latitudes,
    u,
    v,
    time,
    coarse: lattice.coarse,
  };
}

function unwrap(longitude: number, west: number, east: number): number {
  let value = longitude;
  while (value < west) value += 360;
  while (value > east && value - 360 >= west) value -= 360;
  return value;
}

/** Bilinear sample of u and v. Null where the point is outside or a corner is missing. */
export function sample(
  field: WindField,
  longitude: number,
  latitude: number,
): { u: number; v: number } | null {
  const { longitudes: lons, latitudes: lats } = field;
  const west = lons[0];
  const east = lons[lons.length - 1];
  const south = lats[0];
  const north = lats[lats.length - 1];
  const x = unwrap(longitude, west, east);
  if (x < west || x > east || latitude < south || latitude > north) return null;

  let col = 0;
  while (col < lons.length - 2 && lons[col + 1] < x) col += 1;
  let row = 0;
  while (row < lats.length - 2 && lats[row + 1] < latitude) row += 1;

  const lonSpan = lons[col + 1] - lons[col];
  const latSpan = lats[row + 1] - lats[row];
  const tx = lonSpan === 0 ? 0 : (x - lons[col]) / lonSpan;
  const ty = latSpan === 0 ? 0 : (latitude - lats[row]) / latSpan;

  const cornersU = [
    field.u[row][col],
    field.u[row][col + 1],
    field.u[row + 1]?.[col],
    field.u[row + 1]?.[col + 1],
  ];
  const cornersV = [
    field.v[row][col],
    field.v[row][col + 1],
    field.v[row + 1]?.[col],
    field.v[row + 1]?.[col + 1],
  ];
  if (cornersU.some((value) => value == null) || cornersV.some((value) => value == null)) {
    return null;
  }

  const [u00, u10, u01, u11] = cornersU as number[];
  const [v00, v10, v01, v11] = cornersV as number[];
  const lerp = (a: number, b: number, c: number, d: number) =>
    (1 - tx) * (1 - ty) * a + tx * (1 - ty) * b + (1 - tx) * ty * c + tx * ty * d;

  return { u: lerp(u00, u10, u01, u11), v: lerp(v00, v10, v01, v11) };
}

const MERCATOR_METERS_PER_PIXEL_Z0 = 156_543.03392;

/**
 * Model-time step for one animation frame, calibrated so a 10 m/s wind moves
 * about `pixelsPerFrame` on screen. Faster wind moves further; the clock is
 * not real time (a true 10 m/s would be a fraction of a pixel per frame).
 * The default is deliberately slow so the field drifts instead of racing.
 */
export function flowDt(
  zoom: number,
  latitude: number,
  frameSeconds: number,
  pixelsPerFrame = 1.4,
): number {
  const safeZoom = Math.min(Math.max(zoom, 0), 18);
  const cos = Math.max(Math.cos((latitude * Math.PI) / 180), 0.2);
  const metersPerPixel =
    (MERCATOR_METERS_PER_PIXEL_Z0 * cos) / 2 ** safeZoom;
  return ((pixelsPerFrame * metersPerPixel) / 10) * (frameSeconds / (1 / 60));
}

/** One advection step. A point with no sample stays put. */
export function stepParticle(
  particle: LngLat,
  field: WindField,
  dtSeconds: number,
): LngLat {
  const wind = sample(field, particle.longitude, particle.latitude);
  if (!wind) return { longitude: particle.longitude, latitude: particle.latitude };

  const latRad = (particle.latitude * Math.PI) / 180;
  const metersPerDegLon = METERS_PER_DEGREE * Math.max(Math.cos(latRad), 0.01);
  const latitude = Math.max(
    -90,
    Math.min(90, particle.latitude + (wind.v * dtSeconds) / METERS_PER_DEGREE),
  );
  return {
    longitude: normalizeLon(particle.longitude + (wind.u * dtSeconds) / metersPerDegLon),
    latitude,
  };
}

/** Median wind speed in the field, in m/s. Null when every cell is missing. */
export function typicalSpeedMs(field: WindField): number | null {
  const speeds: number[] = [];
  for (let row = 0; row < field.u.length; row += 1) {
    for (let col = 0; col < field.u[row].length; col += 1) {
      const u = field.u[row][col];
      const v = field.v[row][col];
      if (u == null || v == null) continue;
      speeds.push(Math.hypot(u, v));
    }
  }
  if (speeds.length === 0) return null;
  speeds.sort((a, b) => a - b);
  return speeds[Math.floor(speeds.length / 2)];
}

/** Whole mph (°F) or km/h (°C), matching the forecast client's wind units. */
export function displaySpeed(speedMs: number, unit: TemperatureUnit): number {
  const converted = unit === "celsius" ? speedMs * 3.6 : speedMs * 2.2369362920544;
  return Math.round(converted);
}

export function windUnitLabel(unit: TemperatureUnit): "mph" | "km/h" {
  return unit === "celsius" ? "km/h" : "mph";
}

/** Open-Meteo `current.time` with no offset is GMT. Show the clock, not a local shift. */
export function formatWindTime(time: string | null): string | null {
  if (!time) return null;
  const match = /(\d{2}:\d{2})/.exec(time);
  return match ? `${match[1]} UTC` : null;
}

/**
 * Deep blue (calm) → teal → orange (about 30 m/s). Saturated on purpose:
 * the basemap is a light street map, and a white trail disappears on it.
 */
export function speedColor(speedMs: number): string {
  const t = Math.max(0, Math.min(1, speedMs / 30));
  const mix = (from: number, to: number, amount: number) =>
    Math.round(from + (to - from) * amount);
  if (t < 0.5) {
    const amount = t / 0.5;
    return `rgb(${mix(14, 20, amount)}, ${mix(116, 184, amount)}, ${mix(184, 196, amount)})`;
  }
  const amount = (t - 0.5) / 0.5;
  return `rgb(${mix(20, 234, amount)}, ${mix(184, 88, amount)}, ${mix(196, 12, amount)})`;
}

/**
 * Fetch and parse the current 10 m wind for a lattice.
 * HTTP failures and unusable payloads throw — callers surface the message.
 */
export async function fetchWindField(
  lattice: WindLattice,
  { signal }: { signal?: AbortSignal } = {},
): Promise<WindField> {
  const res = await fetch(windForecastUrl(lattice.points), { signal });
  if (!res.ok) {
    throw new Error(`Wind request failed (${res.status} ${res.statusText}).`);
  }
  const data: unknown = await res.json();
  return parseWindGrid(data, lattice);
}
