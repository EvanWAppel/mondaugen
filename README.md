# atmosphere

A calm, **ad-free personal weather app** — the two things a weather site is
actually for, with none of the noise: a clean **10-day forecast** and an
**interactive precipitation radar**. Dark, glass-panel UI over a **sky-reactive
backdrop** that shifts with the current conditions and the time of day.

Part of [Evan Appel's portfolio](https://evanappel.me).

- **Live:** deployed on Vercel _(custom domain `weather.evanappel.me` pending DNS;
  served at the Vercel URL until then)._
- **Spec:** [PRD.md](./PRD.md) · **Decisions:** [DECISIONS.md](./DECISIONS.md) ·
  **Board:** [TASKS.md](./TASKS.md)

<!-- Add a hero screenshot / GIF here once captured:
     ![atmosphere](./docs/hero.png) -->

## Why

Weather sites bury the forecast and the radar under ads, autoplay video, and
shifting layout. atmosphere keeps only those two features and makes them feel
like something you'd open every morning — fast, quiet, and yours.

## Features

- **10-day forecast** — a current-conditions hero (temp, feels-like, humidity,
  wind, rain, sunrise/sunset with a day-progress arc), a glass day-card row, and
  hourly trend charts.
- **Interactive radar** — animated RainViewer precipitation over a MapLibre map,
  with a play/scrub timeline (past → near-term nowcast). Optional current-wind
  streams (Radar / Both / Wind) from the same Open-Meteo forecast.
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
  - [MapLibre GL](https://maplibre.org/) + [OpenStreetMap](https://www.openstreetmap.org/)
    — base map
- **No backend of our own** — a thin client over public APIs. The only server
  route is the dynamic OG image (`opengraph-image.tsx`, via `next/og`).
- **Ad-free & tracker-free** — no third-party ad/analytics scripts, ever.
- Heavy bundles (the map, the uPlot charts) are **lazy-loaded** so the forecast
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
[RainViewer](https://www.rainviewer.com/). Map data ©
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
