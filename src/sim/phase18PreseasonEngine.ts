import { getTrackById } from '../data';
import { selectPreseasonTestingRule } from '../data/rules/preseasonTestingRules';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import type { GameState } from '../game/careerState';
import type { Car, Driver, NewsItem, Track } from '../types/gameTypes';
import type {
  CarLaunchApproach,
  PreseasonDriverBaseline,
  PreseasonDriverRunResult,
  PreseasonFlawArea,
  PreseasonHiddenFlaw,
  PreseasonHubState,
  PreseasonProgramState,
  PreseasonRivalReport,
  PreseasonSessionAssignment,
  PreseasonSessionProgram,
  PreseasonTestSession,
  PreseasonTestingFocus,
  PreseasonTestingReport,
} from '../types/phase18Types';
import type { SetupArchiveEntry } from '../types/practiceTypes';
import type { SetupComponentKey, SetupParamKey } from '../types/setupTypes';
import { makeTransaction } from './financeEngine';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { createSeededRandom, deriveSeed } from './random';
import { carDevelopmentFingerprint } from './setupArchiveEngine';
import { calculateSetupPerformanceSnapshot } from './setupPerformanceSurface';

export const PRESEASON_TESTING_COST: Record<PreseasonTestingFocus, number> = {
  Balanced: 500_000, Performance: 800_000, Reliability: 700_000, RaceOperations: 600_000, Experimental: 1_000_000,
};
export const PRESEASON_FLAW_FIX_COST = 650_000;

export const PRESEASON_SESSION_PROGRAMS: ReadonlyArray<{ id: PreseasonSessionProgram; label: string; description: string }> = [
  { id: 'Correlation', label: 'Correlation', description: 'Compare track response with simulation and design expectations.' },
  { id: 'SetupExploration', label: 'Setup exploration', description: 'Test one configuration direction and narrow the usable window.' },
  { id: 'QualifyingSimulation', label: 'Qualifying simulation', description: 'Evaluate low-fuel balance and tyre preparation.' },
  { id: 'LongRun', label: 'Long run', description: 'Evaluate heavy-fuel balance, consistency and thermal behavior.' },
  { id: 'TyreEvaluation', label: 'Tyre evaluation', description: 'Use limited tyres to understand warm-up and degradation direction.' },
  { id: 'ReliabilityWork', label: 'Reliability work', description: 'Prioritize mileage, cooling and hidden-problem discovery.' },
];

const COMPONENT_LABEL: Record<SetupComponentKey, string> = {
  aero: 'aero balance', mechanical: 'platform compliance', gearing: 'gearing compromise',
  brakes: 'brake stability', differential: 'traction balance', cooling: 'cooling margin', tyres: 'tyre usage',
};

function clamp(value: number): number { return Math.max(0, Math.min(100, Math.round(value))); }
function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
function readiness(pace: number, reliability: number, operations: number, knowledge: number) {
  return { pace: clamp(pace), reliability: clamp(reliability), operations: clamp(operations), knowledge: clamp(knowledge), overall: clamp(pace * 0.34 + reliability * 0.3 + operations * 0.2 + knowledge * 0.16) };
}

function baseReadiness(state: GameState, teamId: string) {
  const car = state.cars.find((entry) => entry.teamId === teamId);
  const org = state.teamOrgRatings?.[teamId];
  const pace = car ? (car.ratings.enginePower + car.ratings.aeroEfficiency + car.ratings.mechanicalGrip) / 3 : 50;
  return readiness(38 + pace * 0.35, 35 + (car?.ratings.reliability ?? 50) * 0.4, 35 + (org?.operations ?? 50) * 0.4, 40 + (org?.staffQuality ?? 50) * 0.3);
}

function flawForTeam(state: GameState, teamId: string): PreseasonHiddenFlaw[] {
  const car = state.cars.find((entry) => entry.teamId === teamId);
  if (!car) return [];
  const entries: Array<[PreseasonFlawArea, number]> = [
    ['PowerUnit', car.ratings.enginePower], ['Aerodynamics', car.ratings.aeroEfficiency],
    ['Mechanical', car.ratings.mechanicalGrip], ['Reliability', car.ratings.reliability],
    ['Operations', car.ratings.pitCrewOperations],
  ];
  const [area, rating] = entries.slice().sort((a, b) => a[1] - b[1])[0];
  const rng = createSeededRandom(deriveSeed(state.randomSeed, state.seasonYear, teamId, 'preseason-flaw'));
  if (rating >= 76 && !rng.chance(0.22)) return [];
  const severity = clamp(4 + (76 - rating) * 0.2 + rng.int(0, 5));
  return [{ id: `preseason-flaw-${state.seasonYear}-${teamId}-${area}`, area, severity, discovered: false, resolved: false, description: `${area} correlation does not fully match the design target.` }];
}

function teamDrivers(state: GameState, teamId: string): Driver[] {
  return state.drivers
    .filter((driver) => driver.teamId === teamId)
    .sort((a, b) => Number(!!a.contractType && a.contractType !== 'seat') - Number(!!b.contractType && b.contractType !== 'seat') || a.id.localeCompare(b.id))
    .slice(0, 3);
}

function testTrack(state: GameState): Track | undefined {
  const opening = state.calendar[0];
  return opening ? getTrackById(opening.trackId) : undefined;
}

function lapDistanceKm(state: GameState): number {
  const race = state.calendar[0];
  return race?.distanceKm && race.laps > 0 ? race.distanceKm / race.laps : 5;
}

function defaultProgram(focus: PreseasonTestingFocus, index: number): PreseasonSessionProgram {
  if (focus === 'Performance') return index % 2 ? 'QualifyingSimulation' : 'SetupExploration';
  if (focus === 'Reliability') return index % 2 ? 'Correlation' : 'ReliabilityWork';
  if (focus === 'RaceOperations') return index % 2 ? 'TyreEvaluation' : 'LongRun';
  if (focus === 'Experimental') return index % 2 ? 'Correlation' : 'SetupExploration';
  return ['Correlation', 'SetupExploration', 'LongRun'][index % 3] as PreseasonSessionProgram;
}

function assignmentsFor(state: GameState, teamId: string, focus: PreseasonTestingFocus, existing?: Record<string, PreseasonSessionAssignment>): Record<string, PreseasonSessionAssignment> {
  const car = state.cars.find((entry) => entry.teamId === teamId);
  return Object.fromEntries(teamDrivers(state, teamId).map((driver, index) => {
    const prior = existing?.[driver.id];
    return [driver.id, prior ?? {
      driverId: driver.id,
      carId: car?.id ?? `${teamId}-car`,
      program: defaultProgram(focus, index),
      setup: { ...(state.carSetups?.[driver.id] ?? BALANCED_SETUP) },
      revision: 0,
    } satisfies PreseasonSessionAssignment];
  }));
}

function createProgram(state: GameState, teamId: string): PreseasonProgramState {
  return {
    teamId,
    seasonYear: state.seasonYear,
    launchCompleted: false,
    testingStarted: false,
    testingCompleted: false,
    ruleProfile: selectPreseasonTestingRule(state.series, state.seasonYear),
    sessions: [],
    pendingAssignments: {},
    baselineByDriver: {},
    correlation: { confidence: 0, status: 'Unverified', discrepancy: 'Unknown', investigatedPrograms: [] },
    mileageUsedKm: 0,
    tyreSetsUsed: 0,
    repairTimeLostMinutes: 0,
    testingReports: [],
    hiddenFlaws: flawForTeam(state, teamId),
    readiness: baseReadiness(state, teamId),
  };
}

function normalizeProgram(state: GameState, program: PreseasonProgramState): PreseasonProgramState {
  if (program.testingStarted !== undefined
    && program.ruleProfile
    && program.sessions
    && program.pendingAssignments
    && program.baselineByDriver
    && program.correlation
    && program.mileageUsedKm !== undefined
    && program.tyreSetsUsed !== undefined
    && program.repairTimeLostMinutes !== undefined) return program;
  const ruleProfile = program.ruleProfile ?? selectPreseasonTestingRule(state.series, state.seasonYear);
  return {
    ...program,
    testingStarted: program.testingStarted ?? program.testingCompleted,
    ruleProfile,
    sessions: program.sessions ?? [],
    pendingAssignments: program.pendingAssignments ?? assignmentsFor(state, program.teamId, program.testingFocus ?? 'Balanced'),
    baselineByDriver: program.baselineByDriver ?? {},
    correlation: program.correlation ?? {
      confidence: program.testingCompleted ? Math.min(75, program.readiness.knowledge) : 0,
      status: program.testingCompleted ? 'Mixed' : 'Unverified',
      discrepancy: 'Unknown',
      investigatedPrograms: [],
    },
    mileageUsedKm: program.mileageUsedKm ?? 0,
    tyreSetsUsed: program.tyreSetsUsed ?? 0,
    repairTimeLostMinutes: program.repairTimeLostMinutes ?? 0,
  };
}

function aiFocus(state: GameState, teamId: string): PreseasonTestingFocus {
  const identity = state.phase18?.aiPrincipalIdentities[teamId]?.dominantIdentity;
  const archetype = state.aiTeamStates?.[teamId]?.archetype;
  if (identity === 'RiskTakingInnovator' || archetype === 'AggressiveSpender') return 'Experimental';
  if (archetype === 'SurvivalMode' || archetype === 'FinanciallyConservative') return 'Reliability';
  if (identity === 'TechnicalVisionary' || archetype === 'DevelopmentFocused') return 'Performance';
  if (identity === 'PeopleManager') return 'RaceOperations';
  return 'Balanced';
}

function engineeringExtraction(state: GameState, teamId: string, driver: Driver): number {
  const org = state.teamOrgRatings?.[teamId];
  const staff = teamId === state.selectedTeamId
    ? [...(state.staff ?? [])].filter((member) => member.role === 'Race Engineer').sort((a, b) => b.rating - a.rating)[0]?.rating
    : undefined;
  const normalizedStaff = staff == null ? (org?.staffQuality ?? 50) : staff <= 10 ? staff * 10 : staff;
  return clamp01(0.58 + normalizedStaff / 260 + driver.ratings.adaptability / 520);
}

function correlationBias(state: GameState, teamId: string): number {
  const rng = createSeededRandom(deriveSeed(state.randomSeed, state.seasonYear, teamId, 'correlation-bias'));
  const org = state.teamOrgRatings?.[teamId];
  const spread = 0.42 - (org?.staffQuality ?? 50) / 260;
  return (rng.next() * 2 - 1) * Math.max(0.12, spread);
}

function sessionFeedback(program: PreseasonSessionProgram, snapshot: ReturnType<typeof calculateSetupPerformanceSnapshot>, signal: PreseasonDriverRunResult['correlationSignal'], interrupted: boolean): { feedback: string[]; recommendation: string } {
  const weakest = [...snapshot.components].sort((a, b) => a.fit - b.fit)[0]?.component ?? 'mechanical';
  const concern = COMPONENT_LABEL[weakest];
  const lines: string[] = [];
  if (interrupted) lines.push('Running was interrupted, so the evidence range remains wide.');
  if (program === 'Correlation') lines.push(signal === 'Aligned' ? 'Track response follows the expected direction.' : `Track response is ${signal.toLowerCase()} against the simulation trend.`);
  if (program === 'SetupExploration') lines.push(`The clearest unresolved direction is the ${concern}.`);
  if (program === 'QualifyingSimulation') lines.push('Low-fuel balance is clearer, but the configuration is not yet a verified qualifying solution.');
  if (program === 'LongRun') lines.push('Heavy-fuel balance and consistency produced useful directional evidence.');
  if (program === 'TyreEvaluation') lines.push('Tyre warm-up and degradation trends are clearer without revealing an ideal setting.');
  if (program === 'ReliabilityWork') lines.push('Cooling and durability behavior were prioritized over headline lap time.');
  if (snapshot.warnings[0]) lines.push(snapshot.warnings[0]);
  return { feedback: lines, recommendation: `Revise the ${concern} in one controlled step, then verify it in another session.` };
}

function mergeBaseline(previous: PreseasonDriverBaseline | undefined, result: PreseasonDriverRunResult): PreseasonDriverBaseline {
  const sessions = (previous?.sessions ?? 0) + 1;
  const previousWeight = previous?.sessions ?? 0;
  return {
    driverId: result.driverId,
    setup: { ...result.setup },
    evidenceConfidence: clamp01(((previous?.evidenceConfidence ?? 0) * previousWeight + result.evidenceConfidence) / sessions),
    mileageKm: (previous?.mileageKm ?? 0) + result.mileageKm,
    sessions,
    requiresRaceWeekendVerification: true,
  };
}

function reportFor(session: PreseasonTestSession, program: PreseasonProgramState): PreseasonTestingReport {
  const interrupted = session.results.some((result) => result.interrupted);
  const confidence = session.results.length
    ? clamp(session.results.reduce((sum, result) => sum + result.evidenceConfidence, 0) / session.results.length * 100)
    : 0;
  return {
    day: session.day,
    sessionId: session.id,
    headline: interrupted ? `Day ${session.day} ${session.session}: running interrupted` : `Day ${session.day} ${session.session}: programme complete`,
    summary: session.results.length
      ? `${session.results.map((result) => result.program).join(' / ')} produced ${Math.round(session.mileageKm)} km of directional evidence.`
      : 'No legal running remained in the programme allocation.',
    paceSignal: program.readiness.pace,
    reliabilitySignal: program.readiness.reliability,
    confidence,
  };
}

function runSessionOnProgram(state: GameState, input: PreseasonProgramState): PreseasonProgramState {
  const program = normalizeProgram(state, input);
  const rule = program.ruleProfile!;
  const sessions = program.sessions!;
  const totalSessions = rule.days * rule.sessionsPerDay;
  if (!program.testingStarted || program.testingCompleted || sessions.length >= totalSessions) return program;
  const track = testTrack(state);
  const car = state.cars.find((entry) => entry.teamId === program.teamId);
  if (!track || !car) return { ...program, testingCompleted: true };

  const sessionIndex = sessions.length;
  const day = Math.floor(sessionIndex / rule.sessionsPerDay) + 1;
  const sessionName = sessionIndex % rule.sessionsPerDay === 0 ? 'Morning' : 'Afternoon';
  const rng = createSeededRandom(deriveSeed(state.randomSeed, state.seasonYear, program.teamId, sessionIndex, 'preseason-session'));
  const condition: PreseasonTestSession['condition'] = rng.chance(0.08) ? 'Wet' : rng.chance(0.12) ? 'Mixed' : 'Dry';
  const assignmentList = Object.values(program.pendingAssignments ?? {});
  const sessionCounts = Object.fromEntries(teamDrivers(state, program.teamId).map((driver) => [driver.id, sessions.filter((entry) => entry.results.some((result) => result.driverId === driver.id)).length]));
  const selected = assignmentList
    .sort((a, b) => (sessionCounts[a.driverId] ?? 0) - (sessionCounts[b.driverId] ?? 0) || a.driverId.localeCompare(b.driverId))
    .slice(0, rule.maxCarsPerSession);
  const remainingMileage = rule.mileageLimitKm == null ? Number.POSITIVE_INFINITY : Math.max(0, rule.mileageLimitKm - (program.mileageUsedKm ?? 0));
  const remainingTyres = rule.tyreSets == null ? Number.POSITIVE_INFINITY : Math.max(0, rule.tyreSets - (program.tyreSetsUsed ?? 0));
  const distancePerLap = lapDistanceKm(state);
  let availableMileage = remainingMileage;
  let availableTyres = remainingTyres;
  let sessionTyreSetsUsed = 0;
  let lostMinutes = 0;
  const results: PreseasonDriverRunResult[] = [];
  for (const assignment of selected) {
    if (availableMileage < distancePerLap || availableTyres < 1) continue;
    const driver = state.drivers.find((entry) => entry.id === assignment.driverId);
    if (!driver) continue;
    const snapshot = calculateSetupPerformanceSnapshot(assignment.setup, track, car);
    const issueExposure = (100 - car.ratings.reliability) / 520
      + program.hiddenFlaws.filter((flaw) => !flaw.resolved).reduce((sum, flaw) => sum + flaw.severity, 0) / 650
      + (assignment.program === 'ReliabilityWork' ? -0.025 : program.testingFocus === 'Experimental' ? 0.04 : 0);
    const interrupted = rng.chance(Math.max(0.02, issueExposure));
    const planned = assignment.program === 'LongRun' || assignment.program === 'ReliabilityWork' ? 34 : 24;
    const capLaps = Math.floor(availableMileage / distancePerLap);
    const lapsCompleted = Math.max(0, Math.min(planned, capLaps, interrupted ? rng.int(5, Math.max(6, planned - 8)) : planned));
    const mileageKm = Math.round(lapsCompleted * distancePerLap * 10) / 10;
    const tyreSetsUsed = Math.min(availableTyres, assignment.program === 'TyreEvaluation' || assignment.program === 'QualifyingSimulation' ? 2 : 1);
    availableMileage -= mileageKm;
    availableTyres -= tyreSetsUsed;
    sessionTyreSetsUsed += tyreSetsUsed;
    if (interrupted) lostMinutes += rng.int(25, 85);
    const extraction = engineeringExtraction(state, program.teamId, driver);
    const evidenceConfidence = clamp01((lapsCompleted / Math.max(1, planned)) * extraction * (condition === 'Dry' ? 0.82 : 0.62));
    const expected = 0.65 + correlationBias(state, program.teamId);
    const observed = snapshot.objectiveQuality / 100;
    const difference = observed - expected;
    const signal: PreseasonDriverRunResult['correlationSignal'] = Math.abs(difference) < 0.12 ? 'Aligned' : Math.abs(difference) < 0.25 ? 'Questionable' : 'Divergent';
    const notes = sessionFeedback(assignment.program, snapshot, signal, interrupted);
    results.push({ driverId: driver.id, program: assignment.program, lapsPlanned: planned, lapsCompleted, mileageKm, setup: { ...assignment.setup }, correlationSignal: signal, evidenceConfidence, feedback: notes.feedback, engineerRecommendation: notes.recommendation, interrupted });
  }

  const mileageKm = results.reduce((sum, result) => sum + result.mileageKm, 0);
  const tyreSetsUsed = sessionTyreSetsUsed;
  const session: PreseasonTestSession = { id: `preseason-${state.seasonYear}-${program.teamId}-${sessionIndex + 1}`, day, session: sessionName, condition, assignments: selected, results, mileageKm, tyreSetsUsed, lostMinutes };
  const baselineByDriver = { ...(program.baselineByDriver ?? {}) };
  results.forEach((result) => { baselineByDriver[result.driverId] = mergeBaseline(baselineByDriver[result.driverId], result); });
  const investigatedPrograms = [...new Set([...(program.correlation?.investigatedPrograms ?? []), ...results.map((result) => result.program)])];
  const evidenceGain = results.reduce((sum, result) => sum + result.evidenceConfidence, 0) * 9;
  const correlationConfidence = clamp((program.correlation?.confidence ?? 0) + evidenceGain);
  const bias = correlationBias(state, program.teamId);
  const correlation = {
    confidence: correlationConfidence,
    status: correlationConfidence >= 72 ? 'Strong' as const : correlationConfidence >= 42 ? 'Mixed' as const : 'Weak' as const,
    discrepancy: Math.abs(bias) < 0.12 ? 'Aligned' as const : bias > 0 ? 'OverPredicting' as const : 'UnderPredicting' as const,
    investigatedPrograms,
  };
  const discoveryChance = results.reduce((best, result) => Math.max(best, result.evidenceConfidence * (result.program === 'ReliabilityWork' ? 0.9 : result.program === 'Correlation' ? 0.65 : 0.32)), 0);
  const hiddenFlaws = program.hiddenFlaws.map((flaw) => ({ ...flaw, discovered: flaw.discovered || rng.chance(discoveryChance) }));
  const completed = sessionIndex + 1 >= totalSessions || availableMileage < distancePerLap || availableTyres < 1;
  const next = {
    ...program,
    testingCompleted: completed,
    sessions: [...sessions, session],
    baselineByDriver,
    correlation,
    mileageUsedKm: (program.mileageUsedKm ?? 0) + mileageKm,
    tyreSetsUsed: (program.tyreSetsUsed ?? 0) + tyreSetsUsed,
    repairTimeLostMinutes: (program.repairTimeLostMinutes ?? 0) + lostMinutes,
    hiddenFlaws,
    readiness: readiness(program.readiness.pace, program.readiness.reliability, program.readiness.operations + Math.min(1, results.length), program.readiness.knowledge + evidenceGain * 0.5),
  };
  return { ...next, testingReports: [...program.testingReports, reportFor(session, next)] };
}

function startProgram(state: GameState, input: PreseasonProgramState, focus: PreseasonTestingFocus): PreseasonProgramState {
  const program = normalizeProgram(state, input);
  if (program.testingStarted || program.testingCompleted) return program;
  return { ...program, testingFocus: focus, testingStarted: true, pendingAssignments: assignmentsFor(state, program.teamId, focus, program.pendingAssignments) };
}

function runAIProgram(state: GameState, input: PreseasonProgramState, focus: PreseasonTestingFocus): PreseasonProgramState {
  let program = startProgram(state, { ...input, launchApproach: 'Measured', launchCompleted: true }, focus);
  while (!program.testingCompleted) program = runSessionOnProgram(state, program);
  return { ...program, aiDecisionReason: `${focus} session allocation selected from principal identity, team strategy, car weaknesses and engineering capacity.` };
}

function archiveEntriesForProgram(state: GameState, program: PreseasonProgramState): SetupArchiveEntry[] {
  if (!program.testingCompleted) return [];
  const track = testTrack(state);
  const car = state.cars.find((entry) => entry.teamId === program.teamId);
  if (!track || !car) return [];
  return Object.values(program.baselineByDriver ?? {}).map((baseline) => ({
    id: `${program.teamId}-preseason-${state.seasonYear}-${baseline.driverId}`,
    teamId: program.teamId,
    driverId: baseline.driverId,
    raceId: `preseason-${state.seasonYear}`,
    trackId: track.id,
    trackName: track.name,
    trackArchetype: track.archetype,
    seasonYear: state.seasonYear,
    carId: car.id,
    carDevelopmentFingerprint: carDevelopmentFingerprint(car),
    condition: { label: 'Preseason mixed evidence', wet: false, gripLevel: 0.88 },
    qualifyingSetup: { ...baseline.setup },
    raceSetup: { ...baseline.setup },
    evidenceConfidence: clamp01(baseline.evidenceConfidence * 0.78),
    evidenceOrigin: 'PreseasonTest',
    requiresWeekendVerification: true,
  }));
}

function mergeArchive(state: GameState, programs: Record<string, PreseasonProgramState>): SetupArchiveEntry[] {
  const additions = Object.values(programs).flatMap((program) => archiveEntriesForProgram(state, program));
  const ids = new Set(additions.map((entry) => entry.id));
  return [...(state.setupArchive ?? []).filter((entry) => !ids.has(entry.id)), ...additions].slice(-1600);
}

function rivalReports(state: GameState, programs: Record<string, PreseasonProgramState>): PreseasonRivalReport[] {
  return state.teams.filter((team) => team.id !== state.selectedTeamId).slice(0, 5).map((team, index) => {
    const program = programs[team.id];
    const rng = createSeededRandom(deriveSeed(state.randomSeed, state.seasonYear, team.id, 'rival-testing-rumor'));
    const misleading = rng.chance(0.25);
    const mixed = !misleading && rng.chance(0.3);
    const strength = program.readiness.overall >= 72 ? 'a well-understood package' : program.readiness.overall >= 58 ? 'a workable baseline' : 'an uncertain opening programme';
    return { id: `preseason-rival-${state.seasonYear}-${team.id}`, teamId: team.id, claim: `${team.name} is rumored to have ${misleading ? (program.readiness.overall >= 60 ? 'serious correlation trouble' : 'front-running pace') : strength}.`, confidence: clamp(38 + index * 7 + (state.scouting?.networkAccuracy ?? 0.15) * 35 + rng.int(-8, 8)), assessment: index < 2 ? 'Likely' : index < 4 ? 'Plausible' : 'Unverified', hiddenTruth: misleading ? 'False' : mixed ? 'Mixed' : 'True' };
  });
}

export function ensurePreseasonHubState(state: GameState): GameState {
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  if (phase18.preseason?.seasonYear === state.seasonYear && state.teams.every((team) => phase18.preseason?.programs[team.id])) {
    const programs = Object.fromEntries(Object.entries(phase18.preseason.programs).map(([teamId, program]) => [teamId, normalizeProgram(state, program)]));
    const unchanged = Object.values(programs).every((program) => phase18.preseason?.programs[program.teamId] === program);
    if (unchanged && state.phase18 === phase18) return state;
    return { ...state, phase18: { ...phase18, preseason: { ...phase18.preseason, programs } } };
  }
  const programs: Record<string, PreseasonProgramState> = {};
  const seededState = { ...state, phase18 };
  for (const team of state.teams) {
    let program = createProgram(seededState, team.id);
    if (team.id !== state.selectedTeamId) program = runAIProgram(seededState, program, aiFocus(seededState, team.id));
    programs[team.id] = program;
  }
  const preseason: PreseasonHubState = { seasonYear: state.seasonYear, programs, rivalReports: rivalReports(state, programs) };
  return { ...state, setupArchive: mergeArchive(state, programs), phase18: { ...phase18, preseason } };
}

export function completeCarLaunch(state: GameState, approach: CarLaunchApproach): GameState {
  const ensured = ensurePreseasonHubState(state);
  if (ensured.careerPhase && ensured.careerPhase.currentPhase !== 'pre_season_setup') return ensured;
  const preseason = ensured.phase18!.preseason!;
  const program = preseason.programs[ensured.selectedTeamId];
  if (program.launchCompleted) return ensured;
  const moraleGain = approach === 'PerformanceStatement' ? 4 : approach === 'CommercialShowcase' ? 3 : 2;
  const teams = ensured.teams.map((team) => team.id === ensured.selectedTeamId ? { ...team, morale: clamp(team.morale + moraleGain) } : team);
  const commercial = ensured.commercial ? { ...ensured.commercial, sponsors: ensured.commercial.sponsors.map((sponsor) => ({ ...sponsor, confidence: clamp(sponsor.confidence + (approach === 'CommercialShowcase' ? 5 : 2)) })) } : ensured.commercial;
  const updated = { ...program, launchApproach: approach, launchCompleted: true };
  const news: NewsItem = { id: `news-car-launch-${ensured.seasonYear}-${ensured.selectedTeamId}`, headline: `${teams.find((team) => team.id === ensured.selectedTeamId)?.name ?? 'The team'} launches its ${ensured.seasonYear} challenger`, body: `${approach} presentation sets the tone before preseason testing.`, timestamp: new Date().toISOString(), category: 'preseason', priority: 'normal', careerPhase: ensured.careerPhase?.currentPhase, teamId: ensured.selectedTeamId };
  return { ...ensured, teams, commercial, news: [news, ...ensured.news].slice(0, 80), phase18: { ...ensured.phase18!, preseason: { ...preseason, programs: { ...preseason.programs, [ensured.selectedTeamId]: updated } } } };
}

export function startPreseasonTesting(state: GameState, focus: PreseasonTestingFocus): GameState {
  const ensured = ensurePreseasonHubState(state);
  if (ensured.careerPhase && ensured.careerPhase.currentPhase !== 'pre_season_setup') return ensured;
  const preseason = ensured.phase18!.preseason!;
  const program = preseason.programs[ensured.selectedTeamId];
  if (!program.launchCompleted || program.testingStarted || program.testingCompleted) return ensured;
  const cost = ensured.gameMode === 'SingleSeason' ? 0 : PRESEASON_TESTING_COST[focus];
  const team = ensured.teams.find((entry) => entry.id === ensured.selectedTeamId);
  if ((team?.budget ?? 0) < cost) return ensured;
  const updated = startProgram(ensured, program, focus);
  const teams = cost ? ensured.teams.map((entry) => entry.id === ensured.selectedTeamId ? { ...entry, budget: entry.budget - cost } : entry) : ensured.teams;
  const finance = cost ? [...(ensured.finance ?? []), makeTransaction(ensured.seasonYear, 'Development', `${focus} preseason testing programme`, -cost)] : ensured.finance;
  return { ...ensured, teams, finance, phase18: { ...ensured.phase18!, preseason: { ...preseason, programs: { ...preseason.programs, [ensured.selectedTeamId]: updated } } } };
}

export function setPreseasonSessionProgram(state: GameState, driverId: string, sessionProgram: PreseasonSessionProgram): GameState {
  const ensured = ensurePreseasonHubState(state);
  const preseason = ensured.phase18!.preseason!;
  const program = preseason.programs[ensured.selectedTeamId];
  const assignment = program.pendingAssignments?.[driverId];
  if (!program.testingStarted || program.testingCompleted || !assignment) return ensured;
  const updated = { ...program, pendingAssignments: { ...program.pendingAssignments, [driverId]: { ...assignment, program: sessionProgram } } };
  return { ...ensured, phase18: { ...ensured.phase18!, preseason: { ...preseason, programs: { ...preseason.programs, [ensured.selectedTeamId]: updated } } } };
}

export function revisePreseasonTestSetup(state: GameState, driverId: string, parameter: SetupParamKey, value: number): GameState {
  const ensured = ensurePreseasonHubState(state);
  const preseason = ensured.phase18!.preseason!;
  const program = preseason.programs[ensured.selectedTeamId];
  const assignment = program.pendingAssignments?.[driverId];
  if (!program.testingStarted || program.testingCompleted || !assignment) return ensured;
  const nextValue = Math.max(1, Math.min(10, Math.round(value * 10) / 10));
  const updatedAssignment = { ...assignment, setup: { ...assignment.setup, [parameter]: nextValue }, revision: assignment.revision + 1 };
  const updated = { ...program, pendingAssignments: { ...program.pendingAssignments, [driverId]: updatedAssignment } };
  return { ...ensured, phase18: { ...ensured.phase18!, preseason: { ...preseason, programs: { ...preseason.programs, [ensured.selectedTeamId]: updated } } } };
}

export function runPreseasonTestSession(state: GameState): GameState {
  const ensured = ensurePreseasonHubState(state);
  const preseason = ensured.phase18!.preseason!;
  const program = preseason.programs[ensured.selectedTeamId];
  const updated = runSessionOnProgram(ensured, program);
  if (updated === program) return ensured;
  const programs = { ...preseason.programs, [ensured.selectedTeamId]: updated };
  return { ...ensured, setupArchive: updated.testingCompleted ? mergeArchive(ensured, programs) : ensured.setupArchive, phase18: { ...ensured.phase18!, preseason: { ...preseason, programs } } };
}

// Compatibility helper for legacy saves/tests and the safety auto-completion
// path. The player-facing workspace uses start/run actions session by session.
export function completePreseasonTesting(state: GameState, focus: PreseasonTestingFocus): GameState {
  let next = startPreseasonTesting(state, focus);
  let guard = 0;
  while (!preseasonProgramFor(next)?.testingCompleted && guard < 20) {
    next = runPreseasonTestSession(next);
    guard += 1;
  }
  return next;
}

export function resolvePreseasonFlaw(state: GameState, flawId: string): GameState {
  const ensured = ensurePreseasonHubState(state);
  const preseason = ensured.phase18!.preseason!;
  const program = preseason.programs[ensured.selectedTeamId];
  const flaw = program.hiddenFlaws.find((entry) => entry.id === flawId && entry.discovered && !entry.resolved);
  const team = ensured.teams.find((entry) => entry.id === ensured.selectedTeamId);
  if (!flaw || (team?.budget ?? 0) < PRESEASON_FLAW_FIX_COST) return ensured;
  const hiddenFlaws = program.hiddenFlaws.map((entry) => entry.id === flawId ? { ...entry, resolved: true } : entry);
  const updated = { ...program, hiddenFlaws, repairTimeLostMinutes: (program.repairTimeLostMinutes ?? 0) + 120 };
  const teams = ensured.teams.map((entry) => entry.id === ensured.selectedTeamId ? { ...entry, budget: entry.budget - PRESEASON_FLAW_FIX_COST } : entry);
  const finance = [...(ensured.finance ?? []), makeTransaction(ensured.seasonYear, 'Development', `Preseason correction: ${flaw.area}`, -PRESEASON_FLAW_FIX_COST)];
  return { ...ensured, teams, finance, phase18: { ...ensured.phase18!, preseason: { ...preseason, programs: { ...preseason.programs, [ensured.selectedTeamId]: updated } } } };
}

export function preseasonProgramFor(state: GameState, teamId = state.selectedTeamId): PreseasonProgramState | undefined {
  return state.phase18?.preseason?.seasonYear === state.seasonYear ? state.phase18.preseason.programs[teamId] : undefined;
}

export function applyPreseasonCarModifier(state: GameState, car: Car): Car {
  if (state.currentRaceIndex > 0) return car;
  const program = preseasonProgramFor(state, car.teamId);
  if (!program?.testingCompleted) return car;
  const unresolvedSeverity = program.hiddenFlaws.filter((flaw) => !flaw.resolved).reduce((sum, flaw) => sum + flaw.severity, 0);
  if (unresolvedSeverity <= 0) return car;
  return { ...car, ratings: { ...car.ratings, reliability: clamp(car.ratings.reliability - unresolvedSeverity * 0.35) } };
}
