# CLAUDE.md — weather

Guidance for AI assistants working in this repo. Read [PRD.md](./PRD.md) and
[TASKS.md](./TASKS.md) first; they are the source of truth for scope.

## What this is

An **ad-free** reproduction of **exactly two** Weather Underground features:
the **10-day forecast** and the **interactive radar weather map**. Nothing else.
When tempted to add a feature, check PRD §3 Non-Goals first — the answer is
almost certainly "no, that's out of scope."

## Stack & conventions

- **Next.js** (App Router) + **TypeScript** + **Tailwind**, app at the repo root.
- Package manager: **npm** (matches the portfolio manifest for this project).
- Scripts: `npm run dev`, `npm run test`, `npm run lint` — keep these working;
  the portfolio `orch` CLI drives the project through them.
- Deploy: **Vercel**, auto-deploy on push to `main`. Do **not** push to `main`
  directly for feature work — branch, open a PR.

## Data sources (all keyless — keep it that way)

- **Forecast and wind grid:** Open-Meteo — `https://api.open-meteo.com/v1/forecast`
  (wind streams sample `wind_speed_10m` / `wind_direction_10m` over the visible map)
- **Geocoding:** Open-Meteo — `https://geocoding-api.open-meteo.com/v1/search`
- **Radar tiles + frame index:** RainViewer — `https://api.rainviewer.com/`
- **Satellite clouds:** NASA GIBS — GOES-East GeoColor WMTS, `https://gibs.earthdata.nasa.gov/` (filtered to clouds in the browser)
- **Base map:** MapLibre GL + OpenStreetMap raster tiles, drawn muted dark grey.

No API keys or secrets should be required. If you think you need one, stop and
ask — it likely means the wrong provider is being reached for.

## Rules

- Don't do anything you're unclear about — ask.
- **Do not hide or wrap errors.** Surface API failures with readable messages
  (see FR-6); no silent blank states.
- Ad-free and tracker-free is a hard requirement (NFR-1): no third-party
  ad/analytics scripts, ever.
- Attribute data sources in the UI footer (NFR-4).
- Record any change to a locked PRD decision in `DECISIONS.md` with the reason.

<!-- factotum:recl-standing-rules -->
**ROCRLL** — this project follows Requirements → Orchestrate → Check → Review → Loop → Ledger.

- **Requirements.** Draft/keep a `PRD.md` via interview — walk every branch, don't guess.
  The interview also produces the `TASKS.md` grouping and seeds the Ledger.
- **Orchestrate.** Default is linear. Fan out to subagents **only when a task group has ≥3
  genuinely independent tasks**; give each its **own git worktree**, merge back one at a
  time, and remove each worktree and its branch once merged or abandoned.
  **Precondition:** the project must be its own standalone git repo. Worktrees are for
  overlapping-file work — disjoint-file fan-out may use lighter same-tree partitioning.
  **Agents are hands, you're the head:** subagents write code in their worktrees; they never
  inspect raw data or make design/verdict calls — those escalate to the orchestrator.
- **Check.** TDD, test-first. **The human inspects the data; the agent never sees raw data.**
  Run Check **centrally at the orchestrator** at each merge join, not inside each worktree:
  **affected tests + lint + typecheck at each join; the full suite once, before the group's
  final merge to main.**
- **Review.** Independent adversarial review on **every merge to the main line**. Default
  reviewer: a fresh-context same-model subagent; escalate cross-model for high-stakes/security.
  **High-severity findings block, but the human adjudicates them against the primary source** —
  reviewers over-call; never auto-action a finding. Everything below high is advisory.
- **Loop.** Iterate.
- **Ledger.** Record every **decision with a real trade-off** (chose X, rejected Y, why) in a
  `DECISIONS.md` append log. The agent drafts the entry; the human confirms it.

**Guardrails (always on):** TDD-first · nothing external sent/merged/published/deployed
without explicit human approval · the agent never sees raw data · **no autonomous
(Ralph-style) self-feeding loops** · **prime directive — if anything is unclear, stop and ask.**

**Standard artifacts:** `PRD.md` · `TASKS.md` (parallel groups marked) ·
`AGENTS.md`/`CLAUDE.md` · `DECISIONS.md` · `BLOCKED.md`.

<!-- /factotum:recl-standing-rules -->

<!-- factotum:blocked-protocol -->
**Blockers → `BLOCKED.md` (system standard).** Anything only Evan can resolve — a credential, a deploy, external access, or a decision — goes in a root `BLOCKED.md`: one `- [ ]` per blocker, prefixed 🔴 blocking / 🟡 nice-to-have, **each with the specific steps a human takes to unblock it** (the action, where, any URL / path / env-var). _system's blocked-router scans every `BLOCKED.md` under `~/Documents` and mirrors open items into Evan's todo dashboard, so nothing waits on him invisibly. Keep the file even when nothing is blocked — heading plus "nothing blocked right now" and zero `- [ ]` lines. Full rule: Evan's global `~/.claude/CLAUDE.md`.
<!-- /factotum:blocked-protocol -->
