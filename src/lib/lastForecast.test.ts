import { afterEach, describe, expect, it } from "vitest";
import { loadForecast, saveForecast } from "./lastForecast";
import type { Forecast } from "./forecast";

const FORECAST = {
  unit: "fahrenheit",
  current: null,
  utcOffsetSeconds: 0,
  days: [
    {
      date: "2026-09-26",
      tempMax: 70,
      tempMin: 55,
      precipitationSum: 0,
      precipitationProbabilityMax: 10,
      weatherCode: 1,
      sunrise: "2026-09-26T06:00",
      sunset: "2026-09-26T18:00",
    },
  ],
  hourly: {
    time: [],
    temperature: [],
    dewPoint: [],
    feelsLike: [],
    cloudCover: [],
    precipProbability: [],
    humidity: [],
    pressureInHg: [],
    chanceOfSnow: [],
  },
} satisfies Forecast;

afterEach(() => window.localStorage.clear());

describe("lastForecast", () => {
  it("round-trips a saved forecast per location + unit", () => {
    saveForecast(40.7128, -74.006, "fahrenheit", FORECAST, 1_700_000_000_000);
    const cached = loadForecast(40.7128, -74.006, "fahrenheit");
    expect(cached?.savedAt).toBe(1_700_000_000_000);
    expect(cached?.forecast.days[0].tempMax).toBe(70);
  });

  it("keys separately by unit", () => {
    saveForecast(40.7128, -74.006, "fahrenheit", FORECAST, 1);
    expect(loadForecast(40.7128, -74.006, "celsius")).toBeNull();
  });

  it("returns null for an unknown location", () => {
    expect(loadForecast(1, 2, "fahrenheit")).toBeNull();
  });
});
