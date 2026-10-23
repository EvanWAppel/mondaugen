# PRIMER — Mondaugen (repo `EvanWAppel/mondaugen`, local folder `portfolio/weather`)

## Next session — 2026-10-24 weekend

**Goal.** A calm, ad-free, keyless personal weather app with **exactly two features**:
a 10-day forecast and an interactive radar map. Live at https://mondaugen.evanappel.me (Vercel,
auto-deploys on push to `main`).

**Current state (2026-10-22, `origin/main` @ 896e1d6).** All feature groups in TASKS.md are done
(SETUP, LOC, FC, MAP, ATM, FAV/SUN, OG/DOC, QA-01/03/04/05, WIND, SKY, MAP-CL). Open: **SHIP-03**
(lives in the enki repo) and **QA-02** (Lighthouse score). No open PRs. On default:
`npm run test` passes 26 files and 159 tests, `npm run lint` is clean, and `npm run build` is green. The local
checkout `~/Documents/portfolio/weather` sits on `map-clarity` with a pushed WIP snapshot (6836e0a)
that updates the ROCRLL standing-rules block in AGENTS.md/CLAUDE.md. That change is not on `main`.

**Setup:** `npm ci`. **Check (run all before every PR):** `npm run test && npm run lint && npm run build`.

### Autonomous tasks, in order (one branch + one PR each, off `origin/main`; never merge)

1. **DOC-03: README parity.** README omits features shipped since DOC-02: the NASA GIBS clouds
   toggle (MAP-CL-03), wind streams (WIND), tonight's sky (SKY), and the muted base map. Update Features,
   Architecture (data-source list), and Attribution to match `Footer.tsx`/`Colophon.tsx` and the
   CLAUDE.md data-source list. *Done:* every source credited in the footer is also in the README; no new claims.
   *Test:* `npm run lint` (docs only).
2. **CHORE-01: Sync the standing rules to `main`.** Port the ROCRLL block wording from the WIP commit
   `6836e0a` (`git show 6836e0a -- AGENTS.md CLAUDE.md`) onto main: "remove each worktree…" and
   "affected tests + lint + typecheck at each join; full suite once before final merge". Keep the
   Next.js `nextjs-agent-rules` block intact. *Done:* `git diff origin/map-clarity -- CLAUDE.md AGENTS.md` is empty
   apart from deliberate differences. *Test:* none (docs).
3. **QA-06: Unit tests for untested logic components.** Write the tests first, and keep each one to the
   current behaviour (do not change behaviour to fit a test): `MapLayerToggle` (Radar/Both/Wind
   selection, aria state), `SkyFacts` (a failure renders a readable message and does not throw into
   the forecast; FR-16), `Colophon` (credits every data source; NFR-4), and `WindOverlay`
   (reduced-motion draws static arrows, and a fetch failure surfaces; FR-15). Mock all network calls. *Done:* new
   `*.test.tsx` beside each component, and the suite stays green. *Test:* `npm run test`.
4. **QA-07: Extend the e2e smoke test (runs in CI only).** In `e2e/smoke.spec.ts`, add a deterministic test that
   the map layer toggle (Radar/Both/Wind) and the Clouds toggle render with accessible names. Do not
   depend on live API data. *Done:* `npx playwright test --list` shows the new tests. **Do not run
   Playwright locally** (browser guardrail). The run happens in the PR's CI `e2e` job.
5. **QA-02 (partial): Lighthouse CI job.** Add a `lighthouse` job to `.github/workflows/ci.yml`
   (`npm ci && npm run build`, then `npx @lhci/cli@0.14.x autorun` against `npm run start`) plus a
   `lighthouserc.json` with **warn-level** assertions (performance and accessibility ≥ 0.9) and
   `upload.target = "temporary-public-storage"` *off*. Use `filesystem` and upload the report as an
   artifact, so nothing gets published. Do not add an npm dependency. *Done:* the job exists, the YAML is valid,
   and the PR notes say Evan reads the score in CI. Leave QA-02 `[~]` until he accepts the number.

### House rules (from CLAUDE.md, which wins on any conflict)
- **TDD.** Write the failing test first, then the code. Do not hide or wrap errors (FR-6). The Vitest suite mocks all network calls.
- **Scope guard.** Exactly two features. Check PRD §3 Non-Goals before adding anything, and leave the
  TASKS "Later" list alone.
- **Keyless.** No API keys and no new data providers. Add no ad, analytics or tracker scripts (NFR-1).
  Credit every data source in the footer (NFR-4).
- **Next.js 16.3 differs from your training data.** Read `node_modules/next/dist/docs/` before
  touching App Router APIs.
- Record any change to a locked PRD decision in DECISIONS.md. Write blockers to BLOCKED.md in the canonical format.
- If anything is unclear, stop and write it down in BLOCKED.md rather than guessing.

### Do NOT
- **Merge, push to `main`, or deploy.** Merging *is* deploying here, because Vercel auto-deploys `main`.
  Open PRs only.
- **SHIP-03.** It is enki-repo work and the card copy needs Evan's review (see BLOCKED.md).
- **Hero screenshot/GIF for the README, PWA install or service-worker runtime checks, and visual review of the map or sky.**
  All of these need a browser. Browser automation is off, so ask Evan instead.
- **Run Lighthouse or Playwright locally,** or judge the QA-02 score yourself.
- **Anything in TASKS "Later"** (alerts, hourly tab, permalinks, extra layers, accounts).
- Touch Vercel settings or domains, add keys, read `.env*`, or modify the
  `~/Documents/portfolio/weather` checkout (work in a worktree).
- Encrypted paths: none (no `.gitattributes`).
