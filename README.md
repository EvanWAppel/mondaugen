# Mondaugen

A calm, **ad-free personal weather app** — the two things a weather site is
actually for, with none of the noise: a clean **10-day forecast** and an
**interactive precipitation radar**. Dark, glass-panel UI over a **sky-reactive
backdrop** that shifts with the current conditions and the time of day.

Named for Kurt Mondaugen in Thomas Pynchon's *V.*, who listened for a signal
in the sferics — radio noise from the atmosphere.

Part of [Evan Appel's portfolio](https://evanappel.me).

- **Live:** [mondaugen.evanappel.me](https://mondaugen.evanappel.me) (Vercel)
- **Repo:** [EvanWAppel/mondaugen](https://github.com/EvanWAppel/mondaugen)
- **Spec:** [PRD.md](./PRD.md) · **Decisions:** [DECISIONS.md](./DECISIONS.md) ·
  **Board:** [TASKS.md](./TASKS.md)

<!-- Add a hero screenshot / GIF here once captured:
     ![Mondaugen](./docs/hero.png) -->

## Why

Weather sites bury the forecast and the radar under ads, autoplay video, and
shifting layout. Mondaugen keeps only those two features and makes them feel
like something you'd open every morning — fast, quiet, and yours.

## Features

- **10-day forecast** — a current-conditions hero (temp, feels-like, humidity,
  wind, rain, sunrise/sunset with a day-progress arc), a glass day-card row, and
  hourly trend charts.
- **Tonight's sky** — a three-line note under the sun arc: the next major
  meteor-shower peak (with a bright-moon flag, and a cloud note when the peak
  falls inside the forecast), naked-eye planets up after dark, and the next
  eclipse visible from the active location. Computed in the browser with
  Astronomy Engine (lazy-loaded); a failure here leaves the forecast up.
- **Interactive radar** — animated RainViewer precipitation over a muted
  dark-grey OpenStreetMap base (MapLibre), with a play/scrub timeline (past →
  near-term nowcast). Zoom is capped at the radar's maximum.
- **Wind streams** — a Radar / Both / Wind control adds animated current-wind
  particles (10 m, from the same Open-Meteo forecast) with a speed legend. Both
  dims the radar; Wind hides it. No wind request until wind is turned on, and
  reduced motion draws static arrows instead.
- **Clouds toggle** — the latest NASA GIBS GOES-East GeoColor satellite image,
  filtered to clouds in the browser and drawn under the radar, with an "as of"
  caption.
- **Sky-reactive backdrop** — an animated gradient (clear/cloud/rain/snow/storm/
  fog, day vs night) with ambient motion, gated behind `prefers-reduced-motion`.
- **Favorites + ⌘K** — save locations locally and jump between them from a
  command palette. No account, no server sync.
- **Shareable** — a dynamic Open Graph card renders a live weather image for link
  unfurls.

## Architecture

- **Next.js (App Router) + TypeScript + Tailwind**, deployed on **Vercel**.
- **Keyless by design** — every data source is public and free, no secrets:
  - [Open-Meteo](https://open-meteo.com/) — forecast, geocoding, and the wind grid
  - [RainViewer](https://www.rainviewer.com/api.html) — radar tiles
  - [NASA GIBS](https://www.earthdata.nasa.gov/gibs) (NOAA GOES-East GeoColor
    WMTS) — satellite clouds
  - [MapLibre GL](https://maplibre.org/) + [OpenStreetMap](https://www.openstreetmap.org/)
    — base map, drawn muted dark grey
- **Tonight's sky is computed, not fetched** — planets and eclipses come from
  [Astronomy Engine](https://github.com/cosinekitty/astronomy) in the browser;
  meteor showers from a fixed calendar.
- **No backend of our own** — a thin client over public APIs. The only server
  route is the dynamic OG image (`opengraph-image.tsx`, via `next/og`).
- **Ad-free & tracker-free** — no third-party ad/analytics scripts, ever.
- Heavy bundles (the map, the uPlot charts, Astronomy Engine) are **lazy-loaded** so the forecast
  is interactive first.

## Develop

```sh
npm install
npm run dev      # dev server
npm run test     # unit tests (Vitest)
npm run lint     # ESLint
npm run build    # production build + TypeScript check
```

## Deploy

Auto-deploys on push to `main` via Vercel's git integration. No environment
variables required — all data sources are keyless.

## Attribution

Weather data by [Open-Meteo](https://open-meteo.com/). Radar imagery by
[RainViewer](https://www.rainviewer.com/). Satellite clouds from
[NASA GIBS](https://www.earthdata.nasa.gov/gibs) (NOAA GOES-East). Map data ©
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
