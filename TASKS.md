# TASKS — weather

Task board for the ad-free weather app. IDs are stable; check items off as they
land. See [PRD.md](./PRD.md) for the what/why. Work top-to-bottom — later tasks
assume earlier ones.

## SETUP

- [x] **SETUP-01** Scaffold Next.js at the repo root: `create-next-app` with App
  Router, TypeScript, Tailwind, ESLint, `src/`, `@/*` alias. Replace boilerplate
  splash with a minimal placeholder. Lint + production build green.
- [x] **SETUP-02** Wire up the manifest commands so `orch dev/test/lint weather`
  work: `npm run dev`, `npm run test`, `npm run lint`. Add a test runner
  (Vitest) and one smoke test so `npm run test` is real.
- [x] **SETUP-03** Add a footer with data-source attribution placeholders
  (Open-Meteo, RainViewer, OpenStreetMap) — satisfies NFR-4 early.

## LOCATION (FR-1..3)

- [x] **LOC-01** Open-Meteo geocoding client + search box: type a place name,
  show results, select to set active location (lat/lon + label).
- [x] **LOC-02** "Use my location" via `navigator.geolocation`, with graceful
  fallback when denied/unavailable.
- [x] **LOC-03** Persist active location + a first-visit default in
  `localStorage`; rehydrate on load.

## FORECAST (FR-4..6)

- [x] **FC-01** Open-Meteo forecast client: request 10 daily days
  (`forecast_days=10`) with temp max/min, precipitation probability, weather
  code. Typed response, explicit error surfacing (no swallowing).
- [x] **FC-02** WMO weather-code → icon + label mapping.
- [x] **FC-03** 10-day forecast UI: one card/row per day (day label, icon,
  high/low, precip %). Responsive.
- [x] **FC-04** °F/°C unit toggle that updates the view and persists to
  `localStorage`.
- [x] **FC-05** Loading + error states for the forecast panel.
- [x] **FC-06** WU-style 10-day redesign: restyled day-card row + two hourly
  trend charts (Temp/Dew Point/Feels Like; Cloud/Precip/Snow/Humidity/Pressure)
  via lazy-loaded uPlot. Scope expansion logged in [DECISIONS.md](./DECISIONS.md).

## RADAR MAP (FR-7..9)

- [x] **MAP-01** Add MapLibre GL; render a map centered on the active location
  with free OSM raster tiles. Lazy-load the map bundle (NFR-3).
- [x] **MAP-02** RainViewer frame-index client (past + nowcast frames with
  timestamps).
- [x] **MAP-03** Radar tile overlay layer driven by the selected frame.
- [x] **MAP-04** Timeline control: play/pause + scrub, with per-frame timestamp
  labels.
- [x] **MAP-05** Keep map + forecast in sync with the active location (recenter +
  refetch on change).

## SHIP

- [x] **SHIP-01** Verify ad-free/tracker-free: no third-party ad/analytics
  requests in the network tab (NFR-1). Basic Lighthouse mobile pass.
- [x] **SHIP-02** Connect the GitHub repo to Vercel; confirm auto-deploy on push
  to main; attach `weather.evanappel.me`. (Repo `EvanWAppel/weather` linked to
  Vercel project `weather`, prod branch `main`; auto-deploy on push to `main`
  verified from a git-triggered production build. Live at
  https://weather-iota-murex.vercel.app. Custom domain `weather.evanappel.me` is
  added to the project but **deferred** — it still needs a `weather` DNS record
  at Wix (`CNAME weather → cname.vercel-dns.com`), so we use the vercel.app URL
  for now.)
- [ ] **SHIP-03** Flip `status` to `"live"` in the portfolio `projects.toml` and
  update the portfolio README table row. (Edits staged in the enki repo
  2026-09-26 — status→live + personal-app description; commit pending review.
  Custom domain `weather.evanappel.me` deferred until DNS is set up.)

## v0.3 Portfolio enhancements (see PRD §6.5/§6.6, DECISIONS 2026-09-26)

Five ideas agreed 2026-09-26. Build order starts with ATMOSPHERE (most
self-contained, highest visual return). Each group is largely independent.

### ATMOSPHERE — animated sky (Idea 1 · FR-10)

- [x] **ATM-01** Crossfade between sky states instead of hard-snapping: two
  stacked gradient layers, fade opacity on change. Drive from the same
  `weatherSky` category already reported up to `WeatherApp`. (Done — new
  `SkyBackdrop` component stacks a layer per state, fades the newest in via a
  `skyIn` CSS animation, and prunes occluded layers on `animationend`.)
- [x] **ATM-02** Condition-appropriate ambient motion: drifting clouds, rain
  streaks, night starfield, falling snow, sun/glow leaning toward the horizon.
  CSS and/or a lightweight canvas layer — no new runtime data source. (Done —
  pure-CSS `.fx-*` effects per sky, incl. storm lightning + fog drift. No canvas,
  no JS loop.)
- [x] **ATM-03** Gate **all** motion behind `prefers-reduced-motion` (static
  gradient fallback = today's behavior). Keep it off the critical render path so
  FCP/NFR-3 is unaffected. (Done — reduced-motion collapses to a single static
  layer and the global reduced-motion rule freezes every effect; effects are
  CSS-only so they're off the JS critical path. Lighthouse cross-check tracked
  under QA-02.)

### PRODUCT — favorites, command palette, sun times (Idea 5 · FR-11, FR-12)

- [x] **FAV-01** Favorites store: save/remove favorite locations in
  `localStorage` (no account, no sync). (Done — `favoritesStore.ts` keyed on
  rounded coords; `useFavorites`/`toggle`/`add`/`remove`; save-star in the hero +
  favorite chips under the top bar.)
- [x] **FAV-02** `⌘K` / `Ctrl-K` command palette to search + switch locations and
  jump to favorites; wraps the existing geocoding search. Keyboard-first. (Done —
  `CommandPalette.tsx`: ⌘K toggles, arrow/Enter/Esc keys, star to favorite,
  mounts fresh per open.)
- [x] **SUN-01** Request Open-Meteo daily `sunrise`/`sunset` (keyless); type +
  parse + test. (Done — added to the forecast request/type + `utc_offset_seconds`;
  `sun.ts` helpers with tests.)
- [x] **SUN-02** Sunrise/sunset display + day-progress arc in the hero; pairs
  with the animated sky. (Done — `SunArc` semicircle with the sun placed by
  location-local daylight progress, refreshed each minute.)

### SHARE — social image + story (Ideas 2 & 3 · FR-13, FR-14)

- [x] **OG-01** Dynamic OG image route: live card with place, current temp,
  condition, matching sky palette. Wire `<meta>` tags for unfurls. (Done —
  `src/app/opengraph-image.tsx` via built-in `next/og` (no dep); fetches live
  conditions with a branded fallback; `metadataBase` + OG/Twitter meta in layout;
  verified rendering a 1200×630 PNG.)
- [x] **DOC-01** In-app "How it's built" / colophon panel: keyless architecture,
  three data sources, ad-free/tracker-free stance. (Done — `Colophon.tsx` modal
  from the footer. Note: decision log not linked — repo is private.)
- [x] **DOC-02** Portfolio-grade repo README: "why", features, architecture,
  keyless data sources, develop/deploy. (Done — rewrote README to the personal-app
  framing; hero-image slot left as a comment until a screenshot is captured.)

### QUALITY — proof it's senior (Idea 4 · NFR-5..NFR-8)

- [ ] **QA-01** Accessibility pass: keyboard nav, visible focus, SR labels, verify
  **WCAG AA contrast** on the dark glass theme.
- [ ] **QA-02** Performance proof: confirm ~100 Lighthouse mobile; keep map/charts
  lazy; document the result.
- [ ] **QA-03** Playwright E2E smoke: load → default forecast → switch location →
  radar renders.
- [ ] **QA-04** CI: run `test` + `lint` + `build` on every push/PR (GitHub
  Actions); optional status badge in the README.
- [ ] **QA-05** PWA: manifest + service worker (installable) and cache the last
  successful forecast for an offline view (NFR-7).

## Later (out of scope — see PRD §7)

- [ ] Standalone hourly forecast table / HOURLY tab.
- [ ] Severe-weather alerts.
- [ ] Historical data; shareable per-location permalinks (beyond the OG image).
- [ ] Extra map layers (satellite, temperature, wind).
- [ ] Any account / cross-device sync of favorites.
