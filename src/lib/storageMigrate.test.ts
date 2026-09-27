import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Location } from "./types";
import type { Forecast } from "./forecast";

const PARIS: Location = {
  id: 2988507,
  name: "Paris",
  latitude: 48.85,
  longitude: 2.35,
  country: "France",
};

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

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("legacy weather: storage", () => {
  it("copies the active location forward", async () => {
    localStorage.setItem("weather:active-location", JSON.stringify(PARIS));
    const { readActiveLocation } = await import("./locationStore");
    expect(readActiveLocation().name).toBe("Paris");
    expect(localStorage.getItem("mondaugen:active-location")).toContain("Paris");
    expect(localStorage.getItem("weather:active-location")).toBeNull();
  });

  it("copies favorites forward", async () => {
    localStorage.setItem("weather:favorites", JSON.stringify([PARIS]));
    const { readFavorites } = await import("./favoritesStore");
    expect(readFavorites()[0].name).toBe("Paris");
    expect(localStorage.getItem("mondaugen:favorites")).toContain("Paris");
    expect(localStorage.getItem("weather:favorites")).toBeNull();
  });

  it("copies the temperature unit forward", async () => {
    localStorage.setItem("weather:temperature-unit", "celsius");
    const { useUnit } = await import("./unitStore");
    const { result } = renderHook(() => useUnit());
    expect(result.current[0]).toBe("celsius");
    expect(localStorage.getItem("mondaugen:temperature-unit")).toBe("celsius");
    expect(localStorage.getItem("weather:temperature-unit")).toBeNull();
  });

  it("copies a cached forecast forward", async () => {
    localStorage.setItem(
      "weather:last-forecast:40.713,-74.006:fahrenheit",
      JSON.stringify({ forecast: FORECAST, savedAt: 5 }),
    );
    const { loadForecast } = await import("./lastForecast");
    const cached = loadForecast(40.7128, -74.006, "fahrenheit");
    expect(cached?.savedAt).toBe(5);
    expect(
      localStorage.getItem("mondaugen:last-forecast:40.713,-74.006:fahrenheit"),
    ).toContain("70");
    expect(
      localStorage.getItem("weather:last-forecast:40.713,-74.006:fahrenheit"),
    ).toBeNull();
  });
});
