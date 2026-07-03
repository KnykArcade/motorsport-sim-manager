# Motorsport Sim Manager

A browser-based historical motorsport management simulation — think *Football Manager* / *Out of the Park Baseball* for Formula 1. You take the role of a Team Principal and guide a team through a historical season (and, in Career Mode, across many seasons of alternate history).

The game ships with **37 seasons of F1 data (1990–2026)** and **19 seasons of IndyCar data (2008–2026)**, seeded from historical track, driver, and car performance ratings.

## Highlights

- **Three game modes** — Single Season (one historical year with locked engine/sponsors), Career (multi-season with offseason, regulations, development carryover), and Sandbox (all systems unlocked, no restrictions).
- **Driver Confidence / Trust / Ego system** — each driver has self-confidence, trust in car/team/principal, ego, morale, frustration, personality traits, and wants. These evolve with race results, team orders, and promises, and feed back into on-track performance.
- **Driver Drama News** — the News Center generates immersive paddock stories from confidence surges/collapses, trust erosion, ego clashes, teammate rivalry, broken promises, and contract tension.
- **AI Team Identity** — every AI team has a persistent philosophy (traits like Technical Innovator, Risk Taker, Star Maker), an archetype (Championship Contender, Survival Mode, etc.), and a financial model that evolves across seasons. Philosophy traits influence regulation voting, driver market, development, and academy decisions.
- **Separated race-weekend decisions** — setup trim is handled automatically (professional team prep runs a qualifying trim on Saturday and a race trim on Sunday). You choose the *qualifying run strategy* **before** qualifying, then your *race strategy and driver instructions* **after** you see the grid. Qualifying aggression never silently carries into the race.
- **Practice / setup confidence** — a pre-qualifying readout of each driver's setup confidence and one-lap vs. long-run pace to inform your run and strategy choices.
- **Deterministic simulation** — all randomness flows through a seeded RNG, so a save replays identically. No `Math.random` in the sim.
- **Pure, testable engines** — track fit (55% driver / 45% car), setup fit, qualifying, race, reliability, mistakes, pit stops, standings, development, morale, news, and driver drama are plain functions outside React.
- **Alternate history** — the historical data is a *starting baseline*, not a script. Winners, champions, and development paths can diverge.
- **Dark dashboard UI** — data-dense, desktop-first management screens.
- **News Center** — filterable, sortable news feed covering race results, qualifying, paddock drama, driver market, development, AI team moves, youth academy, regulations, and championship battles.
- **Data Viewer** — inspect every rating: calendar, track demands, teams, drivers, cars, points, setups, and development projects.
- **localStorage save/load** — single-slot autosave (no backend for the MVP).

## Tech stack

Vite · React · TypeScript (strict) · React Router · Tailwind CSS.

## Getting started

```bash
npm install
npm run dev        # start the dev server
npm run build      # typecheck + production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest run
```

## Project layout

```
src/
  app/         App + routing
  components/  reusable dashboard UI
  data/        season seed data (edit values here)
    tracks/ teams/ drivers/ cars/ seasons/ setupOptions/
    pointsSystems/ regulations/ decisions/ development/
  game/        game state, reducer, save system, mode restrictions, AI opponents
  screens/     full screens (Team HQ, Race Weekend, Standings, News Center, ...)
  sim/         pure deterministic simulation engines
  types/       domain + simulation type definitions
scripts/
  gen_seed.py  regenerates the 1995 seed files from the source spreadsheet
```

## Adding a future season

1. Add new seed files under `src/data/**` for the year.
2. Register the bundle in `src/data/index.ts` (`seasonBundles`).
3. The rest of the game (engines, screens, save system) is season-agnostic.

## Known Limitations

- **Single-slot save** — one autosave in localStorage; no multiple save slots or cloud sync.
- **No multiplayer** — single-player only.
- **No real-time simulation** — races are resolved turn-by-turn, not live lap-by-lap (though a live race view shows progressive updates).
- **Historical data accuracy** — ratings are estimates from available sources; some seasons may have approximate values for lesser-known drivers/teams.
- **No driver retirements in Single Season** — driver aging and retirement only apply in Career/Sandbox mode.
- **Sandbox mode** — all systems unlocked with no mode-based restrictions. Functionally similar to Career mode but without any route or action gating.
- **AI team philosophy drift** — philosophy traits persist across seasons and influence regulation voting, driver market, and development. Gradual trait evolution is not yet implemented; traits regenerate only when a team's archetype changes.
- **No custom team creation** — you pick from historical teams only.
- **No mod support** — data is code-level only; no external file loading.
