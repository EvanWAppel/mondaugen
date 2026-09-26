import type { Location } from "./types";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** Days of daily forecast to request/display (PRD: exactly 10). */
export const FORECAST_DAYS = 10;

export type TemperatureUnit = "fahrenheit" | "celsius";

/** One day of the daily forecast, normalized from the Open-Meteo payload. */
export interface DailyForecast {
  /** ISO date, e.g. "2026-08-16". */
  date: string;
  tempMax: number;
  tempMin: number;
  /** Total precipitation for the day (inches), or null when unreported. */
  precipitationSum: number | null;
  /** Max precipitation probability (%), or null when unreported. */
  precipitationProbabilityMax: number | null;
  /** WMO weather interpretation code. */
  weatherCode: number;
  /** Local sunrise timestamp ("2026-09-26T06:52"), or null when unreported. */
  sunrise: string | null;
  /** Local sunset timestamp, or null when unreported. */
  sunset: string | null;
}

/**
 * Hourly series over the 10-day window, driving the trend charts. Each array is
 * parallel to `time` (240 points for 10 days). Percent fields are 0–100.
 */
export interface HourlyForecast {
  /** ISO local wall-clock timestamps, e.g. "2026-08-22T00:00". */
  time: string[];
  /** Air temperature, in the requested unit. */
  temperature: number[];
  dewPoint: number[];
  /** Apparent ("feels like") temperature, in the requested unit. */
  feelsLike: number[];
  cloudCover: number[];
  precipProbability: number[];
  humidity: number[];
  /** Sea-level pressure converted to inches of mercury (inHg). */
  pressureInHg: number[];
  /**
   * Chance of snow (%). Open-Meteo has no snow-probability field, so this is
   * derived: the precipitation probability on hours where snowfall is expected,
   * otherwise 0. Non-zero only in cold/snowy conditions.
   */
  chanceOfSnow: number[];
}

/**
 * Present-moment conditions for the hero and the sky-reactive background.
 * Null when Open-Meteo omits the `current` block, in which case the UI falls
 * back to today's daily summary.
 */
export interface CurrentConditions {
  /** Air temperature, in the requested unit. */
  temperature: number;
  /** Apparent ("feels like") temperature, in the requested unit. */
  feelsLike: number;
  /** Relative humidity (%). */
  humidity: number;
  /** WMO weather interpretation code. */
  weatherCode: number;
  /** True during daylight at the location (drives day/night sky tones). */
  isDay: boolean;
  /** Wind speed, in the requested unit's companion (mph for °F, km/h for °C). */
  windSpeed: number;
}

export interface Forecast {
  unit: TemperatureUnit;
  /** Present conditions, or null when unavailable. */
  current: CurrentConditions | null;
  /** Location UTC offset (seconds), for computing location-local "now". */
  utcOffsetSeconds: number;
  days: DailyForecast[];
  hourly: HourlyForecast;
}

interface ForecastResponse {
  utc_offset_seconds?: number;
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    is_day?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    weather_code?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    dew_point_2m?: number[];
    apparent_temperature?: number[];
    cloud_cover?: number[];
    precipitation_probability?: (number | null)[];
    relative_humidity_2m?: number[];
    pressure_msl?: number[];
    snowfall?: number[];
  };
}

/** 1 hPa = 0.0295299830714 inHg. */
const HPA_TO_INHG = 0.0295299830714;

/**
 * Fetch a 10-day forecast for a location from Open-Meteo — daily summaries for
 * the day cards plus hourly series for the trend charts.
 *
 * HTTP/network errors and malformed payloads are surfaced (never swallowed)
 * per FR-6, so the UI can show a readable message instead of a blank panel.
 */
export async function fetchForecast(
  location: Pick<Location, "latitude" | "longitude">,
  {
    unit = "fahrenheit",
    signal,
  }: { unit?: TemperatureUnit; signal?: AbortSignal } = {},
): Promise<Forecast> {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,sunrise,sunset",
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,dew_point_2m,apparent_temperature,cloud_cover,precipitation_probability,relative_humidity_2m,pressure_msl,snowfall",
  );
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m",
  );
  url.searchParams.set("forecast_days", String(FORECAST_DAYS));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("temperature_unit", unit);
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("wind_speed_unit", unit === "celsius" ? "kmh" : "mph");

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(
      `Forecast request failed (${res.status} ${res.statusText}).`,
    );
  }

  const data = (await res.json()) as ForecastResponse;
  const daily = data.daily;
  if (
    !daily?.time ||
    !daily.temperature_2m_max ||
    !daily.temperature_2m_min ||
    !daily.weather_code
  ) {
    throw new Error("Forecast response was missing daily data.");
  }

  const days: DailyForecast[] = daily.time.map((date, i) => ({
    date,
    tempMax: daily.temperature_2m_max![i],
    tempMin: daily.temperature_2m_min![i],
    precipitationSum: daily.precipitation_sum?.[i] ?? null,
    precipitationProbabilityMax:
      daily.precipitation_probability_max?.[i] ?? null,
    weatherCode: daily.weather_code![i],
    sunrise: daily.sunrise?.[i] ?? null,
    sunset: daily.sunset?.[i] ?? null,
  }));

  const h = data.hourly;
  if (
    !h?.time ||
    !h.temperature_2m ||
    !h.dew_point_2m ||
    !h.apparent_temperature ||
    !h.cloud_cover ||
    !h.relative_humidity_2m ||
    !h.pressure_msl
  ) {
    throw new Error("Forecast response was missing hourly data.");
  }

  const precipProbability = h.time.map((_, i) => h.precipitation_probability?.[i] ?? 0);
  const snowfall = h.time.map((_, i) => h.snowfall?.[i] ?? 0);

  const hourly: HourlyForecast = {
    time: h.time,
    temperature: h.temperature_2m,
    dewPoint: h.dew_point_2m,
    feelsLike: h.apparent_temperature,
    cloudCover: h.cloud_cover,
    precipProbability,
    humidity: h.relative_humidity_2m,
    pressureInHg: h.pressure_msl.map((hpa) => hpa * HPA_TO_INHG),
    // No native snow-probability field; approximate from snowfall hours.
    chanceOfSnow: snowfall.map((s, i) => (s > 0 ? precipProbability[i] : 0)),
  };

  // `current` is optional — fall back to today's daily summary if absent.
  const c = data.current;
  const current: CurrentConditions | null =
    c && c.temperature_2m != null && c.weather_code != null
      ? {
          temperature: c.temperature_2m,
          feelsLike: c.apparent_temperature ?? c.temperature_2m,
          humidity: c.relative_humidity_2m ?? 0,
          weatherCode: c.weather_code,
          isDay: c.is_day !== 0,
          windSpeed: c.wind_speed_10m ?? 0,
        }
      : null;

  return {
    unit,
    current,
    utcOffsetSeconds: data.utc_offset_seconds ?? 0,
    days,
    hourly,
  };
}
