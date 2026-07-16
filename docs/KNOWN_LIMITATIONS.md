# Known Limitations

Last updated: 2026-07-16 (Phase 19AO American Open-Wheel Youth Continuity)

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

Related team and driver reports are also grouped into continuing storylines, with
chapter order, urgency, and summaries that connect events across race weekends and
archived seasons.

**Remaining limitation:** Individual article prose remains template-driven and is
designed to be concise rather than simulate full-length journalism.

## AI Team Identity

AI teams have archetypes, philosophy traits, and multi-season memory that influence
development focus, driver market preferences, academy investment, spending priorities,
and risk appetite. Philosophy traits evolve over seasons and influence regulation
voting.

AI team identity persists across seasons and philosophy traits can evolve
gradually after sustained improvement, decline, or stagnation. These traits
influence development targets, driver recruitment, academy investment, spending
priorities, and strategic risk. The Team Universe dossier exposes the current
identity, behavioral effects, performance memory, and latest identity change.

**Remaining limitation:** Team philosophies are a gameplay model rather than a
historical claim about real organizations, and their narrative descriptions are
deliberately concise.

## Historical Data

Season data (tracks, teams, drivers, cars) exists for F1 1990–2026 and IndyCar
2008–2026. A lazy-loading system (`lazySeasonData.ts`) provides async access to
season bundles for informational screens.

The shared youth market now carries documented future CART/IndyCar drivers through
their real junior years, including the thin early-1990s classes. Synthetic CART and
IndyCar stand-ins remain excluded from every playable market.

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
