# PRIMER — Mondaugen (repo `EvanWAppel/mondaugen`, local folder `portfolio/weather`)

## Next session — 2026-10-24 weekend

**Goal.** A calm, ad-free, keyless personal weather app with **exactly two features**:
a 10-day forecast and an interactive radar map. Live at https://mondaugen.evanappel.me (Vercel,
auto-deploys on push to `main`).

**Current state (2026-10-23, `origin/main` @ 728f22d).** All feature groups in TASKS.md are done
(SETUP, LOC, FC, MAP, ATM, FAV/SUN, OG/DOC, QA-01/03/04/05/06/07, WIND, SKY, MAP-CL, DOC-03, CHORE-01).
PR #22 (weekend 2026-10-24) landed every autonomous task below; PR #23 synced the blocker protocol.
Open: **SHIP-03** (lives in the enki repo, see BLOCKED.md) and **QA-02** (`[~]`: the Lighthouse CI
job exists; it stays open until Evan reads the CI score and accepts it). No open PRs. On default
(measured 2026-10-24): `npm run test` passes 31 files and 182 tests and `npm run lint` is clean;
`npm run build` was not re-run here, but main's CI is green on the last three merges. The ROCRLL
wording from the old `map-clarity` WIP snapshot (6836e0a) is now on `main` (CHORE-01, #22).

**Setup:** `npm ci`. **Check (run all before every PR):** `npm run test && npm run lint && npm run build`.

### Autonomous tasks

**None queued.** All five tasks from the weekend list merged in PR #22:
1. ~~DOC-03: README parity~~ (#22).
2. ~~CHORE-01: sync the ROCRLL standing rules to `main`~~ (#22).
3. ~~QA-06: unit tests for `MapLayerToggle`, `SkyFacts`, `Colophon`, `WindOverlay`~~ (#22).
4. ~~QA-07: e2e checks for the map layer and Clouds toggles~~ (#22; runs in CI only).
5. ~~QA-02 (partial): Lighthouse CI job + `lighthouserc.json`~~ (#22). QA-02 itself stays `[~]`
   until Evan accepts the score.

What's left is Evan's: SHIP-03 (enki card copy, BLOCKED.md) and accepting the QA-02 score. The
TASKS "Later" list is out of scope. Check `BLOCKED.md` and `TASKS.md` before starting anything new.

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
