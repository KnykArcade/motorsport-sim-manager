// Data Analytics — Monitoring intelligence.
//
// The Live Race Data Analytics panel is permanent: even when no player decision
// is required it shows a live "pit wall feed" of what the analytics team is
// watching. This module derives that idle/monitoring intelligence purely from
// live race state (gaps, tyres, fuel, reliability, traffic, weather, pit
// windows) so it is deterministic and never logs anything — monitoring must not
// spam the event log (only real recommendations/decisions are logged elsewhere).
//
// The panel picks a display mode from the recommendation lifecycle:
//   • Decision          — one or more pending recommendations await the player
//   • Active Instruction — an accepted duration instruction is being applied
//   • Monitoring         — no pending/active recs; show this intelligence
// A recently ignored/expired recommendation surfaces a short cooldown context
// inside Monitoring so the player understands why it will not immediately reappear.

import type { AnalyticsRecommendation, LiveCarState, LiveRaceState } from '../types/liveTypes';
import { DIRTY_AIR_GAP } from './liveRacePace';
import { cooldownFor } from './analyticsEngine';
import { overallConfidenceScore } from './driverConfidenceEngine';

// The permanent panel's display mode. A pending decision always wins; then an
// active instruction; then a recent-decision cooldown; otherwise plain monitoring.
export type PanelMode = 'monitoring' | 'decision' | 'active' | 'cooldown';

export function selectPanelMode(recs: AnalyticsRecommendation[], recentCount: number): PanelMode {
  if (recs.some((r) => r.status === 'pending')) return 'decision';
  if (recs.some((r) => r.status === 'active')) return 'active';
  if (recentCount > 0) return 'cooldown';
  return 'monitoring';
}

// Per-driver panel cell. The compact Data Analytics panel always shows a cell for
// every running player driver; this picks what that driver's cell should display,
// following the panel priority: a pending decision wins, then an active
// instruction, then a recent (ignored) decision on cooldown, otherwise plain
// monitoring. Kept pure so the panel component stays dumb and this is unit-tested.
export type DriverPanelCell =
  | { state: 'decision'; rec: AnalyticsRecommendation }
  | {
      state: 'active';
      rec: AnalyticsRecommendation;
      remaining: number | null; // laps left in the instruction
      total: number | null; // total instruction duration in laps
      reviewLap: number | null; // lap the instruction is next reviewed / ends
    }
  | { state: 'recent'; recent: RecentDecision }
  | { state: 'monitoring' };

export function driverPanelCell(
  driverId: string,
  recs: AnalyticsRecommendation[],
  recent: RecentDecision[],
  currentLap: number,
): DriverPanelCell {
  const pending = recs.find((r) => r.driverId === driverId && r.status === 'pending');
  if (pending) return { state: 'decision', rec: pending };

  const active = recs.find((r) => r.driverId === driverId && r.status === 'active');
  if (active) {
    const reviewLap = active.appliedUntilLap ?? null;
    const remaining = reviewLap != null ? Math.max(0, reviewLap - currentLap) : null;
    const total =
      active.suggestedDurationLaps ??
      (reviewLap != null ? Math.max(0, reviewLap - active.createdLap) : null);
    return { state: 'active', rec: active, remaining, total, reviewLap };
  }

  const cool = recent.find((r) => r.driverId === driverId && r.cooldownLapsRemaining > 0);
  if (cool) return { state: 'recent', recent: cool };

  return { state: 'monitoring' };
}

// Status colours for monitoring tiles (see UI):
//   green = safe/stable · yellow = watch · orange = warning · red = urgent
//   blue = weather/track change · purple = strategy opportunity
export type MonitorStatus = 'green' | 'yellow' | 'orange' | 'red' | 'blue' | 'purple';

export type MonitorTile = {
  key: 'gap' | 'tyre' | 'reliability' | 'fuel' | 'strategy' | 'traffic' | 'weather';
  label: string;
  value: string;
  status: MonitorStatus;
};

export type DriverMonitor = {
  driverId: string;
  position: number | null;
  confidenceScore: number;
  trustInTeam: number;
  trustInCar: number;
  teamTrustInDriver: number;
  focus: string; // primary thing the analytics team is watching
  focusLabel: string; // 1-3 word label of that focus (compact panel)
  strategyRead: string; // current plan read
  nextTrigger: string; // what would re-open a recommendation
  triggerShort: string; // the single most relevant trigger clause (compact panel)
  tiles: MonitorTile[];
};

// A recently ignored/expired recommendation still on cooldown, so the panel can
// explain why the same advice is not reappearing yet.
export type RecentDecision = {
  driverId: string;
  kind: string;
  lap: number;
  issue: string;
  cooldownLapsRemaining: number;
};

export type AnalyticsMonitor = {
  headline: string; // the single most useful thing to show at the top
  confidence: number; // 0-100 overall analytics confidence
  drivers: DriverMonitor[];
  recent: RecentDecision[];
};

// A finite number or a fallback (guards against undefined / NaN in maths).
function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function fmtGap(seconds: number): string {
  const s = num(seconds);
  return `${s >= 0 ? '+' : ''}${s.toFixed(1)}s`;
}

const RISK_STATUS: Record<string, MonitorStatus> = {
  Low: 'green',
  Medium: 'yellow',
  Elevated: 'orange',
  High: 'orange',
  Critical: 'red',
};

// Human label for a recommendation kind (used in the cooldown/recent line).
const KIND_LABEL: Record<string, string> = {
  attack: 'Attack',
  defend: 'Defend',
  crash: 'Crash Risk',
  reliability: 'Reliability',
  component: 'Component Health',
  damage: 'Damage',
  pointsHold: 'Points Hold',
  tyres: 'Tyre',
  fuel: 'Fuel Save',
  teammate: 'Team Orders',
  safetyCarPit: 'Safety Car Pit',
  weatherTyres: 'Wet Tyres',
  pitWindow: 'Pit Window',
};

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? 'Strategy';
}

// Interval (s) to the car directly behind a given car in the running order.
function gapBehind(car: LiveCarState, running: LiveCarState[]): number {
  const idx = running.findIndex((c) => c.driverId === car.driverId);
  if (idx < 0 || idx + 1 >= running.length) return 0;
  return num(running[idx + 1].interval);
}

function gapTile(car: LiveCarState, behind: number): MonitorTile {
  const ahead = num(car.interval);
  const pos = car.position ?? 99;
  const underPressure = behind > 0 && behind < DIRTY_AIR_GAP;
  const closing = pos > 1 && ahead > 0 && ahead < DIRTY_AIR_GAP;
  if (underPressure) {
    return { key: 'gap', label: 'Gap Watch', value: `${fmtGap(behind)} behind — under pressure`, status: 'orange' };
  }
  if (closing) {
    return { key: 'gap', label: 'Gap Watch', value: `${fmtGap(ahead)} to car ahead — closing`, status: 'purple' };
  }
  if (pos > 1 && ahead > 0) {
    return { key: 'gap', label: 'Gap Watch', value: `${fmtGap(ahead)} to car ahead`, status: 'green' };
  }
  return { key: 'gap', label: 'Gap Watch', value: 'Clear air', status: 'green' };
}

function tyreTile(car: LiveCarState): MonitorTile {
  const wear = num(car.tire.wear);
  const stopsLeft = num(car.pit.plannedStops) - num(car.pit.stopsMade);
  const status: MonitorStatus = wear >= 82 ? 'red' : wear >= 60 ? 'orange' : wear >= 45 ? 'yellow' : 'green';
  if (car.pit.window && stopsLeft > 0) {
    return {
      key: 'tyre',
      label: 'Tyre Forecast',
      value: `Window L${car.pit.window.open}-${car.pit.window.close} · ${Math.round(wear)}% wear`,
      status,
    };
  }
  if (stopsLeft <= 0) {
    return { key: 'tyre', label: 'Tyre Forecast', value: `No more stops · ${Math.round(wear)}% wear`, status };
  }
  return { key: 'tyre', label: 'Tyre Forecast', value: `${Math.round(wear)}% wear`, status };
}

function reliabilityTile(car: LiveCarState): MonitorTile {
  const level = car.reliabilityRiskLevel ?? 'Low';
  const status = RISK_STATUS[level] ?? 'green';
  const eng = num(car.engineHealth, 100);
  const gear = num(car.gearboxHealth, 100);
  const brake = num(car.brakeHealth, 100);
  const min = Math.min(eng, gear, brake);
  const worst = min === eng ? 'Engine' : min === gear ? 'Gearbox' : 'Brakes';
  const value =
    level === 'Low'
      ? 'All systems stable'
      : car.reliabilityIssue
        ? `${car.reliabilityIssue.label} — ${level}`
        : `${worst} stress — ${level}`;
  return { key: 'reliability', label: 'Reliability Watch', value, status };
}

function fuelTile(car: LiveCarState, state: LiveRaceState): MonitorTile {
  const fuel = num(car.fuel, 100);
  const total = Math.max(1, num(state.totalLaps, 1));
  const lap = num(state.currentLap);
  // Expected fuel if burning evenly across the distance (100 at start → 0 at flag).
  const expected = Math.max(0, 100 * (1 - lap / total));
  const delta = fuel - expected;
  if (delta < -6) return { key: 'fuel', label: 'Fuel Target', value: 'Saving needed', status: 'orange' };
  if (delta > 6) return { key: 'fuel', label: 'Fuel Target', value: 'Slightly high', status: 'yellow' };
  return { key: 'fuel', label: 'Fuel Target', value: 'On plan', status: 'green' };
}

function strategyTile(car: LiveCarState): MonitorTile {
  switch (car.paceMode) {
    case 'Attack':
    case 'Push':
      return { key: 'strategy', label: 'Strategy Bias', value: 'Attack', status: 'purple' };
    case 'Defend':
      return { key: 'strategy', label: 'Strategy Bias', value: 'Protect', status: 'yellow' };
    case 'Conservative':
      return { key: 'strategy', label: 'Strategy Bias', value: 'Conserve', status: 'blue' };
    case 'ProtectEngine':
      return { key: 'strategy', label: 'Strategy Bias', value: 'Nurse car', status: 'blue' };
    default:
      return { key: 'strategy', label: 'Strategy Bias', value: 'Hold', status: 'green' };
  }
}

function trafficTile(car: LiveCarState): MonitorTile {
  switch (car.trafficStatus) {
    case 'Attacking':
      return { key: 'traffic', label: 'Traffic Watch', value: 'On the attack', status: 'purple' };
    case 'Defending':
      return { key: 'traffic', label: 'Traffic Watch', value: 'Under pressure', status: 'orange' };
    case 'InTraffic':
      return { key: 'traffic', label: 'Traffic Watch', value: 'Closing pack', status: 'yellow' };
    default:
      return { key: 'traffic', label: 'Traffic Watch', value: 'Clear air', status: 'green' };
  }
}

function weatherTile(state: LiveRaceState): MonitorTile {
  if (state.weather.wet) {
    return { key: 'weather', label: 'Weather Watch', value: state.weather.label, status: 'blue' };
  }
  if (state.weather.changingSoon) {
    return { key: 'weather', label: 'Weather Watch', value: `${state.weather.label} · change risk`, status: 'blue' };
  }
  return { key: 'weather', label: 'Weather Watch', value: `${state.weather.label} · stable`, status: 'green' };
}

// The single most useful monitoring line for a driver, following the priority
// order in the spec (upcoming pit window → tyre deg → fuel → reliability → gap →
// traffic → weather → safety car → all stable).
function driverFocus(car: LiveCarState, state: LiveRaceState, behind: number): string {
  const wear = num(car.tire.wear);
  const stopsLeft = num(car.pit.plannedStops) - num(car.pit.stopsMade);
  const ahead = num(car.interval);
  if (state.safetyCar.active) return 'Safety car deployed — evaluating a cheap stop opportunity.';
  if (car.pit.window && stopsLeft > 0 && !car.pit.planCancelled) {
    const lapsToOpen = car.pit.window.open - num(state.currentLap);
    if (lapsToOpen > 0 && lapsToOpen <= 5)
      return `Estimated pit window opens in ${lapsToOpen} lap${lapsToOpen === 1 ? '' : 's'} (L${car.pit.window.open}-${car.pit.window.close}).`;
  }
  if (wear >= 60 && stopsLeft > 0) return `Watching tyre wear at ${Math.round(wear)}%; pit window approaching.`;
  if (num(car.fuel, 100) < 14) return `Fuel margin tight at ${Math.round(num(car.fuel))}%; fuel save may be advised.`;
  if (car.reliabilityRiskLevel !== 'Low')
    return car.reliabilityIssue
      ? `${car.reliabilityIssue.label} — reliability risk ${car.reliabilityRiskLevel}. No action required yet.`
      : `Reliability risk ${car.reliabilityRiskLevel}. Monitoring the car.`;
  if (behind > 0 && behind < DIRTY_AIR_GAP) return `Under pressure — car behind ${fmtGap(behind)} and looking for a way past.`;
  if ((car.position ?? 99) > 1 && ahead > 0 && ahead < DIRTY_AIR_GAP)
    return `Closing on the car ahead, ${fmtGap(ahead)}. Attack possible if the gap falls below 0.5s.`;
  if (car.trafficStatus === 'InTraffic') return 'Running in traffic; managing dirty air.';
  if (state.weather.changingSoon) return `${state.weather.label} — possible weather change on the way.`;
  return 'All systems stable. Current strategy remains on target.';
}

// A compact 1-3 word label of the driver's primary focus, mirroring the
// priority order of `driverFocus` (used in the compact panel's monitoring cell).
function driverFocusLabel(car: LiveCarState, state: LiveRaceState, behind: number): string {
  const wear = num(car.tire.wear);
  const stopsLeft = num(car.pit.plannedStops) - num(car.pit.stopsMade);
  const ahead = num(car.interval);
  if (state.safetyCar.active) return 'Safety car';
  if (car.pit.window && stopsLeft > 0 && !car.pit.planCancelled) {
    const lapsToOpen = car.pit.window.open - num(state.currentLap);
    if (lapsToOpen > 0 && lapsToOpen <= 5) return 'Pit window';
  }
  if (wear >= 60 && stopsLeft > 0) return 'Tyre window';
  if (num(car.fuel, 100) < 14) return 'Fuel margin';
  if (car.reliabilityRiskLevel !== 'Low') return 'Reliability';
  if (behind > 0 && behind < DIRTY_AIR_GAP) return 'Under pressure';
  if ((car.position ?? 99) > 1 && ahead > 0 && ahead < DIRTY_AIR_GAP) return 'Gap ahead';
  if (car.trafficStatus === 'InTraffic') return 'Traffic watch';
  if (state.weather.changingSoon) return 'Weather watch';
  return 'On plan';
}

// The single most relevant re-trigger clause (compact panel's "next trigger").
function triggerShort(car: LiveCarState, behind: number): string {
  const stopsLeft = num(car.pit.plannedStops) - num(car.pit.stopsMade);
  const ahead = num(car.interval);
  if ((behind > 0 && behind < DIRTY_AIR_GAP * 1.5) || ((car.position ?? 99) > 1 && ahead > 0 && ahead < DIRTY_AIR_GAP * 1.5))
    return 'gap < 0.5s';
  if (stopsLeft > 0) return 'tyre wear > 60%';
  if (num(car.fuel, 100) < 25) return 'fuel below target';
  if (car.reliabilityRiskLevel === 'Low') return 'reliability rises';
  return 'conditions change';
}

function strategyRead(car: LiveCarState): string {
  const stopsLeft = num(car.pit.plannedStops) - num(car.pit.stopsMade);
  const plan = strategyTile(car).value;
  if (car.pit.planCancelled) return `Planned stop cancelled — running to the flag unless tyres/rules force a stop. Current plan: ${plan}.`;
  if (car.pit.window && stopsLeft > 0) {
    return `Projected tyre window: Lap ${car.pit.window.open}-${car.pit.window.close}. Current plan: ${plan}.`;
  }
  if (stopsLeft <= 0) return `No further stops planned. Current plan: ${plan}.`;
  return `No immediate action required. Current plan: ${plan}.`;
}

function nextTrigger(car: LiveCarState, behind: number): string {
  const stopsLeft = num(car.pit.plannedStops) - num(car.pit.stopsMade);
  const parts: string[] = [];
  const ahead = num(car.interval);
  if ((behind > 0 && behind < DIRTY_AIR_GAP * 1.5) || ((car.position ?? 99) > 1 && ahead > 0 && ahead < DIRTY_AIR_GAP * 1.5))
    parts.push('gap falls below 0.5s');
  if (stopsLeft > 0) parts.push('tyre wear exceeds 60%');
  if (car.reliabilityRiskLevel === 'Low') parts.push('reliability risk rises');
  if (num(car.fuel, 100) < 25) parts.push('fuel drops below target');
  if (parts.length === 0) parts.push('conditions or strategy change');
  return `Reassess if ${parts.slice(0, 2).join(' or ')}.`;
}

// Build the full monitoring intelligence for the panel's idle state. `seatOrderIds`
// keeps the driver rows in the fixed team seat order (matching the pit-wall cards).
export function buildAnalyticsMonitor(state: LiveRaceState, seatOrderIds: string[] = []): AnalyticsMonitor {
  const running = state.cars
    .filter((c) => c.running)
    .slice()
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));

  const playerCars = state.cars.filter((c) => c.isPlayer && c.running);
  const ordered = seatOrderIds.length
    ? seatOrderIds
        .map((id) => playerCars.find((c) => c.driverId === id))
        .filter((c): c is LiveCarState => !!c)
    : playerCars;

  const drivers: DriverMonitor[] = ordered.map((car) => {
    const behind = gapBehind(car, running);
    const rel = state.driverRelationships?.[car.driverId];
    return {
      driverId: car.driverId,
      position: car.position,
      confidenceScore: rel ? overallConfidenceScore(rel) : 50,
      trustInTeam: rel?.trustInTeam ?? 50,
      trustInCar: rel?.trustInCar ?? 50,
      teamTrustInDriver: rel?.teamTrustInDriver ?? 50,
      focus: driverFocus(car, state, behind),
      focusLabel: driverFocusLabel(car, state, behind),
      strategyRead: strategyRead(car),
      nextTrigger: nextTrigger(car, behind),
      triggerShort: triggerShort(car, behind),
      tiles: [
        gapTile(car, behind),
        tyreTile(car),
        reliabilityTile(car),
        fuelTile(car, state),
        strategyTile(car),
        trafficTile(car),
        weatherTile(state),
      ],
    };
  });

  // Headline: the most salient (least "stable") driver focus, else all-stable.
  const salient = drivers.find((d) => !d.focus.startsWith('All systems stable'));
  const headline = salient ? salient.focus : 'All systems stable. Current strategy remains on target.';

  // Overall confidence: high when the picture is clear, lower in changeable
  // weather / safety-car chaos where the read is less certain.
  let confidence = 86;
  if (state.weather.changingSoon || state.weather.wet) confidence -= 12;
  if (state.safetyCar.active) confidence -= 10;
  confidence = Math.max(40, Math.min(95, confidence));

  // Recent decisions still on cooldown (ignored/expired), newest first.
  const lap = num(state.currentLap);
  const recent: RecentDecision[] = state.ignoredRecs
    .map((i) => {
      const [driverId, kind] = i.key.split(':');
      const reRaiseLap = state.recCooldowns[i.key];
      const cooldownLapsRemaining = reRaiseLap != null ? Math.max(0, reRaiseLap - lap) : Math.max(0, cooldownFor(kind) - (lap - i.lap));
      return { driverId, kind, lap: i.lap, issue: i.issue, cooldownLapsRemaining };
    })
    .filter((r) => r.cooldownLapsRemaining > 0)
    .sort((a, b) => b.lap - a.lap);

  return { headline, confidence, drivers, recent };
}
