# Motorsport Sim Manager

A browser-based historical motorsport management simulation — think *Football Manager* / *Out of the Park Baseball* for Formula 1. You take the role of a Team Principal and guide a team through a historical season (and, in Career Mode, across many seasons of alternate history).

The first playable build ships the **1995 Formula 1 season**, seeded from a source spreadsheet of track, driver, and car performance ratings.

## Highlights

- **Two game modes** — Single Season (one historical year) and Career (multi-season, with offseason/regulations/development carryover scaffolding).
- **Separated race-weekend decisions** — choose your *qualifying* setup and run plan **before** qualifying; choose your *race* setup, strategy, and driver instructions **after** you see the grid. Qualifying aggression never silently carries into the race.
- **Deterministic simulation** — all randomness flows through a seeded RNG, so a save replays identically. No `Math.random` in the sim.
- **Pure, testable engines** — track fit (55% driver / 45% car), setup fit, qualifying, race, reliability, mistakes, pit stops, standings, development, morale, and news are plain functions outside React.
- **Alternate history** — the historical data is a *starting baseline*, not a script. Winners, champions, and development paths can diverge.
- **Dark dashboard UI** — data-dense, desktop-first management screens.
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
```

## Project layout

```
src/
  app/         App + routing
  components/  reusable dashboard UI
  data/        season seed data (edit values here)
    tracks/ teams/ drivers/ cars/ seasons/ setupOptions/
    pointsSystems/ regulations/ decisions/ development/
  game/        game state, reducer, save system, AI opponents
  screens/     full screens (Team HQ, Race Weekend, Standings, ...)
  sim/         pure deterministic simulation engines
  types/       domain + simulation type definitions
scripts/
  gen_seed.py  regenerates the 1995 seed files from the source spreadsheet
```

## Adding a future season

1. Add new seed files under `src/data/**` for the year.
2. Register the bundle in `src/data/index.ts` (`seasonBundles`).
3. The rest of the game (engines, screens, save system) is season-agnostic.
