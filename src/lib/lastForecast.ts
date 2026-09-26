import type { Forecast, TemperatureUnit } from "./forecast";

const PREFIX = "weather:last-forecast:";

export interface CachedForecast {
  forecast: Forecast;
  /** Epoch ms when this forecast was saved. */
  savedAt: number;
}

function key(
  lat: number,
  lon: number,
  unit: TemperatureUnit,
): string {
  return `${PREFIX}${lat.toFixed(3)},${lon.toFixed(3)}:${unit}`;
}

/** Persist the last successful forecast so it can be shown offline (NFR-7). */
export function saveForecast(
  lat: number,
  lon: number,
  unit: TemperatureUnit,
  forecast: Forecast,
  savedAt: number,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key(lat, lon, unit),
      JSON.stringify({ forecast, savedAt }),
    );
  } catch {
    // Storage full/unavailable — offline fallback is best-effort.
  }
}

/** Load the last saved forecast for a location + unit, or null. */
export function loadForecast(
  lat: number,
  lon: number,
  unit: TemperatureUnit,
): CachedForecast | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key(lat, lon, unit));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedForecast;
    if (
      parsed &&
      typeof parsed.savedAt === "number" &&
      parsed.forecast &&
      Array.isArray(parsed.forecast.days)
    ) {
      return parsed;
    }
  } catch {
    // Corrupt entry — ignore.
  }
  return null;
}
