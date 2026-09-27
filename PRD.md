# PRD — Mondaugen (codename: *weather*)

**Status:** Draft v0.3 (portfolio-enhancement wave — see DECISIONS.md 2026-09-26)
**Author:** Evan Appel
**Date:** 2026-08-14 (reframed 2026-09-26; enhancements added 2026-09-26)
**Audience:** Primarily personal use (Evan's everyday weather app), shown in the
evanappel.me / enki portfolio. Anyone who wants a clean weather lookup benefits too.

---

## 1. Problem

weatherunderground.com has the two things people actually come for — a good
**10-day forecast** and an interactive **radar/weather map** — buried under
ads, autoplay video, interstitials, and layout that shifts as you read. The
signal is there; the experience is hostile.

**Core insight:** you don't need to rebuild Weather Underground. You need the
two features that matter, rendered fast, ad-free, on any device.

## 2. Vision

**Mondaugen** is a calm, ad-free **personal weather app** — the kind of thing you open each
morning — built around exactly two features and nothing else:

1. A **10-day forecast** for a searched or geolocated place, led by a
   current-conditions hero.
2. An **interactive radar weather map** with an animated precipitation timeline.

No ads, no tracking, no account, no upsell. A **dark, glass-panel UI with a
sky-reactive background** that shifts with the current conditions and day/night.
Fast first paint, works on a phone.

> *Origin note:* this started as an ad-free reproduction of Weather Underground's
> two best features. That framing has been retired (DECISIONS.md 2026-09-26) — the
> two features remain, but the app is now presented as a personal weather app, not
> a WU clone.

## 3. Goals & Non-Goals

### Goals (MVP)
- Look up a location (search by name, or use browser geolocation) and see a
  clean **10-day daily forecast**: high/low temp, conditions icon, precip
  probability, and enough detail to plan a week.
- Show an **interactive map** with an animated **radar/precipitation overlay**
  (past frames + near-term forecast frames) and a play/scrub timeline.
- Be genuinely **ad-free and tracker-free**, fast, and mobile-friendly.
- Deploy on Vercel at **mondaugen.evanappel.me**, auto-deploying on push to main.

### Non-Goals (for now)
- Reproducing *any* other Weather Underground feature: a standalone hourly
  table / HOURLY tab, historical data, Weather Stations / PWS network,
  severe-weather alerts pages, news, webcams, air quality, pollen, "Wundermap"
  layer soup, etc. (Note: hourly data shown as **trend charts within the 10-day
  forecast** is in scope — see FR-4 and DECISIONS.md 2026-08-22. **Current-wind
  streams on the radar map** are in scope — see FR-15 and DECISIONS.md
  2026-09-26. Satellite and temperature layers are still not.)
- **User accounts, server-side sync, or notifications.** (Client-side favorite
  locations in `localStorage` are now in scope — see FR-11 — but there is still
  no account and nothing syncs across devices.)
- Native mobile apps (responsive web + installable PWA only — see NFR-7).
- A custom backend/database — the app stays a thin client over public weather
  APIs. (A Next.js route handler for the dynamic social image (FR-13) is a build
  artifact, not a data backend.)
- Monetization of any kind.

## 4. Target Users & Personas

- **The Planner** — wants the week ahead at a glance to decide about travel,
  chores, an outdoor event. Cares about the 10-day view.
- **The Radar-Watcher** — a storm is coming; wants to *see* the precipitation
  band move and estimate when it hits. Cares about the animated map.

## 5. Key Product Decisions (locked)

| Dimension | Decision |
|---|---|
| Scope | **Two core features**: 10-day forecast + interactive radar map, plus **current-wind streams** on that map (FR-15). The v0.3 enhancements (§6.5) are polish, presentation, and *conveniences around those two* (animated backdrop, local favorites, ⌘K, sunrise/sunset, social image). Hourly tables, alerts, and other map layers (satellite, temperature) stay out. |
| Forecast data | **Open-Meteo** (`api.open-meteo.com`) — free, no API key, global, up to 16-day daily. We display 10. |
| Geocoding | **Open-Meteo Geocoding API** (`geocoding-api.open-meteo.com`) for name → lat/lon search. |
| Radar tiles | **RainViewer** public tile API — free, no key; past + nowcast frames with timestamps. |
| Base map | **MapLibre GL** (open source) with free OSM raster tiles. No Mapbox token. |
| Location input | **Search box + browser geolocation.** No saved-locations backend in MVP. |
| Tech stack | **Next.js (App Router, TypeScript, Tailwind)** — matches the rest of the portfolio. |
| Backend | **None of our own.** Client (or Next.js route handlers as thin proxies) calls public APIs directly. |
| Secrets | **None required** — all chosen data sources are keyless. Keep it that way. |
| Host | **Vercel**, auto-deploy on push to main. Domain `mondaugen.evanappel.me`. |
| Units | Support **°F/°C toggle** (imperial default for a US-facing portfolio); persist choice in `localStorage`. |

> These are locked for MVP so development can start without re-litigating them.
> If a decision needs to change, record why in `DECISIONS.md`.

## 6. Functional Requirements

### 6.1 Location selection
- **FR-1** Search a place by name; show a small results list; selecting one sets
  the active location (lat/lon + display name) via Open-Meteo geocoding.
- **FR-2** "Use my location" button requests browser geolocation and sets the
  active location. Degrade gracefully if denied/unavailable.
- **FR-3** Active location persists across reloads (`localStorage`), so the app
  reopens where you left off. A sensible default (e.g. a major city) is shown on
  first visit before any selection.

### 6.2 10-day forecast
- **FR-4** For the active location, fetch and render a **10-day** daily forecast
  from Open-Meteo: a row of day cards (day label, weather-condition icon mapped
  from WMO weather code, high/low temperature, precipitation amount) plus two
  **hourly trend charts** under the cards, matching the Weather Underground
  10-day view: (a) Temperature / Dew Point / Feels Like, and (b) Cloud Cover /
  Chance of Precip / Chance of Snow / Humidity / Pressure. See DECISIONS.md
  (2026-08-22) for the scope call and data notes.
- **FR-5** Temperature unit toggle (°F/°C) updates the whole view and persists.
- **FR-6** Loading and error states are explicit (no silent blank cards). Do not
  swallow API errors — surface a readable message.

### 6.3 Interactive radar map
- **FR-7** Render a MapLibre map centered on the active location.
- **FR-8** Overlay RainViewer radar tiles as an animated layer: fetch the frame
  index, show a **timeline with play/pause and scrub**, and label each frame's
  timestamp (past → nowcast).
- **FR-9** Map and forecast stay in sync with the active location — changing the
  location recenters the map and refetches the forecast.
- **FR-15** The map can show **current 10 m wind as animated streams** over the
  visible area, from the same keyless Open-Meteo forecast (no new provider). A
  control selects **Radar**, **Wind**, or **Both** (default, so the streams are
  visible without an extra click). Wind does not
  follow the precipitation timeline: Wind mode hides the timeline, and Both
  dims the radar and notes that the scrubber moves precipitation only. Motion
  stops under `prefers-reduced-motion` and draws static arrows instead. A wind
  fetch failure is a readable error and does not take down the radar.

### 6.4 Non-functional
- **NFR-1** Ad-free and tracker-free. No third-party ad/analytics scripts.
- **NFR-2** Mobile-first responsive; usable one-handed on a phone.
- **NFR-3** Fast first contentful paint; lazy-load the map library so the
  forecast is interactive before the (heavier) map bundle loads.
- **NFR-4** Attribute data sources in the UI footer (Open-Meteo, RainViewer,
  OpenStreetMap) per their terms.

### 6.5 Portfolio enhancements (v0.3)

These sharpen the app as a portfolio piece. They keep the two core features,
the keyless data sources, and the ad-free/tracker-free stance. Grouped to match
the five ideas agreed on 2026-09-26.

**Idea 1 — Animated atmosphere (visual only, in scope).**
- **FR-10** The sky-reactive backdrop **animates**: it **crossfades** between sky
  states instead of hard-snapping (two stacked gradient layers, opacity fade),
  and renders **condition-appropriate ambient motion** — drifting clouds, rain
  streaks, a night starfield, falling snow, and a sun/glow that leans toward the
  horizon near sunset. All motion is **gated behind `prefers-reduced-motion`**,
  which falls back to the current static gradient. Implemented with CSS/canvas —
  no new runtime data source.

**Idea 2 — Dynamic social preview (Vercel-native).**
- **FR-13** A dynamic **Open Graph image** endpoint (`@vercel/og` / a Next.js
  route) renders a live weather card — place name, current temperature,
  condition, and the matching sky palette — so a shared link unfurls into a
  branded card. Wire the `<meta>` tags so it is picked up by social/chat unfurls.

**Idea 3 — Presentation & story.**
- **FR-14** An in-app **"How it's built" / colophon** panel (or route) explains
  the keyless architecture, the three data sources, and the ad-free/tracker-free
  stance, and links the decision log. (The repo README case study is a
  presentation artifact tracked in TASKS, not an app requirement.)

**Idea 5 — Product depth (scope expansion, agreed 2026-09-26).**
- **FR-11** **Command palette + favorite locations.** `⌘K` / `Ctrl-K` opens a
  palette to search and switch locations; users can **save/favorite** locations,
  persisted in `localStorage` (no account, no server sync). Favorites and the
  active location rehydrate on load.
- **FR-12** **Sunrise / sunset.** Show sunrise and sunset times for the active
  location and a **day-progress arc**, using Open-Meteo's keyless daily
  `sunrise`/`sunset` fields. The arc labels both times and counts down to the
  next one. **At night** it also shows the **moon phase** (name and how much of
  the disc is lit), computed from the date — no extra API. The lit side follows
  the hemisphere of the active location. Pairs with the animated sky (FR-10).
- **FR-16** **Tonight's sky.** Under the sun arc, three short facts and nothing
  else: the **next major meteor shower** peak (and whether a bright moon or,
  when the peak is inside the forecast, clouds will spoil it), the **naked-eye
  planets** above the horizon in darkness (Mercury through Saturn, with
  direction), and the **next eclipse visible from the active location** (the
  earlier of the next partial-or-total lunar eclipse with the moon up, and the
  next solar eclipse visible there). Computed in the browser with Astronomy
  Engine plus a fixed shower calendar. No new weather API, no key. Not a sky
  chart, and not comets, satellites, or minor showers.

> *Idea 4 (quality proof) is non-functional — see NFR-5..NFR-8.*

### 6.6 Non-functional (v0.3)
- **NFR-5** **Accessibility.** Full keyboard navigation, visible focus states,
  screen-reader labels on controls, and **WCAG AA contrast** verified on the dark
  glass theme.
- **NFR-6** **Performance proof.** Target ~100 Lighthouse mobile; keep heavy
  bundles (map, charts) lazy-loaded; document the result.
- **NFR-7** **Installable PWA + offline.** Installable (manifest + service
  worker); cache the **last successful forecast** so the app shows something
  useful offline instead of a blank error.
- **NFR-8** **Test depth + CI.** Keep the unit suite green and add a **Playwright
  E2E smoke** (load → default forecast → switch location → radar renders); run
  test + lint + build in **CI** on every push/PR.

## 7. Out of Scope / Later

Still out (capture in `TASKS.md` "Later", don't build now): a standalone hourly
table / HOURLY tab, severe-weather alerts, historical data, shareable
per-location permalinks (beyond the OG image), additional map layers (satellite,
temperature), and any account/server-side sync of favorites. Wind streams are
in scope (FR-15). Tonight's sky (FR-16) is the meteor peak, bright planets, and
the next eclipse here — not a sky chart, comets, or satellites. Timeline-synced
wind, gusts, and other wind heights are not in scope.

## 8. Success Criteria

- A visitor can, in under ~10 seconds and with zero ads: find their location,
  read a clean 10-day forecast, and watch the radar animate over their area.
- **The first load is memorable** — the animated, condition-accurate sky reads as
  craft, and degrades cleanly under `prefers-reduced-motion`.
- **Reads as senior up close:** keyboard-navigable, AA-contrast, ~100 Lighthouse
  mobile, unit + E2E tests green in CI.
- **Shareable:** pasting the link unfurls into a live weather card (FR-13).
- **Tells a story:** the README case study + in-app colophon make the keyless,
  ad-free, deliberate-tradeoff design legible to a portfolio visitor.
- Deployed and reachable (custom domain `mondaugen.evanappel.me` deferred until
  DNS is set up; served at the Vercel URL until then).
