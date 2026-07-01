// Data Analytics Recommendation engine.
//
// Each lap the engine scans the live race state and, for every player-controlled
// driver, surfaces at most one recommendation: the highest-priority issue the
// analytics team has detected, together with a recommended action, the alternate
// actions offered under "Modify", an expected impact and a confidence score.
//
// Recommendations are derived purely from live race data (risk levels, tyre
// wear, fuel, component health, gaps, weather, safety car, race phase) — never
// random — so the same race always produces the same advice. The pit wall / the
// player decides whether to Accept, Modify or Ignore (see raceTickEngine).

import type {
  AnalyticsRecommendation,
  LiveCarState,
  LiveRaceState,
  RecAction,
  RecPriority,
} from '../types/liveTypes';
import { DIRTY_AIR_GAP } from './liveRacePace';

// Default laps a recommendation kind is suppressed before it may re-raise
// (urgent recommendations bypass this so a worsening situation is never hidden).
export const REC_COOLDOWN = 5;
// Laps a recommendation stays live if its trigger persists.
const REC_TTL = 5;
// Positions that pay championship points (approximate, for points-defence advice).
const POINTS_POSITIONS = 10;

// Per-kind dedup/re-raise cooldown (laps). See the lifecycle merge in the tick
// engine. Situational kinds (safety car / pit window / weather) are short here
// but are also cleared outright when the underlying situation changes.
export const KIND_COOLDOWN: Record<string, number> = {
  attack: 4,
  defend: 4,
  crash: 4,
  reliability: 6,
  component: 6,
  damage: 6,
  pointsHold: 6,
  tyres: 5,
  fuel: 5,
  teammate: 5,
  safetyCarPit: 6,
  weatherTyres: 6,
  pitWindow: 6,
};

export function cooldownFor(kind: string): number {
  return KIND_COOLDOWN[kind] ?? REC_COOLDOWN;
}

// Default decision countdown (seconds) before an un-actioned high/urgent
// recommendation auto-expires (treated as ignored — "no pit wall response").
export const DECISION_COUNTDOWN_SECONDS = 10;

const PRIORITY_RANK: Record<RecPriority, number> = { low: 1, medium: 2, high: 3, urgent: 4 };

// Whether a pending recommendation should pause playback and run the decision
// countdown. Every candidate the engine raises is actionable (it asks the player
// to Accept / Modify / Ignore / Let Crew Decide), so any pending medium+ rec
// pauses — single-driver strategy calls (Attack, Defend, Protect Engine, Pit
// Now, …) just as much as grouped safety-car / weather decisions. Only truly
// optional low-priority advice appears quietly without pausing.
export function requiresDecision(rec: AnalyticsRecommendation): boolean {
  if (rec.status !== 'pending') return false;
  return rec.priority !== 'low';
}

// A strategy-mode instruction (as opposed to a one-shot pit / stay-out / team
// order). Only mode instructions with a parsed duration become `active`.
export function isModeAction(a: RecAction): boolean {
  return !!a.paceMode && !a.pitNow && !a.teamOrder;
}

// Parse a human duration ("3-5 laps", "5 laps", "rest of race") into a lap count.
export function parseDurationLaps(
  text: string | undefined,
  lap: number,
  totalLaps: number,
): number | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  if (t.includes('rest of race') || t.includes('flag')) return Math.max(1, totalLaps - lap);
  const range = t.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return Math.max(1, Math.floor((parseInt(range[1], 10) + parseInt(range[2], 10)) / 2));
  const single = t.match(/(\d+)/);
  if (single) return Math.max(1, parseInt(single[1], 10));
  // Qualitative durations ("until the stop") → a sensible default stint length.
  return 6;
}

// A candidate recommendation before it is stamped with id / driver / lap fields.
type Candidate = {
  kind: string;
  priority: RecPriority;
  issue: string;
  recommendedAction: string;
  suggestedDuration?: string;
  expectedImpact: string;
  confidence: number;
  action: RecAction;
  alternatives: RecAction[];
};

// Reusable action builders.
const A = {
  protect: (): RecAction => ({ type: 'ProtectEngine', label: 'Protect Engine', paceMode: 'ProtectEngine' }),
  conservative: (): RecAction => ({ type: 'Conservative', label: 'Conservative', paceMode: 'Conservative' }),
  balanced: (): RecAction => ({ type: 'Balanced', label: 'Balanced', paceMode: 'Balanced' }),
  push: (): RecAction => ({ type: 'Push', label: 'Push', paceMode: 'Push' }),
  attack: (): RecAction => ({ type: 'Attack', label: 'Attack', paceMode: 'Attack' }),
  defend: (): RecAction => ({ type: 'Defend', label: 'Defend', paceMode: 'Defend' }),
  saveTires: (): RecAction => ({ type: 'SaveTires', label: 'Save Tyres', paceMode: 'Conservative' }),
  fuelSave: (): RecAction => ({ type: 'FuelSave', label: 'Fuel Save', paceMode: 'Conservative' }),
  hold: (): RecAction => ({ type: 'HoldPosition', label: 'Hold Position', paceMode: 'Balanced' }),
  pitNow: (): RecAction => ({ type: 'PitNow', label: 'Pit Now', pitNow: true }),
  stayOut: (): RecAction => ({ type: 'StayOut', label: 'Stay Out', paceMode: 'Conservative' }),
  letRace: (): RecAction => ({ type: 'LetTeammateRace', label: 'Let Them Race', teamOrder: 'LetThemRace' }),
  swap: (): RecAction => ({ type: 'SwapPositions', label: 'Swap Positions', teamOrder: 'SwapPositions' }),
};

// Build every candidate that currently applies to this car, in priority order.
function candidatesFor(
  car: LiveCarState,
  state: LiveRaceState,
  intervalAhead: number,
  intervalBehind: number,
): Candidate[] {
  const out: Candidate[] = [];
  const wear = car.tire.wear;
  const minHealth = Math.min(car.engineHealth, car.gearboxHealth, car.brakeHealth);
  const stopsLeft = car.pit.plannedStops - car.pit.stopsMade;
  const lateRace = state.currentLap > state.totalLaps * 0.8;
  const finalLaps = state.currentLap >= state.totalLaps - 1;
  const pushing = car.paceMode === 'Push' || car.paceMode === 'Attack';

  // 1. Wrong tyres for wet conditions — change immediately.
  if (state.weather.wet && car.tire.compound === 'Dry') {
    out.push({
      kind: 'weatherTyres',
      priority: 'urgent',
      issue: `Track is ${state.weather.label.toLowerCase()} and the car is on slicks.`,
      recommendedAction: 'Pit now for wet tyres.',
      expectedImpact: 'Avoids heavy time loss / crash risk in the wet.',
      confidence: 90,
      action: A.pitNow(),
      alternatives: [A.conservative(), A.stayOut()],
    });
  }

  // 2. Critical reliability risk.
  if (car.reliabilityRiskLevel === 'Critical') {
    out.push({
      kind: 'reliability',
      priority: 'urgent',
      issue: car.reliabilityIssue
        ? `${car.reliabilityIssue.label} is now critical — failure imminent.`
        : 'Reliability risk is critical.',
      recommendedAction: 'Switch to Protect Engine and nurse the car home.',
      suggestedDuration: 'rest of race',
      expectedImpact: 'Reliability Risk: Critical -> High, Live Pace -0.5',
      confidence: 92,
      action: A.protect(),
      alternatives: [A.conservative(), A.pitNow()],
    });
  }

  // 3. Component health below the safe threshold.
  if (minHealth < 50) {
    const worst =
      minHealth === car.engineHealth ? 'Engine' : minHealth === car.gearboxHealth ? 'Gearbox' : 'Brakes';
    out.push({
      kind: 'component',
      priority: 'high',
      issue: `${worst} health down to ${Math.round(minHealth)}% — mechanical stress is high.`,
      recommendedAction: 'Ease off in Protect Engine to preserve the component.',
      suggestedDuration: '5-8 laps',
      expectedImpact: `${worst} wear rate reduced, Live Pace -0.5`,
      confidence: 82,
      action: A.protect(),
      alternatives: [A.conservative()],
    });
  }

  // 4. Safety car out — cheap stop available.
  if (state.safetyCar.active && stopsLeft > 0 && !car.pit.inPitThisLap) {
    out.push({
      kind: 'safetyCarPit',
      priority: 'high',
      issue: 'Safety car deployed — a pit stop costs much less time now.',
      recommendedAction: 'Prioritise the pit stop under the safety car.',
      expectedImpact: 'Saves ~10s vs a green-flag stop.',
      confidence: 84,
      action: A.pitNow(),
      alternatives: [A.stayOut()],
    });
  }

  // 5. Tyres critically worn.
  if (wear >= 82 && stopsLeft > 0 && !car.pit.inPitThisLap) {
    out.push({
      kind: 'tyres',
      priority: 'high',
      issue: `Tyres at ${Math.round(wear)}% wear — approaching the cliff.`,
      recommendedAction: 'Pit now for fresh rubber.',
      expectedImpact: 'Restores pace; avoids puncture / big time loss.',
      confidence: 85,
      action: A.pitNow(),
      alternatives: [A.saveTires(), A.stayOut()],
    });
  }

  // 6. High reliability risk.
  if (car.reliabilityRiskLevel === 'High') {
    out.push({
      kind: 'reliability',
      priority: 'high',
      issue: car.reliabilityIssue
        ? `${car.reliabilityIssue.label} may impact reliability within 5-8 laps.`
        : 'Reliability risk has risen to High.',
      recommendedAction: 'Move to Protect Engine mode.',
      suggestedDuration: '5-8 laps',
      expectedImpact: 'Reliability Risk: High -> Medium, Live Pace -0.4',
      confidence: 80,
      action: A.protect(),
      alternatives: [A.conservative(), A.pitNow()],
    });
  }

  // 7. Pit window open.
  if (
    car.pit.window &&
    state.currentLap >= car.pit.window.open &&
    state.currentLap <= car.pit.window.close &&
    stopsLeft > 0 &&
    !car.pit.inPitThisLap
  ) {
    out.push({
      kind: 'pitWindow',
      priority: 'high',
      issue: `Pit window is open (ideal lap ${car.pit.window.ideal}).`,
      recommendedAction: 'Box this lap to hit the strategy window.',
      expectedImpact: 'Optimal undercut / tyre-offset window.',
      confidence: 76,
      action: A.pitNow(),
      alternatives: [A.stayOut()],
    });
  }

  // 8. High crash risk while attacking.
  if ((car.crashRiskLevel === 'High' || car.crashRiskLevel === 'Critical') && pushing) {
    out.push({
      kind: 'crash',
      priority: 'high',
      issue: 'Crash/contact risk is high while pushing in traffic.',
      recommendedAction: 'Back off to Conservative to settle the car.',
      suggestedDuration: '3-5 laps',
      expectedImpact: 'Crash Risk: High -> Medium, Live Pace -0.35',
      confidence: 78,
      action: A.conservative(),
      alternatives: [A.balanced(), A.defend()],
    });
  }

  // 9. Car damaged.
  if (car.damaged) {
    out.push({
      kind: 'damage',
      priority: 'medium',
      issue: 'Car is carrying damage — pace and risk are compromised.',
      recommendedAction: 'Run Conservative to manage the damage.',
      expectedImpact: 'Lower crash risk; slightly reduced pace.',
      confidence: 70,
      action: A.conservative(),
      alternatives: [A.pitNow()],
    });
  }

  // 10. Medium reliability risk.
  if (car.reliabilityRiskLevel === 'Medium') {
    out.push({
      kind: 'reliability',
      priority: 'medium',
      issue: car.reliabilityIssue
        ? `${car.reliabilityIssue.label} detected — reliability risk at Medium.`
        : 'Reliability risk has risen to Medium.',
      recommendedAction: 'Consider Protect Engine to be safe.',
      suggestedDuration: '5 laps',
      expectedImpact: 'Reliability Risk: Medium -> Low, Live Pace -0.3',
      confidence: 68,
      action: A.protect(),
      alternatives: [A.conservative()],
    });
  }

  // 11. Tyres fading.
  if (wear >= 60 && wear < 82 && stopsLeft > 0 && !car.pit.inPitThisLap) {
    out.push({
      kind: 'tyres',
      priority: 'medium',
      issue: `Tyres fading at ${Math.round(wear)}% wear.`,
      recommendedAction: 'Save tyres to extend the stint.',
      suggestedDuration: 'until the stop',
      expectedImpact: 'Slower wear; small pace cost now.',
      confidence: 62,
      action: A.saveTires(),
      alternatives: [A.pitNow()],
    });
  }

  // 12. Under pressure from behind.
  if (intervalBehind > 0 && intervalBehind < DIRTY_AIR_GAP && car.paceMode !== 'Defend') {
    out.push({
      kind: 'defend',
      priority: 'medium',
      issue: 'A car behind is within a second and looking for a way past.',
      recommendedAction: 'Switch to Defend to protect track position.',
      suggestedDuration: '3-5 laps',
      expectedImpact: 'Harder to overtake; small tyre cost.',
      confidence: 66,
      action: A.defend(),
      alternatives: [A.push()],
    });
  }

  // 13. Close behind the car ahead.
  if (intervalAhead > 0 && intervalAhead < DIRTY_AIR_GAP && car.position != null && car.position > 1 && car.paceMode !== 'Attack') {
    out.push({
      kind: 'attack',
      priority: 'medium',
      issue: 'Within a second of the car ahead — a move is on.',
      recommendedAction: 'Switch to Attack to force an overtake.',
      suggestedDuration: '3-5 laps',
      expectedImpact: 'Better overtaking; higher tyre + crash risk.',
      confidence: 64,
      action: A.attack(),
      alternatives: [A.push(), A.hold()],
    });
  }

  // 14. Late-race points defence.
  if (
    lateRace &&
    !finalLaps &&
    car.position != null &&
    car.position <= POINTS_POSITIONS &&
    car.paceMode !== 'Conservative' &&
    car.paceMode !== 'Defend'
  ) {
    out.push({
      kind: 'pointsHold',
      priority: 'medium',
      issue: `Holding a points position (P${car.position}) late in the race.`,
      recommendedAction: 'Go Conservative to bring the points home.',
      expectedImpact: 'Lower failure/crash risk; protects the finish.',
      confidence: 60,
      action: A.conservative(),
      alternatives: [A.defend()],
    });
  }

  // 15. Fuel running low.
  if (car.fuel < 12 && !finalLaps) {
    out.push({
      kind: 'fuel',
      priority: 'medium',
      issue: `Fuel down to ${Math.round(car.fuel)}% — margin is tight.`,
      recommendedAction: 'Lift-and-coast to save fuel.',
      suggestedDuration: '2-3 laps',
      expectedImpact: 'Ensures the car reaches the flag; small pace cost.',
      confidence: 58,
      action: A.fuelSave(),
      alternatives: [A.balanced()],
    });
  }

  return out;
}

// Stamp a candidate into a fresh pending recommendation for a driver.
function toRec(
  pick: Candidate,
  driverId: string,
  lap: number,
  totalLaps: number,
): AnalyticsRecommendation {
  const suggestedDurationLaps = isModeAction(pick.action)
    ? parseDurationLaps(pick.suggestedDuration, lap, totalLaps)
    : undefined;
  return {
    id: `${driverId}:${pick.kind}`,
    driverId,
    kind: pick.kind,
    priority: pick.priority,
    issue: pick.issue,
    recommendedAction: pick.recommendedAction,
    suggestedDuration: pick.suggestedDuration,
    suggestedDurationLaps,
    expectedImpact: pick.expectedImpact,
    confidence: pick.confidence,
    createdLap: lap,
    expiresLap: lap + REC_TTL,
    action: pick.action,
    alternatives: pick.alternatives,
    status: 'pending',
  };
}

// Generate the best pending candidate recommendation per player driver from the
// given (already advanced) car list + state. This is the raw generation step: it
// does NOT apply lifecycle (dedup vs active/pending, cooldowns, carry-forward) —
// that is done by the merge in raceTickEngine so the same advice is not re-issued
// while it is already pending, active or on cooldown.
export function generateCandidates(
  cars: LiveCarState[],
  state: LiveRaceState,
  lap: number,
): AnalyticsRecommendation[] {
  const running = cars.filter((c) => c.running).sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const intervalAhead: Record<string, number> = {};
  const intervalBehind: Record<string, number> = {};
  running.forEach((c, i) => {
    intervalAhead[c.driverId] = i === 0 ? 0 : c.interval;
    intervalBehind[c.driverId] = running[i + 1] ? running[i + 1].interval : 0;
  });

  const out: AnalyticsRecommendation[] = [];

  const playerRunning = running.filter((c) => c.isPlayer);
  for (const car of playerRunning) {
    const cands = candidatesFor(
      car,
      state,
      intervalAhead[car.driverId] ?? 0,
      intervalBehind[car.driverId] ?? 0,
    );
    if (cands.length === 0) continue;
    const pick = cands.reduce((best, c) =>
      PRIORITY_RANK[c.priority] > PRIORITY_RANK[best.priority] ? c : best,
    );
    out.push(toRec(pick, car.driverId, lap, state.totalLaps));
  }

  // Teammate management: if two player cars are running nose-to-tail, advise the
  // blocking (slower-in-front) car to let the faster teammate race.
  if (playerRunning.length === 2) {
    const [front, back] =
      (playerRunning[0].position ?? 99) < (playerRunning[1].position ?? 99)
        ? [playerRunning[0], playerRunning[1]]
        : [playerRunning[1], playerRunning[0]];
    const gap = intervalBehind[front.driverId] ?? 0;
    // The car behind is a faster teammate stuck in dirty air.
    if (gap > 0 && gap < DIRTY_AIR_GAP && back.baseRacePace > front.baseRacePace + 0.15) {
      // Only add if we did not already pick a higher-priority rec for this car.
      if (!out.some((r) => r.driverId === front.driverId)) {
        const teammate: Candidate = {
          kind: 'teammate',
          priority: 'medium',
          issue: 'Your faster teammate is stuck behind and losing time.',
          recommendedAction: 'Let the teammate through to race the cars ahead.',
          expectedImpact: 'Maximises the team result; costs this car a place.',
          confidence: 64,
          action: A.letRace(),
          alternatives: [A.swap(), A.hold()],
        };
        out.push(toRec(teammate, front.driverId, lap, state.totalLaps));
      }
    }
  }

  return out;
}
