# Known Limitations

Last updated: 2025-07-03 (Final Stability Cleanup Pass)

## Regulation Sets

Year-specific regulation sets were added in Priority 1. Each F1 season from 1990–2026
and each IndyCar season from 2008–2026 now uses a `reg-YYYY` (or `reg-YYYY-indy`)
regulation set ID that reflects era-appropriate rules (refueling bans, DRS introduction,
budget caps, aero formula changes, sprint formats, etc.).

**Remaining limitation:** Regulation sets are era-accurate gameplay models, not full
FIA/IndyCar rulebook simulations. Some historical rules may be simplified for gameplay
purposes. Exact round-level sprint rules may be simplified where the source data is
ambiguous.

## Game Modes

Three game modes are supported:

- **Career Mode** — Full long-term management across multiple seasons.
- **Single Season** — Historical replay of one selected year. Long-term systems
  (Youth Academy, scouting, future contracts, next-year development, regulation
  politics, engine supplier deals, sponsor negotiations, offseason planning) are
  disabled.
- **Sandbox Mode** — Broad, flexible mode with no restrictions. Full access to all
  systems.

## News Center

The News Center uses a template-driven engine with driver drama hooks (confidence,
trust, ego, promises, teammate rivalry, contract tension). News items are generated
deterministically from race results and relationship state.

**Remaining limitation:** News content is template-driven and may still need tuning
for variety and narrative depth.

## AI Team Identity

AI teams have archetypes, philosophy traits, and multi-season memory that influence
development focus, driver market preferences, academy investment, spending priorities,
and risk appetite. Philosophy traits evolve over seasons and influence regulation
voting.

**Remaining limitation:** AI team identity exists in the simulation engine with
philosophy traits that persist across seasons. Gradual trait evolution is not yet
implemented; traits regenerate only when a team's archetype changes.

## Historical Data

Season data (tracks, teams, drivers, cars) exists for F1 1990–2026 and IndyCar
2008–2026. A lazy-loading system (`lazySeasonData.ts`) provides async access to
season bundles for informational screens.

**Remaining limitation:** Historical sponsor and engine details may use fictionalized
or gameplay-safe equivalents where exact data is unavailable. The lazy-loading system
supports all registered seasons; seasons are loaded on demand when selected.

## Race Engine

The race engine is an abstraction, not a physics simulator. Live race telemetry,
confidence integration, and tire/fuel modeling are gameplay-oriented simplifications.

## Save Compatibility

Save compatibility is **not guaranteed** during active development. Each new update
should be tested through a fresh career/new game start.

## Balance and UI Polish

Balance tuning and UI polish are ongoing. Some screens may need additional layout
work, and game balance values (development costs, driver market pricing, AI behavior
parameters) are subject to further adjustment.
