import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ForecastPanel from "./ForecastPanel";
import type { Forecast } from "@/lib/forecast";
import type { Location } from "@/lib/types";

const fetchForecast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/forecast", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/forecast")>();
  return { ...actual, fetchForecast };
});

// Stub the lazy chart so the panel test doesn't pull in uPlot/canvas under jsdom.
vi.mock("./ForecastCharts", () => ({
  default: () => <div data-testid="forecast-charts" />,
}));

const NYC: Location = {
  id: 1,
  name: "New York",
  latitude: 40.71,
  longitude: -74.01,
};

const hours = Array.from({ length: 24 }, (_, i) => i);
const FORECAST: Forecast = {
  unit: "fahrenheit",
  current: {
    temperature: 72,
    feelsLike: 74,
    humidity: 45,
    weatherCode: 0,
    isDay: true,
    windSpeed: 6,
  },
  utcOffsetSeconds: -14400,
  days: Array.from({ length: 10 }, (_, i) => ({
    date: `2026-08-${String(16 + i).padStart(2, "0")}`,
    tempMax: 80 + i,
    tempMin: 60 + i,
    precipitationSum: 0,
    precipitationProbabilityMax: i * 5,
    weatherCode: 0,
    sunrise: `2026-08-${String(16 + i).padStart(2, "0")}T06:00`,
    sunset: `2026-08-${String(16 + i).padStart(2, "0")}T18:00`,
  })),
  hourly: {
    time: hours.map((i) => `2026-08-16T${String(i).padStart(2, "0")}:00`),
    temperature: hours.map(() => 75),
    dewPoint: hours.map(() => 50),
    feelsLike: hours.map(() => 77),
    cloudCover: hours.map(() => 20),
    precipProbability: hours.map(() => 10),
    humidity: hours.map(() => 40),
    pressureInHg: hours.map(() => 29.9),
    chanceOfSnow: hours.map(() => 0),
  },
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("ForecastPanel", () => {
  it("renders 10 day cards once the forecast loads", async () => {
    fetchForecast.mockResolvedValue(FORECAST);
    render(<ForecastPanel location={NYC} unit="fahrenheit" />);

    await screen.findByText("10-day forecast");
    // One selectable card button per day (each labelled "…high…low…").
    expect(screen.getAllByRole("button", { name: /high .* low/i })).toHaveLength(
      10,
    );
    // Cards carry a weekday + month/day label (WU-style columns).
    expect(screen.getByText(/8\/16/)).toBeInTheDocument();
  });

  it("renders the trend charts alongside the cards", async () => {
    fetchForecast.mockResolvedValue(FORECAST);
    render(<ForecastPanel location={NYC} unit="fahrenheit" />);

    expect(await screen.findByTestId("forecast-charts")).toBeInTheDocument();
  });

  it("surfaces an error instead of a blank panel", async () => {
    fetchForecast.mockRejectedValue(new Error("Forecast request failed"));
    render(<ForecastPanel location={NYC} unit="fahrenheit" />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Forecast request failed/,
      ),
    );
  });

  it("refetches when the active location changes (MAP-05)", async () => {
    fetchForecast.mockResolvedValue(FORECAST);
    const { rerender } = render(
      <ForecastPanel location={NYC} unit="fahrenheit" />,
    );
    await screen.findByText("10-day forecast");

    const paris: Location = {
      id: 2,
      name: "Paris",
      latitude: 48.85,
      longitude: 2.35,
    };
    rerender(<ForecastPanel location={paris} unit="fahrenheit" />);

    await waitFor(() =>
      expect(fetchForecast).toHaveBeenCalledWith(
        { latitude: 48.85, longitude: 2.35 },
        expect.objectContaining({ unit: "fahrenheit" }),
      ),
    );
  });
});
