# Phase 7 Test Plan — Driver Relationships & Team Orders

App: local preview `http://localhost:4173/`. Career, 1995 F1, **Benetton** (Schumacher overall 9.5 →
seeds `numberOneExpectation=true`; Herbert is the teammate). No secrets.

Evidence basis: seeding `src/sim/relationshipEngine.ts:69-110` (#1 if `overall>=8.3`); live order
`applyTeamOrderToLive` (swap adjusts `totalTime` then re-derives positions); consequences
`resolveTeamOrderConsequences` (#1 disadvantaged → ~2× morale hit + media line); UI panel
`src/screens/LiveRace.tsx` TeamOrdersPanel; screen `src/screens/Relationships.tsx`; reducer wiring
`src/game/gameReducer.ts` `COMMIT_LIVE_RACE`.

## T1 — Relationships screen seeds the garage (pre-race baseline)
Steps: New Game → Single Season → 1995 F1 → Benetton → Start → sidebar **Relationships**.
PASS criteria:
- Two driver cards: **M. Schumacher** and **J. Herbert**.
- Schumacher card shows the amber **"Expects #1 status"** badge; Herbert card does NOT.
- Each card shows 5 bars (Morale, Team Loyalty, Engineer Chemistry, Teammate Relationship,
  Frustration) with numeric values in 0–100, and "Teammate: <other driver>".
- "Team-Order Log (this season)" reads "No team orders issued yet."
RECORD baseline numbers for Schumacher: Morale, Team Loyalty, Teammate Relationship.
FAIL if no #1 badge appears, or bars missing/blank.

## T2 — Issue a team order that visibly swaps positions on track
Steps: HQ → Go to Next Race → step weekend to **Simulate Qualifying** → through to **Simulate Race** →
on the Live Race screen, press Play/Step until both Benetton cars are running and Schumacher is ahead of
Herbert. In the **Team Orders** panel, under **Swap positions**, click the **J. Herbert** button.
PASS criteria:
- Immediately after clicking, in the running order Herbert moves AHEAD of Schumacher (their on-track
  order flips), OR an event-log line "Positions swapped in favour of J. Herbert." appears.
- A team order is now recorded (verified in T4 log).
FAIL if clicking does nothing (no order line, no position change) — would indicate the live wiring is broken.
NOTE: "Swap positions" buttons must be **disabled** if only one car is running (needs both).

## T3 — Finish race; disadvantaged #1 driver suffers fallout
Steps: Skip to end / finish the race → at the flag click through to commit results → sidebar Relationships.
PASS criteria (compare to T1 baseline):
- Schumacher's **Morale** is LOWER than baseline and **Team Loyalty** is LOWER than baseline.
- Schumacher's **Teammate Relationship** is LOWER than baseline; **Frustration** HIGHER.
- A news headline exists reading roughly: "M. Schumacher openly questions the team after being told to
  give best position to J. Herbert." (News feed on HQ/Standings, or the order's media reaction.)
FAIL if Schumacher's bars are unchanged after a swap that disadvantaged him.

## T4 — Team-Order Log records the call
Steps: Relationships → "Team-Order Log (this season)".
PASS criteria:
- One entry: "Lap N · Swap positions · favouring J. Herbert over M. Schumacher".
FAIL if log still says "No team orders issued yet."

## Adversarial note
A broken implementation would look different at each gate: no #1 badge (T1), click no-ops (T2),
unchanged bars / no headline (T3), empty log (T4). Each step distinguishes working vs broken.
