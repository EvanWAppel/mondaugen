# DECISIONS — weather

Record here any change to a locked PRD decision, with the reason (per CLAUDE.md).

## 2026-09-26 — Moon phase on the night side of the sun arc

**Decision:** The sun arc labels sunrise and sunset and counts down to whichever
comes next. At night it also shows the moon phase (name and percent lit).

**Why:** The times were on the diagram without saying what they were, and the
night state was only a dim dot. Phase is what you actually want after dark.

**Data:** Sunrise and sunset stay on the existing Open-Meteo daily fields. The
moon phase is computed from the date (synodic month from the 2000-01-06 new
moon). No new provider, no key. The lit side flips south of the equator.

## 2026-09-26 — Wind streams on the radar map

**Decision:** The radar map can show **current 10 m wind as animated particle
streams** (FR-15). A control selects Radar (default), Wind, or Both. Wind is
"now" only — it does not follow the precipitation scrubber.

**Why:** Requested feature. Streams are the readable form of wind on a map
(where it is going, not a table of degrees). Keeping it on the existing map,
off by default, doesn't add a third product surface.

**Locked decisions changed:** PRD §7 and the v0.3 decision listed "extra map
layers (satellite, temperature, wind)" as out. **Wind streams are now in.**
Satellite and temperature layers stay out.

**Data:** Same keyless Open-Meteo `/v1/forecast` call, sampled on a lattice
over the visible map (`current=wind_speed_10m,wind_direction_10m`, m/s). No
new provider, no secret. Rejected: `@openmeteo/weather-map-layer` (colored
raster + arrows, not streams; GPL-2.0; wants cross-origin isolation headers
that fight the OSM tiles) and a NOAA GRIB decode (a proxy, not a thin client).

**Still out:** timeline-synced wind, gusts, wind above 10 m, persisting the
layer choice, satellite, temperature.

**Follow-up the same day:** the control was a light label drawn on top of the
light street map, and Radar was the default, so the streams were easy to miss
entirely. The control now sits in the dark toolbar above the map, trails use
a dark halo and a blue-to-orange scale, and **Both** is the default.

## 2026-09-26 — Portfolio-enhancement wave (v0.3): expand scope for polish + product depth

**Decision:** Add a wave of enhancements to sharpen the app as a portfolio piece
(PRD §6.5/§6.6, FR-10..FR-14, NFR-5..NFR-8), grouped as five ideas: (1) animated
atmosphere, (2) dynamic social image, (3) presentation/colophon + README case
study, (4) quality proof (a11y, Lighthouse, E2E, CI), (5) product depth
(⌘K command palette + favorite locations, sunrise/sunset arc, installable PWA +
offline last-forecast).

**Why:** The redesign gives the "wow on load"; a portfolio piece also has to read
as senior craft up close and tell a story about how the author thinks. These do
that while staying true to the app's ethos.

**Locked decisions changed — these were previously out and are now IN scope:**
- **Favorite locations** in `localStorage`. Former Non-Goal was "saved locations
  sync"; the distinction kept: **local favorites yes, accounts / server-side sync
  no.** ⌘K command palette rides on the same store (FR-11).
- **PWA / offline** (NFR-7) and **saved multi-location** — were under §7 "Later".
- A **Next.js route for the OG image** (FR-13). Reconciled against the "no
  backend/database" decision: this is a build/render artifact, **not** a data
  backend — the app still fetches weather straight from the public keyless APIs.

**Still out (unchanged at the time; wind streams were added later the same day):**
standalone hourly table/tab, severe-weather alerts, historical data, extra map
layers, per-location shareable permalinks, and any account or cross-device sync
of favorites. See the wind-streams entry above — satellite and temperature
layers stay out.

**Data:** All new data (sunrise/sunset) comes from the existing keyless Open-Meteo
`/v1/forecast` daily block. No new provider, no secret. The keyless/ad-free/
tracker-free guarantees (NFR-1) are unchanged.

**Build order:** Start with idea 1 (animated atmosphere) — most self-contained,
highest visual return, purely visual.

## 2026-09-26 — Reframe as a personal weather app; dark-glass sky-reactive UI

**Decision:** The product is no longer framed as an *ad-free Weather Underground
reproduction for portfolio visitors*. It is now a **personal weather app** (still
shown in the evanappel.me / enki portfolio) with the same **exactly two
features** — 10-day forecast + interactive radar. The UI was redesigned from the
editorial/"newspaper" showpiece (masthead, "ALWAYS AD-FREE" badge, "EST. 2026",
decorative sun-art) to a **dark, glass-panel aesthetic with a sky-reactive
background** that shifts with current conditions and day/night.

**Why:** Requested pivot — the app should feel like something you open every
morning for yourself, not a demo that advertises "look, no ads." The WU-clone
framing was baggage; the two features are the value.

**Scope guard held:** This is a **visual redesign only**. No new user-facing
features, no accounts, no saved locations, no backend — §3 Non-Goals still apply.

**Data note (minor, same provider):** The Open-Meteo `/v1/forecast` call now also
requests the **`current` block** (`temperature_2m, apparent_temperature,
relative_humidity_2m, weather_code, is_day, wind_speed_10m`) plus a
`wind_speed_unit` matched to the temperature unit. This feeds the current-
conditions hero and the day/night sky tone. Still **keyless Open-Meteo** — no new
provider, no secret. `current` is parsed defensively (null when absent, UI falls
back to today's daily summary).

## 2026-08-22 — Add hourly trend charts to the 10-day forecast

**Decision:** The 10-day forecast now includes two trend charts under the day
cards, matching Weather Underground's 10-day view:

1. **Temperature / Dew Point / Feels Like** (hourly, over the 10-day window).
2. **Cloud Cover / Chance of Precip / Chance of Snow / Humidity / Pressure**
   (hourly; pressure on a second axis in inHg).

**Why:** Requested feature change — the forecast should look like WU's 10-day
tab (screenshot), which carries these charts.

**PRD tension resolved:** The charts consume **hourly** data, and §3 lists
"hourly tables" as a non-goal and §7 lists "Hourly forecast detail" under Later.
The distinction we're keeping: hourly data rendered as **trend charts inside the
10-day forecast is in scope**; a standalone **hourly table / HOURLY tab remains
out of scope**. FR-4 and §3 updated to say so.

**Data:** All fields come from the existing keyless Open-Meteo `/v1/forecast`
call, now also requesting `hourly=temperature_2m,dew_point_2m,
apparent_temperature,cloud_cover,precipitation_probability,relative_humidity_2m,
pressure_msl,snowfall`. No new provider, no key.

**Notes / approximations:**
- Open-Meteo has **no snow-probability field**; "Chance of Snow" is derived —
  the precip probability on hours where snowfall is expected, else 0.
- Pressure uses `pressure_msl` (sea-level) converted hPa → inHg, to match WU's
  ~29.6–29.9 inHg range rather than station pressure.

**Implementation:** Charts render with **uPlot**, lazy-loaded (dynamic import,
`ssr:false`) so it stays out of the initial bundle (NFR-3).
