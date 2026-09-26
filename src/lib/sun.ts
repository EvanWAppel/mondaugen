/** Parse an Open-Meteo local timestamp ("2026-09-26T06:52") to minutes since
 *  local midnight, or null if malformed. */
export function isoTimeToMinutes(iso: string | null): number | null {
  if (!iso) return null;
  const time = iso.split("T")[1];
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Location-local "now" in minutes since midnight, derived from the API's
 *  `utc_offset_seconds` so it's correct for any place, not just the browser's. */
export function localNowMinutes(
  utcOffsetSeconds: number,
  epochMs: number,
): number {
  const local = new Date(epochMs + utcOffsetSeconds * 1000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export interface SunPosition {
  /** Daylight elapsed, clamped 0 (sunrise) → 1 (sunset). */
  progress: number;
  /** True only when `now` is actually between sunrise and sunset. */
  isDaytime: boolean;
}

/** Where the sun sits in the day, or null when sun times are unknown/invalid. */
export function sunProgress(
  sunriseMin: number | null,
  sunsetMin: number | null,
  nowMin: number,
): SunPosition | null {
  if (sunriseMin == null || sunsetMin == null || sunsetMin <= sunriseMin) {
    return null;
  }
  const raw = (nowMin - sunriseMin) / (sunsetMin - sunriseMin);
  return {
    progress: Math.max(0, Math.min(1, raw)),
    isDaytime: raw >= 0 && raw <= 1,
  };
}

/** Minutes since midnight → "6:52 AM". */
export function formatClock(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
}
