// Long-run Career audit harness. Plays out a full F1-1990 career for N seasons
// with REAL races each year (headless qualifying + race over every round, all
// cars AI-controlled) so the constructor/driver standings feed the offseason
// rollover exactly as they do in a played career. This is what makes the audit
// faithful to a real playthrough: prize money, reputation, AI development
// budgets and financial health all respond to actual results, so the report can
// tell whether long-career dominance, rating saturation and budget inflation
// are actually under control.
//
// Exposed as a pure function `runCareerAudit()` returning a structured report so
// both the CLI wrapper (`careerAudit.run.ts`) and the invariants test
// (`career-audit.test.ts`) can consume it. Deterministic given the seed.

import { getTrackById, getMaxQualifiers } from '../src/data';
import { getPointsSystem } from '../src/data/pointsSystems/pointsSystems';
import { setupOptionsById } from '../src/data/setupOptions/setupOptions';
import { autoSetupOptionsForTrack } from '../src/sim/autoSetup';
import { raceStrategiesById } from '../src/data/decisions/raceStrategies';
import { driverInstructionsById } from '../src/data/decisions/driverInstructions';
import { qualifyingRunPlansById } from '../src/data/decisions/qualifyingRunPlans';
import { aiRaceDecision, aiQualifyingDecision } from '../src/game/ai';
import { simulateQualifying, qualifyingFormatFor } from '../src/sim/qualifyingEngine';
import { simulateRace } from '../src/sim/raceEngine';
import { buildDriverStandings, buildConstructorStandings } from '../src/sim/standingsEngine';
import { carPerformanceRating } from '../src/sim/trackFitEngine';
import { createNewGame } from '../src/game/initialCareer';
import { advanceSeason } from '../src/game/seasonRollover';
import { defaultCareerPhaseState, processAITeamActivity } from '../src/game/careerPhaseEngine';
import { activeDriversForTeam } from '../src/game/careerState';
import type { GameState } from '../src/game/careerState';
import { careerMarketBundle, youthProspectAge, YOUTH_MAX_AGE } from '../src/sim/careerMarketEngine';
import { normalizeName } from '../src/data/registry/masterRegistry';
import type { Entrant, RaceContext, QualifyingContext } from '../src/types/simTypes';
import type { RaceResult } from '../src/types/gameTypes';
import type { AIFinancialHealth } from '../src/types/aiTeamTypes';

const MARKET_TAGS = [
  'contract watch',
  'silly season',
  'transfer target',
  'contract target',
  'watch list',
  'rumour',
  'rumor',
  'free agent',
];

function hasMarketTag(name: string): boolean {
  const n = normalizeName(name);
  return MARKET_TAGS.some((t) => n.includes(t));
}

// The car-rating band above which a package is treated as "saturated" — a proxy
// for the 100.0 ceiling the balance pass is trying to keep clear.
const SATURATION_RATING = 98;

export type SeasonAudit = {
  year: number;
  // Constructors' champion (real, from simulated results).
  constructorChampion: { teamId: string; name: string; points: number } | undefined;
  driverChampion: { driverId: string; name: string; points: number } | undefined;
  // Car competitiveness spread across the grid this year.
  carRating: { min: number; avg: number; max: number };
  // How many cars are pinned at/near the 100.0 ceiling.
  saturatedCars: number;
  // AI budgets (player team excluded) in raw dollars.
  budget: { min: number; avg: number; max: number };
  financialHealth: Record<AIFinancialHealth, number>;
  archetypeCounts: Record<string, number>;
  aiActivity: { upgrades: number; reliabilityFixes: number; setbacks: number };
  driverAverage: number;
  // Invariant probes.
  duplicateNames: string[];
  academyOver21: { memberId: string; name: string; age: number }[];
  youthPoolOverAge: number;
  nameTagLeaks: string[];
  teamsWithoutTwoSeats: string[];
  reservesRacing: number;
};

export type CareerAuditReport = {
  seasons: SeasonAudit[];
  // Aggregate competitive-balance view over the whole run.
  constructorTitlesByTeam: Record<string, number>;
  distinctConstructorChampions: number;
  topTeamTitleShare: number; // fraction of seasons won by the most successful team
  everSaturated: boolean;
  maxCarRating: number;
};

type AuditOptions = {
  seasons?: number;
  seed?: string;
  seasonYear?: number;
};

// A deliberately non-existent team id. The audit runs with NO privileged player
// team so every constructor is AI-managed (develops its car, works the market,
// runs its budget through the AI spend model). This is what makes the budget /
// development / competitive numbers a faithful read of the AI systems: a real
// player team would be human-managed and its budget shaped by player spending
// choices the headless harness can't make, so leaving one un-managed would let
// it accrue income with nothing spending it down and pollute the report.
const NO_PLAYER_TEAM_ID = '__audit_no_player__';

// Simulate every round of the current season on the given state, all AI, and
// return the per-race results keyed by race id (as the reducer stores them).
function simulateSeason(
  state: GameState,
): {
  results: Record<string, RaceResult[]>;
  state: GameState;
  activity: { upgrades: number; reliabilityFixes: number; setbacks: number };
} {
  const pointsSystem = getPointsSystem(state.pointsSystemId);
  const maxQualifiers = getMaxQualifiers(state.series);
  const format = qualifyingFormatFor(state.seasonYear, state.series);

  const byRace: Record<string, RaceResult[]> = {};
  let workingState = state;
  let upgrades = 0;
  let reliabilityFixes = 0;
  let setbacks = 0;
  for (const race of state.calendar) {
    const phase = workingState.careerPhase ?? defaultCareerPhaseState();
    const previousNews = workingState.news;
    workingState = processAITeamActivity({
      ...workingState,
      careerPhase: {
        ...phase,
        currentRound: race.round,
        paddockWeekId: `audit-${workingState.seasonYear}-${race.round}`,
        aiActionsProcessedForCurrentWeek: false,
      },
    });
    const activityHeadlines = workingState.news
      .filter((n) => !previousNews.includes(n))
      .map((n) => n.headline);
    upgrades += activityHeadlines.filter((h) => h.includes('brings upgrade')).length;
    reliabilityFixes += activityHeadlines.filter((h) => h.includes('addresses reliability')).length;
    setbacks += activityHeadlines.filter((h) => h.includes('suffers setback')).length;
    const carByTeam = new Map(workingState.cars.map((c) => [c.teamId, c]));
    const entrants: Entrant[] = [];
    for (const team of workingState.teams) {
      const car = carByTeam.get(team.id);
      if (!car) continue;
      for (const driver of activeDriversForTeam(workingState, team.id)) entrants.push({ driver, car });
    }
    const teamReputation: Record<string, number> = {};
    const teamRaceOps: Record<string, number> = {};
    for (const t of workingState.teams) {
      teamReputation[t.id] = t.reputation;
      teamRaceOps[t.id] = t.raceOperations;
    }
    const track = getTrackById(race.trackId);
    if (!track) continue;
    const setupOptions = { ...setupOptionsById, ...autoSetupOptionsForTrack(track) };

    const qDecisions: QualifyingContext['decisions'] = {};
    entrants.forEach((e) => (qDecisions[e.driver.id] = aiQualifyingDecision(e.driver.id, track)));
    const qCtx: QualifyingContext = {
      track,
      entrants,
      decisions: qDecisions,
      setupOptions,
      runPlans: qualifyingRunPlansById,
      seed: `${workingState.randomSeed}-${workingState.seasonYear}-r${race.round}`,
      maxQualifiers,
      format,
      teamReputation,
      teamRaceOps,
    };
    const { results: qResults } = simulateQualifying(qCtx);

    const rDecisions: RaceContext['decisions'] = {};
    entrants.forEach((e) => (rDecisions[e.driver.id] = aiRaceDecision(e.driver.id, track)));
    const rCtx: RaceContext = {
      track,
      entrants,
      qualifyingResults: qResults,
      decisions: rDecisions,
      setupOptions,
      strategies: raceStrategiesById,
      instructions: driverInstructionsById,
      pointsByPosition: pointsSystem.pointsByPosition,
      seed: `${workingState.randomSeed}-${workingState.seasonYear}-r${race.round}`,
      year: workingState.seasonYear,
      teamReputation,
      teamRaceOps,
    };
    const { results } = simulateRace(rCtx);
    byRace[race.id] = results;
  }
  return { results: byRace, state: workingState, activity: { upgrades, reliabilityFixes, setbacks } };
}

function summarize(nums: number[]): { min: number; avg: number; max: number } {
  if (nums.length === 0) return { min: 0, avg: 0, max: 0 };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return { min: +min.toFixed(2), avg: +avg.toFixed(2), max: +max.toFixed(2) };
}

function auditSeason(
  state: GameState,
  aiActivity: SeasonAudit['aiActivity'],
): SeasonAudit {
  const teamName = new Map(state.teams.map((t) => [t.id, t.name]));
  const driverName = new Map(state.drivers.map((d) => [d.id, d.name]));

  const cs = state.constructorStandings;
  const ds = state.driverStandings;
  const constructorChampion = cs[0]
    ? { teamId: cs[0].entityId, name: teamName.get(cs[0].entityId) ?? cs[0].entityId, points: cs[0].points }
    : undefined;
  const driverChampion = ds[0]
    ? { driverId: ds[0].entityId, name: driverName.get(ds[0].entityId) ?? ds[0].entityId, points: ds[0].points }
    : undefined;

  const ratings = state.cars.map((c) => carPerformanceRating(c));
  const carRating = summarize(ratings);
  const saturatedCars = ratings.filter((r) => r >= SATURATION_RATING).length;

  const aiStates = state.aiTeamStates ?? {};
  const aiBudgets: number[] = [];
  const financialHealth: Record<AIFinancialHealth, number> = {
    Excellent: 0,
    Stable: 0,
    Tight: 0,
    AtRisk: 0,
    Critical: 0,
  };
  const archetypeCounts: Record<string, number> = {};
  for (const team of state.teams) {
    if (team.id === state.selectedTeamId) continue;
    aiBudgets.push(team.budget);
    const ai = aiStates[team.id];
    if (ai) {
      financialHealth[ai.financialHealth] += 1;
      archetypeCounts[ai.archetype] = (archetypeCounts[ai.archetype] ?? 0) + 1;
    }
  }
  const driverAverage = state.drivers.length
    ? state.drivers.reduce((sum, d) => sum + d.ratings.overall, 0) / state.drivers.length
    : 0;

  // Invariants.
  const names = state.drivers.map((d) => normalizeName(d.name));
  const duplicateNames = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];

  const bundle = careerMarketBundle(state);
  const nameTagLeaks: string[] = [];
  for (const d of state.drivers) if (hasMarketTag(d.name)) nameTagLeaks.push(d.name);
  for (const m of bundle.drivers) if (hasMarketTag(m.name)) nameTagLeaks.push(m.name);
  for (const y of bundle.youth) if (hasMarketTag(y.name)) nameTagLeaks.push(y.name);
  const youthPoolOverAge = bundle.youth.filter(
    (y) => youthProspectAge(y, state.seasonYear) > YOUTH_MAX_AGE,
  ).length;

  // Academy drivers age 21+ still stuck as academy-only (no senior role).
  const academyOver21: { memberId: string; name: string; age: number }[] = [];
  const allAcademy = [
    ...(state.academy ?? []),
    ...Object.values(state.aiAcademies ?? {}).flat(),
  ];
  for (const m of allAcademy) {
    const age = state.seasonYear - m.birthYear;
    if (age >= 21) {
      academyOver21.push({ memberId: m.id, name: m.name, age });
    }
  }

  const teamsWithoutTwoSeats: string[] = [];
  let reservesRacing = 0;
  for (const team of state.teams) {
    const active = activeDriversForTeam(state, team.id);
    if (active.length !== 2) teamsWithoutTwoSeats.push(team.id);
    for (const d of active) {
      if (d.contractType && d.contractType !== 'seat') reservesRacing += 1;
    }
  }

  return {
    year: state.seasonYear,
    constructorChampion,
    driverChampion,
    carRating,
    saturatedCars,
    budget: summarize(aiBudgets),
    financialHealth,
    archetypeCounts,
    aiActivity,
    driverAverage: +driverAverage.toFixed(2),
    duplicateNames,
    academyOver21,
    youthPoolOverAge,
    nameTagLeaks,
    teamsWithoutTwoSeats,
    reservesRacing,
  };
}

export function runCareerAudit(opts: AuditOptions = {}): CareerAuditReport {
  const seasonsToRun = opts.seasons ?? 20;
  const seed = opts.seed ?? 'career-audit-1990';
  const seasonYear = opts.seasonYear ?? 1990;
  const series = 'F1' as const;

  let state = createNewGame({
    gameMode: 'career',
    seasonYear,
    series,
    teamId: NO_PLAYER_TEAM_ID,
    seed,
  });

  const seasons: SeasonAudit[] = [];
  for (let i = 0; i < seasonsToRun; i++) {
    // Play the season for real so the standings reflect actual results.
    const simulated = simulateSeason(state);
    const completedRaceResults = simulated.results;
    const allResults = Object.values(completedRaceResults);
    const driverStandings = buildDriverStandings(allResults);
    const constructorStandings = buildConstructorStandings(allResults);
    state = {
      ...simulated.state,
      completedRaceResults,
      driverStandings,
      constructorStandings,
    };

    seasons.push(auditSeason(state, simulated.activity));

    // Roll the offseason over, feeding the real standings into the AI/finance/
    // development/regulation systems.
    state = advanceSeason({ ...state, seasonComplete: true });
  }

  const constructorTitlesByTeam: Record<string, number> = {};
  for (const s of seasons) {
    if (s.constructorChampion) {
      const id = s.constructorChampion.teamId;
      constructorTitlesByTeam[id] = (constructorTitlesByTeam[id] ?? 0) + 1;
    }
  }
  const titleCounts = Object.values(constructorTitlesByTeam);
  const topTeamTitleShare = titleCounts.length
    ? Math.max(...titleCounts) / seasons.length
    : 0;
  const maxCarRating = Math.max(...seasons.map((s) => s.carRating.max));

  return {
    seasons,
    constructorTitlesByTeam,
    distinctConstructorChampions: Object.keys(constructorTitlesByTeam).length,
    topTeamTitleShare: +topTeamTitleShare.toFixed(2),
    everSaturated: seasons.some((s) => s.saturatedCars > 0),
    maxCarRating: +maxCarRating.toFixed(2),
  };
}
