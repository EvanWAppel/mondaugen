import { ImageResponse } from "next/og";
import { fetchForecast } from "@/lib/forecast";
import { describeWeatherCode, weatherSky, type Sky } from "@/lib/weatherCodes";

// The card renders a representative location. Inlined (not imported from
// locationStore) so this Server Component doesn't pull in a client-only hook.
const CARD_LOCATION = {
  name: "New York",
  latitude: 40.7128,
  longitude: -74.006,
};

export const alt = "Mondaugen — a calm, ad-free weather app";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Cache the generated card; refresh at most every 30 minutes.
export const revalidate = 1800;

// Sky gradients mirroring the app's backdrop (globals.css).
const SKY: Record<Sky, [string, string]> = {
  "clear-day": ["#2f74bd", "#0e2649"],
  "clear-night": ["#0b1a3a", "#05070f"],
  "cloudy-day": ["#4b5d70", "#161d27"],
  "cloudy-night": ["#1d2632", "#0a0e13"],
  rain: ["#2c3c4b", "#0e161e"],
  snow: ["#4d5d6d", "#161c24"],
  storm: ["#2b2742", "#0b0a14"],
  fog: ["#3c434c", "#141820"],
};

/**
 * Dynamic social card (FR-13): a live weather card for the canonical URL. Fetches
 * the default location's current conditions and renders place + temp + condition
 * over the matching sky gradient, degrading to a branded card on any failure.
 */
export default async function OpengraphImage() {
  let temp: number | null = null;
  let condition = "10-day forecast & live radar";
  let sky: Sky = "clear-night";
  const place = CARD_LOCATION.name;

  try {
    const f = await fetchForecast(CARD_LOCATION, { unit: "fahrenheit" });
    if (f.current) {
      temp = Math.round(f.current.temperature);
      condition = describeWeatherCode(f.current.weatherCode).label;
      sky = weatherSky(f.current.weatherCode, f.current.isDay);
    } else if (f.days[0]) {
      temp = Math.round(f.days[0].tempMax);
      condition = describeWeatherCode(f.days[0].weatherCode).label;
      sky = weatherSky(f.days[0].weatherCode, true);
    }
  } catch {
    // Keep the branded fallback above.
  }

  const [from, to] = SKY[sky];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: `linear-gradient(160deg, ${from}, ${to})`,
          color: "#f2f6fc",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 30,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ color: "#ffb454", fontSize: 34 }}>☀</span>
            <span style={{ fontWeight: 600, letterSpacing: -0.5 }}>
              Mondaugen
            </span>
          </div>
          <div
            style={{
              fontSize: 18,
              letterSpacing: 2,
              opacity: 0.7,
              textTransform: "uppercase",
            }}
          >
            Ad-free · No trackers
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <span style={{ fontSize: 220, fontWeight: 300, lineHeight: 1 }}>
              {temp == null ? "—" : temp}
            </span>
            <span style={{ fontSize: 96, fontWeight: 300, opacity: 0.7 }}>
              °
            </span>
          </div>
          <div style={{ display: "flex", fontSize: 40, opacity: 0.92 }}>
            {condition} · {place}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 26, opacity: 0.72 }}>
          A calm personal weather app — 10-day forecast &amp; live radar.
        </div>
      </div>
    ),
    size,
  );
}
