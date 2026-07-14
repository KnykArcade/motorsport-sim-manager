import type { GameState } from '../game/careerState';
import type { Car, NewsItem } from '../types/gameTypes';
import type {
  CarLaunchApproach,
  PreseasonFlawArea,
  PreseasonHiddenFlaw,
  PreseasonHubState,
  PreseasonProgramState,
  PreseasonRivalReport,
  PreseasonTestingFocus,
  PreseasonTestingReport,
} from '../types/phase18Types';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { createSeededRandom, deriveSeed } from './random';
import { makeTransaction } from './financeEngine';

export const PRESEASON_TESTING_COST: Record<PreseasonTestingFocus, number> = {
  Balanced: 500_000, Performance: 800_000, Reliability: 700_000, RaceOperations: 600_000, Experimental: 1_000_000,
};
export const PRESEASON_FLAW_FIX_COST = 650_000;

function clamp(value: number): number { return Math.max(0, Math.min(100, Math.round(value))); }
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

function createProgram(state: GameState, teamId: string): PreseasonProgramState {
  return { teamId, seasonYear: state.seasonYear, launchCompleted: false, testingCompleted: false, testingReports: [], hiddenFlaws: flawForTeam(state, teamId), readiness: baseReadiness(state, teamId) };
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

function focusGain(focus: PreseasonTestingFocus) {
  if (focus === 'Performance') return { pace: 12, reliability: -2, operations: 2, knowledge: 7 };
  if (focus === 'Reliability') return { pace: 2, reliability: 13, operations: 3, knowledge: 9 };
  if (focus === 'RaceOperations') return { pace: 3, reliability: 4, operations: 13, knowledge: 8 };
  if (focus === 'Experimental') return { pace: 15, reliability: -6, operations: 1, knowledge: 10 };
  return { pace: 7, reliability: 7, operations: 7, knowledge: 7 };
}

function testingReports(state: GameState, program: PreseasonProgramState, focus: PreseasonTestingFocus): PreseasonTestingReport[] {
  const rng = createSeededRandom(deriveSeed(state.randomSeed, state.seasonYear, program.teamId, focus, 'testing'));
  const gain = focusGain(focus);
  return [1, 2, 3].map((day) => {
    const paceSignal = clamp(program.readiness.pace + gain.pace * day / 3 + rng.int(-5, 5));
    const reliabilitySignal = clamp(program.readiness.reliability + gain.reliability * day / 3 + rng.int(-5, 5));
    const issue = reliabilitySignal < 52;
    return { day, headline: issue ? `Day ${day}: mileage interrupted` : day === 3 ? `Day ${day}: final programme complete` : `Day ${day}: useful mileage`, summary: issue ? 'The programme lost running time and engineers are checking correlation data.' : `${focus} work produced a clearer baseline for Race 1.`, paceSignal, reliabilitySignal, confidence: clamp(48 + day * 12 + program.readiness.knowledge * 0.18) };
  });
}

function runProgram(state: GameState, program: PreseasonProgramState, focus: PreseasonTestingFocus, ai = false): PreseasonProgramState {
  const gain = focusGain(focus);
  const rng = createSeededRandom(deriveSeed(state.randomSeed, state.seasonYear, program.teamId, focus, 'discovery'));
  const discoveryChance = focus === 'Reliability' ? 0.92 : focus === 'Balanced' ? 0.55 : focus === 'Experimental' ? 0.42 : 0.35;
  let hiddenFlaws = program.hiddenFlaws.map((flaw) => ({ ...flaw, discovered: flaw.discovered || rng.chance(discoveryChance) }));
  if (focus === 'Experimental' && hiddenFlaws.length === 0 && rng.chance(0.4)) hiddenFlaws = [{ id: `preseason-flaw-${state.seasonYear}-${program.teamId}-experimental`, area: 'Reliability', severity: 8, discovered: rng.chance(0.35), resolved: false, description: 'Aggressive test settings exposed a marginal durability window.' }];
  return { ...program, testingFocus: focus, testingCompleted: true, testingReports: testingReports(state, program, focus), hiddenFlaws, readiness: readiness(program.readiness.pace + gain.pace, program.readiness.reliability + gain.reliability, program.readiness.operations + gain.operations, program.readiness.knowledge + gain.knowledge), aiDecisionReason: ai ? `${focus} selected from principal identity, team strategy, and financial position.` : program.aiDecisionReason };
}

function rivalReports(state: GameState, programs: Record<string, PreseasonProgramState>): PreseasonRivalReport[] {
  return state.teams.filter((team) => team.id !== state.selectedTeamId).slice(0, 5).map((team, index) => {
    const program = programs[team.id];
    const rng = createSeededRandom(deriveSeed(state.randomSeed, state.seasonYear, team.id, 'rival-testing-rumor'));
    const misleading = rng.chance(0.25);
    const mixed = !misleading && rng.chance(0.3);
    const strength = program.readiness.overall >= 72 ? 'front-running pace' : program.readiness.overall >= 58 ? 'a competitive baseline' : 'a difficult opening programme';
    return { id: `preseason-rival-${state.seasonYear}-${team.id}`, teamId: team.id, claim: `${team.name} is rumored to have ${misleading ? (program.readiness.overall >= 60 ? 'serious correlation trouble' : 'surprising front-running pace') : strength}.`, confidence: clamp(38 + index * 7 + (state.scouting?.networkAccuracy ?? 0.15) * 35 + rng.int(-8, 8)), assessment: index < 2 ? 'Likely' : index < 4 ? 'Plausible' : 'Unverified', hiddenTruth: misleading ? 'False' : mixed ? 'Mixed' : 'True' };
  });
}

export function ensurePreseasonHubState(state: GameState): GameState {
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  if (phase18.preseason?.seasonYear === state.seasonYear && state.teams.every((team) => phase18.preseason?.programs[team.id])) return state.phase18 === phase18 ? state : { ...state, phase18 };
  const programs: Record<string, PreseasonProgramState> = {};
  for (const team of state.teams) {
    let program = createProgram(state, team.id);
    if (team.id !== state.selectedTeamId) {
      const focus = aiFocus({ ...state, phase18 }, team.id);
      program = runProgram(state, { ...program, launchApproach: 'Measured', launchCompleted: true }, focus, true);
    }
    programs[team.id] = program;
  }
  const preseason: PreseasonHubState = { seasonYear: state.seasonYear, programs, rivalReports: rivalReports(state, programs) };
  return { ...state, phase18: { ...phase18, preseason } };
}

export function completeCarLaunch(state: GameState, approach: CarLaunchApproach): GameState {
  const ensured = ensurePreseasonHubState(state);
  // Legacy/new-game callers can reach this screen before the phase-state helper
  // has been initialized. An absent phase is treated as preseason throughout the
  // career phase engine, so keep the action consistent with that contract.
  if (ensured.careerPhase && ensured.careerPhase.currentPhase !== 'pre_season_setup') return ensured;
  const preseason = ensured.phase18!.preseason!;
  const program = preseason.programs[ensured.selectedTeamId];
  if (program.launchCompleted) return ensured;
  const moraleGain = approach === 'PerformanceStatement' ? 4 : approach === 'CommercialShowcase' ? 3 : 2;
  const teams = ensured.teams.map((team) => team.id === ensured.selectedTeamId ? { ...team, morale: clamp(team.morale + moraleGain) } : team);
  const commercial = ensured.commercial ? { ...ensured.commercial, sponsors: ensured.commercial.sponsors.map((sponsor) => ({ ...sponsor, confidence: clamp(sponsor.confidence + (approach === 'CommercialShowcase' ? 5 : 2)) })) } : ensured.commercial;
  const updated = { ...program, launchApproach: approach, launchCompleted: true, readiness: readiness(program.readiness.pace + (approach === 'PerformanceStatement' ? 2 : 0), program.readiness.reliability, program.readiness.operations, program.readiness.knowledge + 2) };
  const news: NewsItem = { id: `news-car-launch-${ensured.seasonYear}-${ensured.selectedTeamId}`, headline: `${teams.find((team) => team.id === ensured.selectedTeamId)?.name ?? 'The team'} launches its ${ensured.seasonYear} challenger`, body: `${approach} presentation sets the tone before preseason testing.`, timestamp: new Date().toISOString(), category: 'preseason', priority: 'normal', careerPhase: ensured.careerPhase?.currentPhase, teamId: ensured.selectedTeamId };
  return { ...ensured, teams, commercial, news: [news, ...ensured.news].slice(0, 80), phase18: { ...ensured.phase18!, preseason: { ...preseason, programs: { ...preseason.programs, [ensured.selectedTeamId]: updated } } } };
}

export function completePreseasonTesting(state: GameState, focus: PreseasonTestingFocus): GameState {
  const ensured = ensurePreseasonHubState(state);
  if (ensured.careerPhase && ensured.careerPhase.currentPhase !== 'pre_season_setup') return ensured;
  const preseason = ensured.phase18!.preseason!;
  const program = preseason.programs[ensured.selectedTeamId];
  if (!program.launchCompleted || program.testingCompleted) return ensured;
  const cost = ensured.gameMode === 'SingleSeason' ? 0 : PRESEASON_TESTING_COST[focus];
  const team = ensured.teams.find((entry) => entry.id === ensured.selectedTeamId);
  if ((team?.budget ?? 0) < cost) return ensured;
  const updated = runProgram(ensured, program, focus);
  const teams = cost ? ensured.teams.map((entry) => entry.id === ensured.selectedTeamId ? { ...entry, budget: entry.budget - cost } : entry) : ensured.teams;
  const finance = cost ? [...(ensured.finance ?? []), makeTransaction(ensured.seasonYear, 'Development', `${focus} preseason testing programme`, -cost)] : ensured.finance;
  return { ...ensured, teams, finance, phase18: { ...ensured.phase18!, preseason: { ...preseason, programs: { ...preseason.programs, [ensured.selectedTeamId]: updated } } } };
}

export function resolvePreseasonFlaw(state: GameState, flawId: string): GameState {
  const ensured = ensurePreseasonHubState(state);
  const preseason = ensured.phase18!.preseason!;
  const program = preseason.programs[ensured.selectedTeamId];
  const flaw = program.hiddenFlaws.find((entry) => entry.id === flawId && entry.discovered && !entry.resolved);
  const team = ensured.teams.find((entry) => entry.id === ensured.selectedTeamId);
  if (!flaw || (team?.budget ?? 0) < PRESEASON_FLAW_FIX_COST) return ensured;
  const hiddenFlaws = program.hiddenFlaws.map((entry) => entry.id === flawId ? { ...entry, resolved: true } : entry);
  const updated = { ...program, hiddenFlaws, readiness: readiness(program.readiness.pace, program.readiness.reliability + Math.ceil(flaw.severity / 2), program.readiness.operations, program.readiness.knowledge) };
  const teams = ensured.teams.map((entry) => entry.id === ensured.selectedTeamId ? { ...entry, budget: entry.budget - PRESEASON_FLAW_FIX_COST } : entry);
  const finance = [...(ensured.finance ?? []), makeTransaction(ensured.seasonYear, 'Development', `Preseason correction: ${flaw.area}`, -PRESEASON_FLAW_FIX_COST)];
  return { ...ensured, teams, finance, phase18: { ...ensured.phase18!, preseason: { ...preseason, programs: { ...preseason.programs, [ensured.selectedTeamId]: updated } } } };
}

export function preseasonProgramFor(state: GameState, teamId = state.selectedTeamId): PreseasonProgramState | undefined { return state.phase18?.preseason?.seasonYear === state.seasonYear ? state.phase18.preseason.programs[teamId] : undefined; }

export function applyPreseasonCarModifier(state: GameState, car: Car): Car {
  if (state.currentRaceIndex > 0) return car;
  const program = preseasonProgramFor(state, car.teamId);
  if (!program?.testingCompleted) return car;
  const unresolvedSeverity = program.hiddenFlaws.filter((flaw) => !flaw.resolved).reduce((sum, flaw) => sum + flaw.severity, 0);
  const paceDelta = (program.readiness.pace - 60) * 0.04;
  const reliabilityDelta = (program.readiness.reliability - 60) * 0.05 - unresolvedSeverity * 0.35;
  return { ...car, ratings: { ...car.ratings, enginePower: clamp(car.ratings.enginePower + paceDelta), aeroEfficiency: clamp(car.ratings.aeroEfficiency + paceDelta), mechanicalGrip: clamp(car.ratings.mechanicalGrip + paceDelta), reliability: clamp(car.ratings.reliability + reliabilityDelta), pitCrewOperations: clamp(car.ratings.pitCrewOperations + (program.readiness.operations - 60) * 0.05) } };
}
