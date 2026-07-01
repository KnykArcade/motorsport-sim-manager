# Live Race Pace — design & tuning guide

The Live Race Pace system makes the race sim dynamic: every lap each car's pace is
recomputed from its **Base Race Pace** plus live modifiers (tyre, fuel, traffic,
form, strategy mode, weather, damage, reliability), and the lap time is derived
from that pace so the running order reacts to what's happening on track.

## Base Race Pace

Base Race Pace is the pre-race 50/25/15/10 blend (car / driver / team-raceOps /
setup-form-morale-variance) on the 1–10 scale. It is computed by the existing
race engine (`paceRating`) and converted with `PACE_SPREAD`:

```
baseRacePace = paceRating / PACE_SPREAD   // ~1..10
```

This is **not** changed by this feature — the pace formula is untouched.

## Current Live Race Pace

Recomputed every lap in `computeLivePace()` (`src/sim/liveRacePace.ts`):

```
livePace = baseRacePace
  + tyrePaceModifier(wear)          // +0.2 fresh … -2.2 gone
  + fuelPaceModifier(lap,total)     // heavy early, faster late (±FUEL_SWING/2)
  + warmupPaceModifier(tireAge)     // cold out-lap penalty
  + trackEvolutionModifier(lap,tot) // field-wide rubber-in (up to +TRACK_EVO)
  + mode.paceDelta                  // strategy mode
  + weatherPaceModifier(grip)       // wet penalty
  + formSwing                       // zero-mean per-lap driver momentum
  + dirtyAirModifier(gapAhead,mode) // -DIRTY_AIR_PENALTY within DIRTY_AIR_GAP
  + mode.trafficPaceBonus (if in dirty air)
  - damage (0.4) - reliabilityConcern (0.25/0.5) - mistake (0.6)
```

Clamped 1–10.5 internally; `displayPace()` clamps 1.0–10.0 for the UI.
Lap time in `raceTickEngine.ts`:

```
lapTime = REF_LAP - livePace * LIVE_PACE_K   // LIVE_PACE_K = 1.8 s per pace point
```

`LIVE_PACE_K = 1.8` reproduces the previous `paceRating * 0.45` spread
(paceRating = baseRacePace × 4), so the car-to-car gap is preserved.

## Strategy modes (6)

Defined in `STRATEGY_MODES` (`src/sim/liveRacePace.ts`). Each has: `paceDelta`,
`trafficPaceBonus`, `wearMult`, `reliabilityMult`, `crashMult`, `overtakeMult`,
`defendBonus`.

| Mode | pace | tyre wear | reliability | crash | notes |
|---|---|---|---|---|---|
| Conservative | −0.35 | 0.70× | 0.75× | 0.80× | save the car |
| Balanced | 0 | 1.0× | 1.0× | 1.0× | default |
| Push | +0.35 | 1.35× | 1.40× | 1.25× | chase a gap |
| Attack | +0.25 | 1.40× | 1.15× | 1.70× | overtaking, +0.5 pace in traffic |
| Defend | −0.10 | 1.12× | 1.0× | 1.20× | high `defendBonus` |
| ProtectEngine | −0.50 | 0.70× | 0.50× | 0.75× | minimise mechanical DNF |

The player changes a car's mode mid-race via the Strategy Mode buttons on the
Pit Wall (`setPlayerPaceMode` in `raceTickEngine.ts`). AI cars pick a mode each
lap in `aiStrategyEngine.ts` by situation (reliability warning → ProtectEngine,
worn tyres → Conservative, stuck behind → Attack, defending late → Defend,
chasing → Push, else Balanced).

## Reliability vs crash risk (separated)

- `baseFailureRisk` — mechanical, scaled by `eraReliabilityScale(year)` at creation.
- `baseCrashRisk` — incident, from driver aggression/composure + track wall proximity.
- Per lap: `reliabilityRisk = baseFailureRisk × mode.reliabilityMult (+ active issue)`,
  `crashRisk = (baseCrashRisk × mode.crashMult + tyreRisk) × fighting × wet × damage`.
- UI bands from `reliabilityRiskLevel()` / `crashRiskLevel()`.

## DNF cause balancing per era (`src/sim/dnfModel.ts`)

When a car retires, the cause is drawn from `eraDnfProfile(year)` (reliability /
crash / tyre / other), nudged by context (car reliability, aggression, composure,
tyre wear, wall proximity, traffic). Targets:

| Era | rel | crash | tyre | other |
|---|---|---|---|---|
| 1990–1994 | 70 | 20 | 7 | 3 |
| 1995–2000 | 65 | 25 | 7 | 3 |
| 2001–2005 | 60 | 30 | 7 | 3 |
| 2006–2010 | 55 | 35 | 7 | 3 |
| 2011–2013 | 50 | 40 | 7 | 3 |
| Modern | 40 | 45 | 10 | 5 |

`eraReliabilityScale(year)` cuts raw mechanical-failure probability (~0.78 for
2006–2010, the strongest reduction per the brief; 0.82–0.92 elsewhere) to reduce
reliability retirements ~15–25%. Both the live sim and the quick sim
(`raceEngine.ts`, Option B) use this model, so live and instant results agree.

## Status messages & traffic

`statusMessage()` returns a prioritised readable line ("Stuck in traffic",
"Tyres beginning to fade", "Reliability warning: …", "Strong pace on fresh
tyres", …). `trafficStatus()` → Clear / InTraffic / Attacking / Defending.

## Files changed

- `src/sim/liveRacePace.ts` **(new)** — pace model, strategy specs, risk bands, status.
- `src/sim/dnfModel.ts` **(new)** — era DNF profiles, reliability scaling, cause picker.
- `src/sim/liveRaceEngine.ts` — init base pace, separate crash risk, era-scale reliability, `year`.
- `src/sim/raceTickEngine.ts` — per-lap live pace, split risk, contextual DNF causes, status; `setPlayerPaceMode`.
- `src/sim/raceEngine.ts` — fold fuel/traffic + era DNF model into the quick sim (Option B).
- `src/sim/aiStrategyEngine.ts` — 6-mode situational selection.
- `src/game/raceSetup.ts` — thread `year` into context/options/meta.
- `src/screens/LiveRace.tsx` — live pace, risk bands, status, and a per-car mode selector.
- `src/types/liveTypes.ts`, `src/types/simTypes.ts` — new fields (`baseRacePace`, `liveRacePace`, risk levels, `year`, 6 modes).
- `scripts/livepace.test.ts` **(new)** — validation harness (see below).

## Where to tune

| Want to change | Edit |
|---|---|
| Overall pace spread (gaps) | `LIVE_PACE_K` in `liveRacePace.ts` |
| Fuel swing size | `FUEL_SWING` |
| Track evolution | `TRACK_EVO` |
| Dirty-air strength / range | `DIRTY_AIR_PENALTY`, `DIRTY_AIR_GAP` |
| Tyre pace bands | `tyrePaceModifier()` |
| Mode tradeoffs | `STRATEGY_MODES` |
| DNF cause split | `eraDnfProfile()` |
| Reliability-DNF volume | `eraReliabilityScale()` |
| AI mode choices | `aiStrategyEngine.ts` |
| Risk band thresholds | `reliabilityRiskLevel()`, `crashRiskLevel()` |

## Validation harness

```
LP_RUN=1 npx vitest run scripts/livepace.test.ts --disable-console-intercept
```

Reports: DNF-cause split by era vs targets; a live-race segment progression
sample (leader + player live pace / tyre / risk / status); and a strategy-mode
balance table. Env: `LP_RUNS`, `LP_MODE_RUNS`, `LP_SEASONS`, `LP_SAMPLE_SEASON`.

Representative results (2008-F1, midfield car, 80 races each):

```
mode          | avg live pace | DNF% | finish tyre% | posGain
Conservative  | 6.24          | 32.5 | 40           | +1.9
Balanced      | 6.53          | 41.3 | 59           | +3.2
Push          | 6.58          | 58.8 | 43           | -0.0
Attack        | 6.62          | 41.3 | 40           | +0.9
```

Conservative is slowest but safest; Push/Attack are fastest but riskier — the
intended tradeoff. DNF-cause splits land within a few points of the era targets.
```
