import { useCallback, useState } from 'react';
import type { GameState } from '../../game/careerState';
import { LIVE_PACE_K, modeSpec } from '../../sim/liveRacePace';
import { pitIntensitySpec } from '../../sim/pitIntensityData';
import type {
  AnalyticsRecommendation,
  LiveCarState,
  LiveRaceState,
  PaceMode,
  PitIntensity,
} from '../../types/liveTypes';
import { staffResponsibilities, staffResponsibilityPolicy } from '../staffResponsibilitiesViewModel';

export type LiveRaceViewMode = 'track' | 'data';
export type LiveRacePanelId =
  | 'timing'
  | 'analytics'
  | 'pit-wall'
  | 'events'
  | 'engineer-summary'
  | 'telemetry';

export type LiveRaceAutoPauseSettings = {
  incidents: boolean;
  pitWindows: boolean;
  weatherChanges: boolean;
  mechanicalProblems: boolean;
  engineerMessages: boolean;
};

export type LiveRaceWorkspacePreferences = {
  version: 1;
  viewMode: LiveRaceViewMode;
  strategyDrawerOpen: boolean;
  panelOrder: LiveRacePanelId[];
  hiddenPanels: LiveRacePanelId[];
  autoPause: LiveRaceAutoPauseSettings;
};

export const LIVE_RACE_PANEL_LABELS: Record<LiveRacePanelId, string> = {
  timing: 'Live Timing',
  analytics: 'Analytics & Recommendations',
  'pit-wall': 'Pit Wall',
  events: 'Race Events',
  'engineer-summary': 'Engineer Summary',
  telemetry: 'Telemetry',
};

export const DEFAULT_LIVE_RACE_WORKSPACE_PREFERENCES: LiveRaceWorkspacePreferences = {
  version: 1,
  viewMode: 'track',
  strategyDrawerOpen: true,
  panelOrder: ['timing', 'analytics', 'pit-wall', 'events', 'engineer-summary', 'telemetry'],
  hiddenPanels: [],
  autoPause: {
    incidents: true,
    pitWindows: true,
    weatherChanges: true,
    mechanicalProblems: true,
    engineerMessages: true,
  },
};

const STORAGE_PREFIX = 'msm-live-race-workspace-v1';
const PANEL_IDS = new Set<LiveRacePanelId>(DEFAULT_LIVE_RACE_WORKSPACE_PREFERENCES.panelOrder);

function sanitize(raw: unknown): LiveRaceWorkspacePreferences {
  if (!raw || typeof raw !== 'object') return cloneDefaults();
  const input = raw as Partial<LiveRaceWorkspacePreferences>;
  const order = Array.isArray(input.panelOrder)
    ? [...new Set(input.panelOrder.filter((value): value is LiveRacePanelId =>
        typeof value === 'string' && PANEL_IDS.has(value as LiveRacePanelId),
      ))]
    : [];
  const missing = DEFAULT_LIVE_RACE_WORKSPACE_PREFERENCES.panelOrder.filter((id) => !order.includes(id));
  const hiddenPanels = Array.isArray(input.hiddenPanels)
    ? [...new Set(input.hiddenPanels.filter((value): value is LiveRacePanelId =>
        typeof value === 'string' && PANEL_IDS.has(value as LiveRacePanelId),
      ))]
    : [];
  const autoPause = input.autoPause && typeof input.autoPause === 'object'
    ? input.autoPause as Partial<LiveRaceAutoPauseSettings>
    : {};
  return {
    version: 1,
    viewMode: input.viewMode === 'data' ? 'data' : 'track',
    strategyDrawerOpen: input.strategyDrawerOpen !== false,
    panelOrder: [...order, ...missing],
    hiddenPanels,
    autoPause: {
      incidents: autoPause.incidents !== false,
      pitWindows: autoPause.pitWindows !== false,
      weatherChanges: autoPause.weatherChanges !== false,
      mechanicalProblems: autoPause.mechanicalProblems !== false,
      engineerMessages: autoPause.engineerMessages !== false,
    },
  };
}

function cloneDefaults(): LiveRaceWorkspacePreferences {
  return {
    ...DEFAULT_LIVE_RACE_WORKSPACE_PREFERENCES,
    panelOrder: [...DEFAULT_LIVE_RACE_WORKSPACE_PREFERENCES.panelOrder],
    hiddenPanels: [],
    autoPause: { ...DEFAULT_LIVE_RACE_WORKSPACE_PREFERENCES.autoPause },
  };
}

export function liveRaceWorkspaceStorageKey(careerId: string): string {
  return `${STORAGE_PREFIX}:${careerId}`;
}

export function loadLiveRaceWorkspacePreferences(careerId: string): LiveRaceWorkspacePreferences {
  if (typeof localStorage === 'undefined') return cloneDefaults();
  try {
    const raw = localStorage.getItem(liveRaceWorkspaceStorageKey(careerId));
    return raw ? sanitize(JSON.parse(raw)) : cloneDefaults();
  } catch {
    return cloneDefaults();
  }
}

export function saveLiveRaceWorkspacePreferences(
  careerId: string,
  preferences: LiveRaceWorkspacePreferences,
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(liveRaceWorkspaceStorageKey(careerId), JSON.stringify(sanitize(preferences)));
  } catch {
    // Race display preferences are optional and must never interrupt a career.
  }
}

export function useLiveRaceWorkspacePreferences(careerId: string) {
  const [preferences, setPreferencesState] = useState(() => loadLiveRaceWorkspacePreferences(careerId));
  const setPreferences = useCallback((
    update: LiveRaceWorkspacePreferences
      | ((current: LiveRaceWorkspacePreferences) => LiveRaceWorkspacePreferences),
  ) => {
    setPreferencesState((current) => {
      const next = sanitize(typeof update === 'function' ? update(current) : update);
      saveLiveRaceWorkspacePreferences(careerId, next);
      return next;
    });
  }, [careerId]);
  const resetPreferences = useCallback(() => {
    const defaults = cloneDefaults();
    saveLiveRaceWorkspacePreferences(careerId, defaults);
    setPreferencesState(defaults);
  }, [careerId]);
  return { preferences, setPreferences, resetPreferences };
}

export function moveLiveRacePanel(
  order: LiveRacePanelId[],
  panel: LiveRacePanelId,
  offset: -1 | 1,
): LiveRacePanelId[] {
  const index = order.indexOf(panel);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export type LiveRaceStrategyProjection = {
  pace: string;
  fuel: string;
  tires: string;
  pitTiming: string;
  risk: string;
  confidence: string;
};

export function buildLiveRaceStrategyProjection(
  car: LiveCarState,
  live: Pick<LiveRaceState, 'currentLap' | 'safetyCar'>,
  next: { intensity: PitIntensity; exitMode: PaceMode },
): LiveRaceStrategyProjection {
  const currentMode = modeSpec(car.paceMode);
  const nextMode = modeSpec(next.exitMode);
  const paceDeltaSeconds = -(nextMode.paceDelta - currentMode.paceDelta) * LIVE_PACE_K;
  const wearDelta = car.tireDegRate * (nextMode.wearMult - currentMode.wearMult);
  const currentIntensity = pitIntensitySpec(car.pit.intensity ?? car.pit.intensityDefault ?? 'Standard');
  const nextIntensity = pitIntensitySpec(next.intensity);
  const stopDelta = nextIntensity.stationaryDelta - currentIntensity.stationaryDelta;
  const pitLoss = live.safetyCar.active ? car.pitLossBase * 0.4 : car.pitLossBase;
  const riskMultiplier = Math.max(nextMode.reliabilityMult, nextMode.crashMult);
  const riskDirection = riskMultiplier > 1.05 ? 'Higher' : riskMultiplier < 0.95 ? 'Lower' : 'Similar';
  const pitWindow = car.pit.window;
  return {
    pace: formatSignedSeconds(paceDeltaSeconds, 'per representative lap'),
    fuel: 'No modeled fuel-use change',
    tires: formatSigned(wearDelta, ' wear points per lap'),
    pitTiming: car.pit.pitRequested
      ? `Box call active · about ${pitLoss.toFixed(1)}s race-time loss`
      : pitWindow
        ? `Window L${pitWindow.open}-${pitWindow.close} · ideal L${pitWindow.ideal}`
        : `Box on request · about ${pitLoss.toFixed(1)}s race-time loss`,
    risk: `${riskDirection} mode risk · stop execution ${formatSignedSeconds(stopDelta, 'stationary')}`,
    confidence: live.safetyCar.active
      ? 'High confidence in reduced pit-lane loss; on-track recovery remains uncertain.'
      : live.currentLap < 2
        ? 'Medium confidence until representative race laps are recorded.'
        : 'Projection uses the active deterministic pace, wear, and pit models.',
  };
}

function formatSignedSeconds(value: number, suffix: string): string {
  if (Math.abs(value) < 0.005) return `No modeled change ${suffix}`;
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}s ${suffix}`;
}

function formatSigned(value: number, suffix: string): string {
  if (Math.abs(value) < 0.005) return `No modeled change${suffix}`;
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}${suffix}`;
}

export function liveRaceAutoPauseReason(
  previous: LiveRaceState,
  next: LiveRaceState,
  settings: LiveRaceAutoPauseSettings,
): string | null {
  if (settings.incidents && (
    next.lastIncident?.lap !== previous.lastIncident?.lap
    || next.events.slice(previous.events.length).some((event) => event.category === 'incident')
  )) {
    return 'Paused for a new incident';
  }
  if (settings.weatherChanges && (
    next.weather.condition !== previous.weather.condition
    || next.weather.wet !== previous.weather.wet
  )) {
    return `Paused for weather change: ${next.weather.label}`;
  }
  if (settings.mechanicalProblems && next.cars.some((car) => {
    const before = previous.cars.find((candidate) => candidate.driverId === car.driverId);
    return car.isPlayer && car.reliabilityIssue && !before?.reliabilityIssue;
  })) {
    return 'Paused for a new mechanical problem';
  }
  if (settings.pitWindows && next.cars.some((car) => {
    if (!car.isPlayer || !car.pit.window || car.pit.pitRequested) return false;
    return next.currentLap >= car.pit.window.open
      && previous.currentLap < car.pit.window.open;
  })) {
    return 'Paused as a player pit window opened';
  }
  if (settings.engineerMessages) {
    const previousIds = new Set(previous.recommendations.map((rec) => rec.id));
    const important = next.recommendations.find((rec) =>
      !previousIds.has(rec.id) && (rec.priority === 'high' || rec.priority === 'urgent'),
    );
    if (important) return `Paused for ${important.priority} priority engineer advice`;
  }
  return null;
}

export type LiveRaceDelegationProfile = {
  policy: ReturnType<typeof staffResponsibilityPolicy>;
  owner: string;
  confidence: number;
  confidenceLabel: 'Low' | 'Normal' | 'High';
};

export function liveRaceDelegationProfile(state: GameState): LiveRaceDelegationProfile {
  const responsibility = staffResponsibilities(state).find((item) => item.id === 'race-strategy');
  return {
    policy: staffResponsibilityPolicy(state, 'race-strategy'),
    owner: responsibility?.owner ?? 'Strategist department',
    confidence: responsibility?.confidence ?? 50,
    confidenceLabel: responsibility?.confidenceLabel ?? 'Low',
  };
}

export function canDelegateLiveRaceRecommendation(
  rec: AnalyticsRecommendation,
  profile: LiveRaceDelegationProfile,
): boolean {
  if (profile.policy !== 'staff_execute_routine' || profile.confidenceLabel === 'Low') return false;
  if (rec.priority === 'high' || rec.priority === 'urgent') return false;
  if (rec.confidence < 70 || rec.action.teamOrder) return false;
  if (rec.kind.toLowerCase().includes('reliability') || rec.kind.toLowerCase().includes('weather')) return false;
  return true;
}

export type EngineerCheckpointSummary = {
  checkpoint: 'Opening laps' | 'Quarter distance' | 'Half distance' | 'Final quarter' | 'Chequered flag';
  headline: string;
  bullets: string[];
};

export function buildEngineerCheckpointSummary(
  live: LiveRaceState,
  playerCars: LiveCarState[],
): EngineerCheckpointSummary {
  const progress = live.totalLaps > 0 ? live.currentLap / live.totalLaps : 0;
  const checkpoint = live.phase === 'finished'
    ? 'Chequered flag'
    : progress >= 0.75
      ? 'Final quarter'
      : progress >= 0.5
        ? 'Half distance'
        : progress >= 0.25
          ? 'Quarter distance'
          : 'Opening laps';
  const running = playerCars.filter((car) => car.running);
  const gained = running.reduce((sum, car) => sum + car.grid - (car.position ?? car.grid), 0);
  const weakest = running
    .flatMap((car) => [
      { driverId: car.driverId, label: 'engine', value: car.engineHealth },
      { driverId: car.driverId, label: 'gearbox', value: car.gearboxHealth },
      { driverId: car.driverId, label: 'brakes', value: car.brakeHealth },
    ])
    .sort((a, b) => a.value - b.value)[0];
  const nextWindow = running
    .flatMap((car) => car.pit.window ? [{ driverId: car.driverId, lap: car.pit.window.ideal }] : [])
    .sort((a, b) => a.lap - b.lap)[0];
  return {
    checkpoint,
    headline: running.length === 0
      ? 'No player car remains in the running.'
      : gained > 0
        ? `The team is ${gained} net place${gained === 1 ? '' : 's'} ahead of its grid baseline.`
        : gained < 0
          ? `The team is ${Math.abs(gained)} net place${gained === -1 ? '' : 's'} behind its grid baseline.`
          : 'The team is holding its combined grid baseline.',
    bullets: [
      live.weather.wet ? 'Wet conditions keep tyre timing and visibility risk elevated.' : 'Track conditions are currently dry.',
      nextWindow ? `Next planned stop target is lap ${nextWindow.lap}.` : 'No further planned stop window is recorded.',
      weakest ? `Lowest recorded component is ${weakest.label} at ${Math.round(weakest.value)}%.` : 'No running-car component reading is available.',
    ],
  };
}

export function driverIdForRaceEvent(
  text: string,
  cars: readonly LiveCarState[],
  nameOf: (driverId: string) => string,
): string | null {
  const normalized = text.toLowerCase();
  return cars.find((car) => {
    const name = nameOf(car.driverId).toLowerCase();
    const parts = name.split(/\s+/).filter(Boolean);
    return normalized.includes(name)
      || (parts.length > 1 && normalized.includes(parts[parts.length - 1]));
  })?.driverId ?? null;
}
