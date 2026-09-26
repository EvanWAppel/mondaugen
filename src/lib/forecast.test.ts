import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchForecast } from "./forecast";

function payload(days = 10) {
  const range = Array.from({ length: days }, (_, i) => i);
  const hours = Array.from({ length: days * 24 }, (_, i) => i);
  return {
    daily: {
      time: range.map((i) => `2026-08-${String(16 + i).padStart(2, "0")}`),
      temperature_2m_max: range.map((i) => 80 + i),
      temperature_2m_min: range.map((i) => 60 + i),
      precipitation_sum: range.map((i) => (i === 2 ? null : 0)),
      precipitation_probability_max: range.map((i) => (i === 1 ? null : i * 10)),
      weather_code: range.map(() => 3),
      sunrise: range.map((i) => `2026-08-${String(16 + i).padStart(2, "0")}T06:00`),
      sunset: range.map((i) => `2026-08-${String(16 + i).padStart(2, "0")}T18:00`),
    },
    hourly: {
      time: hours.map((i) => `hour-${i}`),
      temperature_2m: hours.map((i) => 70 + (i % 24)),
      dew_point_2m: hours.map(() => 50),
      apparent_temperature: hours.map((i) => 72 + (i % 24)),
      cloud_cover: hours.map(() => 25),
      // Every 12th hour is snowing, at 60% precip probability.
      precipitation_probability: hours.map((i) => (i % 12 === 0 ? 60 : 5)),
      relative_humidity_2m: hours.map(() => 40),
      pressure_msl: hours.map(() => 1013.25),
      snowfall: hours.map((i) => (i % 12 === 0 ? 0.5 : 0)),
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

const NYC = { latitude: 40.71, longitude: -74.01 };

describe("fetchForecast", () => {
  it("normalizes 10 days from the Open-Meteo payload", async () => {
    vi.stubGlobal("fetch", mockFetch({ json: async () => payload() }));
    const forecast = await fetchForecast(NYC, { unit: "fahrenheit" });

    expect(forecast.unit).toBe("fahrenheit");
    expect(forecast.days).toHaveLength(10);
    expect(forecast.days[0]).toEqual({
      date: "2026-08-16",
      tempMax: 80,
      tempMin: 60,
      precipitationSum: 0,
      precipitationProbabilityMax: 0,
      weatherCode: 3,
      sunrise: "2026-08-16T06:00",
      sunset: "2026-08-16T18:00",
    });
  });

  it("maps missing precipitation fields to null", async () => {
    vi.stubGlobal("fetch", mockFetch({ json: async () => payload() }));
    const forecast = await fetchForecast(NYC);
    expect(forecast.days[1].precipitationProbabilityMax).toBeNull();
    expect(forecast.days[2].precipitationSum).toBeNull();
  });

  it("parses the hourly series and converts pressure to inHg", async () => {
    vi.stubGlobal("fetch", mockFetch({ json: async () => payload() }));
    const { hourly } = await fetchForecast(NYC);

    expect(hourly.time).toHaveLength(240);
    expect(hourly.feelsLike[1]).toBe(73);
    // 1013.25 hPa ≈ 29.92 inHg (standard sea-level pressure).
    expect(hourly.pressureInHg[0]).toBeCloseTo(29.92, 2);
  });

  it("derives chance of snow only on hours with snowfall", async () => {
    vi.stubGlobal("fetch", mockFetch({ json: async () => payload() }));
    const { hourly } = await fetchForecast(NYC);

    // Snowing hours mirror precip probability (60); dry hours are 0.
    expect(hourly.chanceOfSnow[0]).toBe(60);
    expect(hourly.chanceOfSnow[1]).toBe(0);
  });

  it("requests the celsius unit, hourly fields, and inch precipitation", async () => {
    const spy = mockFetch({ json: async () => payload() });
    vi.stubGlobal("fetch", spy);
    await fetchForecast(NYC, { unit: "celsius" });
    const requestedUrl = String(spy.mock.calls[0][0]);
    expect(requestedUrl).toContain("temperature_unit=celsius");
    expect(requestedUrl).toContain("forecast_days=10");
    expect(requestedUrl).toContain("precipitation_unit=inch");
    expect(requestedUrl).toContain("pressure_msl");
  });

  it("requests current conditions", async () => {
    const spy = mockFetch({ json: async () => payload() });
    vi.stubGlobal("fetch", spy);
    await fetchForecast(NYC);
    const requestedUrl = String(spy.mock.calls[0][0]);
    expect(requestedUrl).toContain("current=");
    expect(requestedUrl).toContain("is_day");
  });

  it("returns null current when the block is absent", async () => {
    vi.stubGlobal("fetch", mockFetch({ json: async () => payload() }));
    const forecast = await fetchForecast(NYC);
    expect(forecast.current).toBeNull();
  });

  it("parses current conditions when present", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        json: async () => ({
          ...payload(),
          current: {
            temperature_2m: 71,
            apparent_temperature: 69,
            relative_humidity_2m: 55,
            weather_code: 2,
            is_day: 0,
            wind_speed_10m: 8,
          },
        }),
      }),
    );
    const { current } = await fetchForecast(NYC);
    expect(current).toEqual({
      temperature: 71,
      feelsLike: 69,
      humidity: 55,
      weatherCode: 2,
      isDay: false,
      windSpeed: 8,
    });
  });

  it("throws on an HTTP error instead of swallowing it", async () => {
    vi.stubGlobal("fetch", mockFetch({ ok: false, status: 500 }));
    await expect(fetchForecast(NYC)).rejects.toThrow(/500/);
  });

  it("throws when the daily block is missing", async () => {
    vi.stubGlobal("fetch", mockFetch({ json: async () => ({}) }));
    await expect(fetchForecast(NYC)).rejects.toThrow(/missing daily data/i);
  });

  it("throws when the hourly block is missing", async () => {
    vi.stubGlobal("fetch", mockFetch({ json: async () => payload() }));
    // Strip hourly from the payload after the daily check passes.
    vi.stubGlobal(
      "fetch",
      mockFetch({ json: async () => ({ daily: payload().daily }) }),
    );
    await expect(fetchForecast(NYC)).rejects.toThrow(/missing hourly data/i);
  });
});
