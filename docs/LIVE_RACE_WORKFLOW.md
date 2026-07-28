# Live Race Workflow

## Purpose

The Live Race screen is the team principal's pit-wall workspace. Phase 21 changes how existing race information and decisions are presented without replacing or retuning the deterministic internal simulation.

## Workspace modes

- **Track View** keeps the circuit, timing tower, event feed, driver focus, pit windows, telemetry, and natural-checkpoint engineer summary visible together.
- **Data View** presents the same authoritative race state as reorderable, hideable tablet panels for timing, analytics, pit-wall status, events, engineer summaries, and telemetry.
- Layout, visible panels, automatic-pause choices, and the strategy drawer state are stored per career as optional display preferences. They are not part of the career save.

## Strategy drawer and projections

The persistent strategy drawer replaces the era screen's separate strategy modal. Each player car shows the current state, selected pit intensity, exit pace mode, and a before-versus-after projection.

Projection rules:

- Pace uses the existing strategy-mode pace delta and live pace-to-lap-time coefficient.
- Tyre impact uses the existing per-car degradation rate and mode wear multiplier.
- Pit execution uses the existing intensity stationary-time delta.
- Pit timing uses the current pit window and the established green-flag or safety-car pit loss.
- Fuel explicitly reports no modeled change because the current engine does not vary fuel consumption by pace mode.
- Risk compares the existing reliability and crash multipliers.

The projection never rolls the simulation forward and never promises a finishing position. Applying a call still uses the existing race action.

## Automatic pauses

The player can independently pause for:

- incidents;
- a player pit window opening;
- weather-state changes;
- a new player-car mechanical problem;
- important engineer advice.

These settings observe state transitions after a deterministic simulation step. They do not create events or change their probability. Player retirements and blocking race-control prompts retain their existing protected handling.

## Staff responsibilities

Race-strategy responsibility settings now reach the live pit wall:

- Only the **Staff Handles Routine Work** policy can execute a recommendation.
- The strategist must have Normal or High confidence.
- The recommendation must be low or medium priority and at least 70% confidence.
- Weather, reliability, team orders, high-priority, urgent, and low-confidence calls always remain with the player.
- A delegated action uses the recommendation's existing deterministic action and records the staff call in the event log.

## Driver focus and debrief

Incident alerts, event rows with a recognized driver, timing rows in Data View, recommendation cards, pit-wall cards, and telemetry cards can focus the affected driver with one click.

At the finish, committing the live result routes directly to `/post-race/:raceId`. The separate podium interstitial was removed so the post-race review remains the single debrief destination. Historical result routes remain available for later review.

## External race-engine compatibility

The UI consumes a `LiveRaceState`, emits existing race actions, and derives presentation-only projections and alerts. A future iRacing or AMS2 adapter can populate the same view contract without changing career saves. External telemetry must remain evidence-labeled and must not be silently substituted for authoritative career outcomes.
