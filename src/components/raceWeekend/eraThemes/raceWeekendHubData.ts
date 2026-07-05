import { activeDriversForTeam, carForTeam, teamById, type GameState } from '../../../game/careerState';
import { getRouteRestrictionReason, isRouteRestricted } from '../../../game/modeRestrictions';
import { getRegulationSet } from '../../../data';
import { effectiveCarRatings } from '../../../sim/trackFitEngine';
import { SESSION_LABELS, weekendSessionKinds } from '../../../sim/practiceProgramEngine';
import { formatMoney } from '../../ui';
import type { Race, RegulationSet, StandingsEntry } from '../../../types/gameTypes';
import type { WeekendForecast } from '../../../sim/weatherEngine';
import type {
  GarageTaskBoardItem,
  GarageHotspot,
  NextSessionAction,
  QuickAction,
  RaceWeekendHubAction,
  RaceWeekendHubCallbacks,
  WeekendScheduleItem,
  WeekendScheduleStatus,
} from './types';

const PRACTICE_TIMES: Record<string, string> = {
  Practice1: '09:00',
  Practice2: '13:00',
  Practice3: '09:00',
  Warmup: '10:00',
  QualifyingPrep: '11:00',
  RaceSimulation: '15:00',
};

export function selectedTeam(state: GameState) {
  return teamById(state, state.selectedTeamId);
}

export function teamRatingLabel(state: GameState): string {
  const orgRating = state.teamOrgRatings?.[state.selectedTeamId]?.overallTeamRating;
  if (orgRating != null) return String(Math.round(orgRating));
  const team = selectedTeam(state);
  if (!team) return 'N/A';
  return String(Math.round((team.reputation + team.raceOperations * 10) / 2));
}

export function teamMoraleLabel(morale: number | undefined): string {
  if (morale == null) return 'Unknown';
  if (morale >= 80) return 'Excellent';
  if (morale >= 65) return 'Confident';
  if (morale >= 45) return 'Stable';
  if (morale >= 25) return 'Tense';
  return 'Critical';
}

export function raceDistanceKm(race: Pick<Race, 'distanceKm' | 'laps'>): string {
  return race.distanceKm != null ? `${race.distanceKm.toFixed(1)} km` : `${race.laps} laps`;
}

export function circuitLengthKm(race: Pick<Race, 'distanceKm' | 'laps'>): string {
  if (race.distanceKm == null || !race.laps) return 'N/A';
  return `${(race.distanceKm / race.laps).toFixed(3)} km`;
}

export function countryCode(country: string | undefined): string {
  if (!country) return 'INT';
  return country
    .split(/[\s,-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

export function completedPracticeKinds(state: GameState, raceId: string): Set<string> {
  const wp = state.weekendPractice?.raceId === raceId ? state.weekendPractice : undefined;
  return new Set((wp?.sessions ?? []).filter((s) => s.completed).map((s) => s.kind));
}

function itemStatus(
  completed: boolean,
  currentId: string,
  id: string,
  lockedReason?: string,
): WeekendScheduleStatus {
  if (completed) return 'completed';
  if (lockedReason) return 'locked';
  if (currentId === id) return 'current';
  return 'upcoming';
}

export function buildRaceWeekendSchedule(
  state: GameState,
  race: Race,
  isMinPackage: boolean,
  hasQualifyingResults: boolean,
): WeekendScheduleItem[] {
  const completedPractice = completedPracticeKinds(state, race.id);
  const practiceKinds = weekendSessionKinds(state.seasonYear, state.series);
  const openPractice = practiceKinds.find((kind) => !completedPractice.has(kind));
  const weekendWorkStarted = completedPractice.size > 0 || hasQualifyingResults || race.completed;
  const currentId = !weekendWorkStarted
    ? 'pre-race'
    : !isMinPackage && openPractice
    ? openPractice
    : !hasQualifyingResults
    ? 'qualifying'
    : race.completed
    ? 'none'
    : 'race';

  const items: WeekendScheduleItem[] = [
    {
      id: 'pre-race',
      day: 'Thursday',
      label: 'Pre-Race Brief',
      time: 'Ready',
      status: itemStatus(weekendWorkStarted, currentId, 'pre-race'),
      action: { type: 'phase', phase: 'briefing' },
    },
  ];

  for (const kind of practiceKinds) {
    const day = kind === 'Warmup' ? 'Sunday' : kind === 'Practice3' ? 'Saturday' : 'Friday';
    const lockedReason = isMinPackage ? 'Disabled by Minimum Operations package.' : undefined;
    items.push({
      id: kind,
      day,
      label: SESSION_LABELS[kind],
      time: PRACTICE_TIMES[kind] ?? 'TBA',
      status: itemStatus(completedPractice.has(kind), currentId, kind, lockedReason),
      action: { type: 'phase', phase: 'practice' },
      lockedReason,
    });
  }

  items.push({
    id: 'qualifying',
    day: 'Saturday',
    label: 'Qualifying',
    time: '13:00',
    status: itemStatus(hasQualifyingResults, currentId, 'qualifying'),
    action: { type: 'phase', phase: hasQualifyingResults ? 'quali-review' : 'quali-run' },
  });
  const raceLockedReason = hasQualifyingResults ? undefined : 'Race strategy opens after qualifying is complete.';
  items.push({
    id: 'race',
    day: 'Sunday',
    label: 'Race',
    time: '14:00',
    status: itemStatus(race.completed, currentId, 'race', raceLockedReason),
    action: { type: 'phase', phase: 'race-strategy' },
    lockedReason: raceLockedReason,
  });

  return items;
}

export function buildNextSessionAction(
  state: GameState,
  race: Race,
  isMinPackage: boolean,
  hasQualifyingResults: boolean,
): NextSessionAction {
  if (race.completed) {
    return {
      sessionName: 'Race Complete',
      detail: 'Awaiting post-race review',
      primaryLabel: 'COMPLETED',
      disabledReason: 'This race has already been completed.',
    };
  }

  const completedPractice = completedPracticeKinds(state, race.id);
  const practiceKinds = weekendSessionKinds(state.seasonYear, state.series);
  const openPractice = practiceKinds.find((kind) => !completedPractice.has(kind));
  const weekendWorkStarted = completedPractice.size > 0 || hasQualifyingResults || race.completed;

  if (!weekendWorkStarted) {
    return {
      sessionName: 'Pre-Race Brief',
      detail: 'Review track demands, weather, package and race notes',
      primaryLabel: 'OPEN BRIEF',
      action: { type: 'phase', phase: 'briefing' },
    };
  }

  if (!isMinPackage && openPractice) {
    return {
      sessionName: SESSION_LABELS[openPractice],
      detail: 'Ready for the next running plan',
      primaryLabel: 'START PRACTICE',
      action: { type: 'phase', phase: 'practice' },
    };
  }

  if (!hasQualifyingResults) {
    return {
      sessionName: isMinPackage ? 'Qualifying' : 'Car Setup',
      detail: isMinPackage ? 'Minimum operations sends the car straight to qualifying prep' : 'Final tune before qualifying',
      primaryLabel: isMinPackage ? 'START QUALIFYING' : 'FINALIZE SETUP',
      action: { type: 'phase', phase: isMinPackage ? 'quali-run' : 'setup' },
    };
  }

  return {
    sessionName: 'Race',
    detail: 'Grid set. Confirm race strategy and driver instructions',
    primaryLabel: 'OPEN STRATEGY',
    action: { type: 'phase', phase: 'race-strategy' },
  };
}

export function buildGarageTaskBoard(
  state: GameState,
  race: Race,
  isMinPackage: boolean,
  hasQualifyingResults: boolean,
): GarageTaskBoardItem[] {
  const completedPractice = completedPracticeKinds(state, race.id);
  const practiceKinds = weekendSessionKinds(state.seasonYear, state.series);
  const allPracticeComplete = practiceKinds.length > 0 && practiceKinds.every((kind) => completedPractice.has(kind));
  const anyPracticeComplete = completedPractice.size > 0;
  const weekendWorkStarted = anyPracticeComplete || hasQualifyingResults || race.completed;
  const briefingStatus = weekendWorkStarted ? 'completed' : 'current';
  const practiceStatus: GarageTaskBoardItem['status'] = isMinPackage
    ? 'locked'
    : allPracticeComplete
    ? 'completed'
    : briefingStatus === 'current'
    ? 'upcoming'
    : 'current';
  const setupStatus: GarageTaskBoardItem['status'] = isMinPackage
    ? 'locked'
    : hasQualifyingResults
    ? 'completed'
    : allPracticeComplete
    ? 'current'
    : 'upcoming';
  const qualifyingStatus: GarageTaskBoardItem['status'] = hasQualifyingResults
    ? 'completed'
    : isMinPackage || setupStatus === 'completed'
    ? 'current'
    : 'upcoming';
  const strategyStatus: GarageTaskBoardItem['status'] = hasQualifyingResults
    ? race.completed
      ? 'completed'
      : 'current'
    : 'locked';
  const instructionsStatus: GarageTaskBoardItem['status'] = hasQualifyingResults
    ? race.completed
      ? 'completed'
      : 'upcoming'
    : 'locked';

  return [
    {
      id: 'briefing',
      label: 'Pre-Race Brief',
      detail: 'Track, weather and race package readout',
      status: briefingStatus,
      action: { type: 'phase', phase: 'briefing' },
    },
    {
      id: 'practice',
      label: 'Practice',
      detail: isMinPackage ? 'Disabled by Minimum Operations' : `${completedPractice.size}/${practiceKinds.length} sessions complete`,
      status: practiceStatus,
      action: isMinPackage ? undefined : { type: 'phase', phase: 'practice' },
      lockedReason: isMinPackage ? 'Disabled by Minimum Operations package.' : undefined,
    },
    {
      id: 'setup',
      label: 'Car Setup',
      detail: isMinPackage ? 'Baseline setup only' : allPracticeComplete ? 'Ready for final tune' : 'Opens after practice data',
      status: setupStatus,
      action: isMinPackage ? undefined : { type: 'phase', phase: 'setup' },
      lockedReason: isMinPackage ? 'Minimum Operations locks setup changes.' : undefined,
    },
    {
      id: 'quali-run',
      label: 'Qualifying',
      detail: hasQualifyingResults ? 'Grid review available' : 'Run plan and qualifying simulation',
      status: qualifyingStatus,
      action: { type: 'phase', phase: hasQualifyingResults ? 'quali-review' : 'quali-run' },
    },
    {
      id: 'race-strategy',
      label: 'Strategy',
      detail: hasQualifyingResults ? 'Pit, fuel and tyre plan' : 'Locked until qualifying is complete',
      status: strategyStatus,
      action: hasQualifyingResults ? { type: 'phase', phase: 'race-strategy' } : undefined,
      lockedReason: hasQualifyingResults ? undefined : 'Race strategy opens after qualifying is complete.',
    },
    {
      id: 'race-instructions',
      label: 'Race Orders',
      detail: hasQualifyingResults ? 'Driver instructions before lights out' : 'Locked until qualifying is complete',
      status: instructionsStatus,
      action: hasQualifyingResults ? { type: 'phase', phase: 'race-instructions' } : undefined,
      lockedReason: hasQualifyingResults ? undefined : 'Driver instructions open after qualifying is complete.',
    },
  ];
}

export function executeRaceWeekendHubAction(
  action: RaceWeekendHubAction | undefined,
  callbacks: RaceWeekendHubCallbacks,
): boolean {
  if (!action) return false;
  if (action.type === 'phase') callbacks.onPhase(action.phase);
  if (action.type === 'route') callbacks.onRoute(action.to);
  return true;
}

export function activateGarageHotspot(
  hotspot: GarageHotspot,
  callbacks: RaceWeekendHubCallbacks,
): boolean {
  if (hotspot.lockedReason) return false;
  return executeRaceWeekendHubAction(hotspot.action, callbacks);
}

export function buildF11990sGarageHotspots(args: {
  state: GameState;
  race: Race;
  isMinPackage: boolean;
  hasQualifyingResults: boolean;
}): GarageHotspot[] {
  const { state, race, isMinPackage, hasQualifyingResults } = args;
  const setupLocked = isMinPackage
    ? 'Minimum Operations locks setup and extra mechanical work.'
    : undefined;
  const next = buildNextSessionAction(state, race, isMinPackage, hasQualifyingResults);
  const strategyLocked = !hasQualifyingResults ? 'Race strategy opens after qualifying is complete.' : undefined;

  return [
    {
      id: 'engineering-desk',
      label: 'Engineering Desk',
      description: 'Car stats, telemetry and engineer feedback',
      x: 24,
      y: 22,
      action: { type: 'phase', phase: 'setup' },
      lockedReason: setupLocked,
    },
    {
      id: 'team-principal',
      label: 'Team Principal',
      description: 'Team goals, morale and management',
      x: 47,
      y: 18,
      action: { type: 'route', to: '/principal' },
    },
    {
      id: 'track-monitors',
      label: 'Track Monitors',
      description: 'Weather, track status and live timing',
      x: 60,
      y: 36,
      action: { type: 'phase', phase: 'briefing' },
    },
    {
      id: 'chief-mechanic',
      label: 'Chief Mechanic',
      description: 'Car setup, parts and mechanical issues',
      x: 72,
      y: 51,
      action: { type: 'phase', phase: 'setup' },
      lockedReason: setupLocked,
    },
    {
      id: 'car',
      label: 'Car',
      description: 'Practice, qualifying and race readiness',
      x: 38,
      y: 64,
      action: next.action ?? { type: 'phase', phase: 'briefing' },
      lockedReason: next.disabledReason,
    },
    {
      id: 'race-strategist',
      label: 'Race Strategist',
      description: 'Strategy, fuel, pit windows and forecast',
      x: 70,
      y: 75,
      action: { type: 'phase', phase: 'race-strategy' },
      lockedReason: strategyLocked,
    },
    {
      id: 'tyre-rack',
      label: 'Tyre Rack',
      description: 'Tyre selection and wear data',
      x: 20,
      y: 81,
      action: hasQualifyingResults ? { type: 'phase', phase: 'race-strategy' } : { type: 'phase', phase: 'practice' },
      lockedReason: hasQualifyingResults ? undefined : setupLocked,
    },
    {
      id: 'data-laptop',
      label: 'Data Laptop',
      description: 'Detailed analysis and sector data',
      x: 86,
      y: 82,
      action: { type: 'route', to: '/standings' },
    },
  ];
}

export function buildQuickActions(state: GameState): QuickAction[] {
  const raw: Array<QuickAction & { route?: string }> = [
    { id: 'messages', label: 'Messages / News', action: { type: 'route', to: '/news' }, route: '/news', count: state.news.length },
    { id: 'scouting', label: 'Driver Scouting', action: { type: 'route', to: '/market' }, route: '/scouting' },
    { id: 'sponsorship', label: 'Sponsorship', action: { type: 'route', to: '/sponsors' }, route: '/sponsors' },
    { id: 'regulations', label: 'Regulation Updates', action: { type: 'route', to: '/politics' }, route: '/politics' },
    { id: 'calendar', label: 'Calendar', action: { type: 'route', to: '/calendar' }, route: '/calendar' },
    { id: 'development', label: 'Car Development', action: { type: 'route', to: '/development' }, route: '/development' },
    { id: 'menu', label: 'Open Menu', action: { type: 'route', to: '/hq' }, route: '/hq' },
  ];

  return raw.filter((action) => !action.route || !isRouteRestricted(action.route, state.gameMode));
}

export function routeLockReason(route: string, state: GameState): string | undefined {
  return getRouteRestrictionReason(route, state.gameMode);
}

export function buildTeamMessages(state: GameState, race: Race): string[] {
  const activeDrivers = activeDriversForTeam(state, state.selectedTeamId);
  const messages: string[] = [];

  for (const event of state.careerPhase?.paddockEvents ?? []) {
    if (!event.resolvedOptionId) messages.push(event.title);
  }

  for (const driver of activeDrivers) {
    if (driver.confidence >= 75) messages.push(`${driver.name} is confident with the car balance.`);
    if (driver.morale < 45) messages.push(`${driver.name} needs morale support before the race.`);
  }

  const promises = state.driverPromises?.filter((p) => p.status === 'active') ?? [];
  for (const promise of promises) {
    const driver = state.drivers.find((d) => d.id === promise.driverId);
    if (driver?.teamId === state.selectedTeamId) messages.push(`Promise reminder for ${driver.name}.`);
  }

  const car = carForTeam(state, state.selectedTeamId);
  if (car && car.condition < 70) messages.push(`Chief mechanic reports car condition at ${Math.round(car.condition)}%.`);

  for (const item of state.news) {
    if (item.round == null || item.round === race.round || item.teamId === state.selectedTeamId) {
      messages.push(item.headline);
    }
  }

  return messages.slice(0, 4);
}

export function buildCarStatus(state: GameState) {
  const car = carForTeam(state, state.selectedTeamId);
  if (!car) {
    return [
      { label: 'Engine', value: 'N/A' },
      { label: 'Gearbox', value: 'N/A' },
      { label: 'Chassis', value: 'N/A' },
      { label: 'Reliability', value: 'N/A' },
    ];
  }

  const ratings = effectiveCarRatings(car);
  const condition = Math.round(car.condition);
  const reliabilityPct = Math.round(Math.max(0, Math.min(100, ratings.reliability * 10)));
  return [
    { label: 'Engine', value: `${condition}%` },
    { label: 'Gearbox', value: `${Math.round((condition + reliabilityPct) / 2)}%` },
    { label: 'Chassis', value: `${condition}%` },
    { label: 'Reliability', value: `${ratings.reliability.toFixed(1)}/10` },
  ];
}

export function setupConfidenceLabel(state: GameState, race: Race): string {
  const drivers = activeDriversForTeam(state, state.selectedTeamId);
  const wp = state.weekendPractice?.raceId === race.id ? state.weekendPractice : undefined;
  if (!wp || drivers.length === 0) return 'No practice data';
  const avg = drivers.reduce((sum, d) => sum + (wp.knowledge.setupKnowledge[d.id] ?? 0), 0) / drivers.length;
  return `${Math.round(avg * 100)}%`;
}

function entityName(state: GameState, entry: StandingsEntry): string {
  return (
    state.drivers.find((d) => d.id === entry.entityId)?.name ??
    state.teams.find((t) => t.id === entry.entityId)?.name ??
    entry.entityId
  );
}

export function buildStandingsRows(state: GameState, limit = 5) {
  const driverRows = state.driverStandings.slice(0, limit).map((entry, index) => ({
    position: index + 1,
    name: entityName(state, entry),
    points: entry.points,
    highlight: activeDriversForTeam(state, state.selectedTeamId).some((d) => d.id === entry.entityId),
  }));

  if (driverRows.length > 0) return driverRows;

  return state.constructorStandings.slice(0, limit).map((entry, index) => ({
    position: index + 1,
    name: entityName(state, entry),
    points: entry.points,
    highlight: entry.entityId === state.selectedTeamId,
  }));
}

export function regulationForState(state: GameState): RegulationSet | undefined {
  return getRegulationSet(state.regulationSetId);
}

export function drsDisplay(regulation: RegulationSet | undefined): string {
  return regulation?.drsEnabled ? 'Enabled' : 'N/A';
}

export function refuelingDisplay(regulation: RegulationSet | undefined): string {
  if (!regulation) return 'Unknown refueling rules';
  return regulation.refuelingAllowed ? 'Refueling allowed' : 'No race refueling';
}

export function weatherRows(forecast: WeekendForecast) {
  return [
    { day: 'FRI', session: 'Practice', weather: forecast.Practice },
    { day: 'SAT', session: 'Qualifying', weather: forecast.Qualifying },
    { day: 'SUN', session: 'Race', weather: forecast.Race },
  ];
}

export function topBarMetrics(state: GameState, race: Race) {
  const team = selectedTeam(state);
  const nextRace = state.calendar.find((r) => !r.completed && r.round > race.round);
  return {
    funds: team ? formatMoney(team.budget) : 'N/A',
    morale: teamMoraleLabel(team?.morale),
    rating: teamRatingLabel(state),
    nextRace: nextRace ? `${nextRace.gpName}` : state.seasonComplete ? 'Season complete' : 'Current event',
  };
}
