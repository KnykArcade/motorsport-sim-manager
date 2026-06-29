---
name: testing-season-loop
description: Test the playable season loop (new game → race weekend → qualifying → race → results → standings → save) end-to-end for Motorsport History Manager. Use when verifying sim, weekend-flow, standings, or save changes.
---

# Testing the playable season loop

Backend-less Vite + React SPA. No auth, no secrets, no external services. Everything runs locally.

## Run it
- `npm install` then `npm run preview` serves the production build at `http://localhost:4173/`
  (use `npm run dev` for the dev server). Lint/typecheck/build: `npm run lint`, `npm run typecheck`, `npm run build`.
- Save lives in `localStorage` under `msm:save:v1`. To start from a clean "no save" state, clear it
  (Settings in-app has a delete, or `localStorage.removeItem('msm:save:v1')` then reload).

## Key behavior to know (for designing assertions)
- **Seed is time-based per new game** (`src/game/initialCareer.ts`: `${teamId}-${Date.now()}`), so exact
  finishing order is NOT reproducible across separate new games. Assert structural invariants, not driver names:
  - Qualifying grid: 24 cars, P1 gap = `POLE`, gaps non-decreasing down the order.
  - Race points follow the season's points table (1995 = 10-6-4-3-2-1 for P1–P6, 0 for P7+; see Data Viewer → Points).
  - Each race row's **Grid** column must equal that driver's qualifying position (proves state threads through).
  - DNFs sit at the bottom with `—` position, no points, `DNF (lap N)`, and a cause in the Race Event Log.
  - Constructor points == sum of its two drivers' points.
- **Separated decisions** are a core requirement: qualifying setup + run plan are chosen BEFORE simulating
  qualifying; race setup + strategy + instructions only become reachable AFTER. To test the gate, on the
  Track Briefing step click a later stepper item like "5. Race Setup" — it must NOT navigate.
- Results aren't scripted to history (alternate history) — a pole-sitter retiring / a non-historical winner
  is expected, not a bug.

## UI path (Brazilian GP, Round 1)
Main Menu → New Game → Single Season (default) → Continue → (Series & Year default 1995 F1) → Select Team →
click a team card (e.g. Benetton) → Start Season → Team HQ. From HQ: "Go to Next Race" → 7-phase weekend:
Track Briefing → Qualifying Setup → Qualifying Run Plan → **Simulate Qualifying** → Qualifying Review →
Choose Race Strategy → Race Setup → Race Strategy → Driver Instructions → **Simulate Race** → Results.
Results header shows the advanced round/budget; "Back to HQ" returns. Save persistence: reload page →
"Continue" should be enabled and restore the post-race state.

## Recording tips
- Maximize first: `sudo apt-get install -y wmctrl 2>/dev/null; wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`.
- The full loop is ~1–2 min; annotate per test (T1 HQ, T2 gate, T3 quali, T4 race, T5 standings, T6 save).

## Devin Secrets Needed
- None. Fully local, no credentials required.
