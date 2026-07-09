// Monte Carlo season simulator — balance-analysis harness (not a unit test).
//
// Runs full headless seasons (qualifying + quick race over every round, all
// cars AI-controlled) many times with different seeds and reports how often
// each team wins the constructors' title and each driver wins the drivers'
// title, plus average points by team / expected-standing group. Used to measure
// dominance before/after the balance pass.
//
// Run explicitly (it is excluded from the normal suite by the `test` script
// filtering, but vitest will pick it up if invoked directly):
//   npx vitest run scripts/montecarlo.test.ts
//
// Configure via env:
//   MC_RUNS=100  MC_SEASONS=1995-F1,2008-F1,2026-F1,2026-IndyCar
import { writeFileSync } from 'node:fs';
import { test } from 'vitest';
import { getTrackById, getMaxQualifiers } from '../src/data';
import { seasonBundles } from '../src/data/seasonData';
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
import type { Entrant, RaceContext, QualifyingContext } from '../src/types/simTypes';
import type { RaceResult } from '../src/types/gameTypes';

type SeasonReport = {
  key: string;
  year: number;
  series: string;
  runs: number;
  teamNames: Record<string, string>;
  driverNames: Record<string, string>;
  expectedStanding: Record<string, number>;
  constructorTitles: Record<string, number>;
  driverTitles: Record<string, number>;
  avgPointsByTeam: Record<string, number>;
  avgDnfsPerRace: number;
  dnfRateByStarts: number;
  // average points by expected-standing group (1-4, 5-8, 9+)
  groupAvgPoints: { top4: number; mid: number; back: number };
  topConstructorShare: number;
  topDriverShare: number;
  topConstructorTeam: string;
  topDriverName: string;
  // Race-winner variety across all races x runs.
  distinctRaceWinners: number;
  topWinnerShare: number; // % of all races won by the most frequent winner
  distinctPodiumTeams: number;
  // Avg points-scoring finishes per season by expected-standing group.
  midScoresPerSeason: number; // 5-8 teams
  backScoresPerSeason: number; // 9+ teams
};

function runSeason(key: string, seed: string): { drivers: RaceResult[][]; teams: RaceResult[][] } {
  const bundle = seasonBundles[key];
  const { season, teams, drivers, cars } = bundle;
  const carByTeam = new Map(cars.map((c) => [c.teamId, c]));
  const driverById = new Map(drivers.map((d) => [d.id, d]));

  const entrants: Entrant[] = [];
  for (const team of teams) {
    const car = carByTeam.get(team.id);
    if (!car) continue;
    for (const did of team.driverIds) {
      const driver = driverById.get(did);
      if (driver) entrants.push({ driver, car });
    }
  }
  const teamReputation: Record<string, number> = {};
  const teamRaceOps: Record<string, number> = {};
  teams.forEach((t) => {
    teamReputation[t.id] = t.reputation;
    teamRaceOps[t.id] = t.raceOperations;
  });
  const pointsSystem = getPointsSystem(season.pointsSystemId);
  const maxQualifiers = getMaxQualifiers(season.series);
  const format = qualifyingFormatFor(season.year, season.series);

  const allResults: RaceResult[][] = [];
  for (const race of season.calendar) {
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
      seed: `${seed}-r${race.round}`,
      maxQualifiers,
      format,
      teamReputation,
      teamRaceOps,
    };
    const { results: qResults } = simulateQualifying(qCtx);
    const qualifiedIds = new Set(qResults.filter((r) => !r.dnq).map((r) => r.driverId));
    const raceEntrants = entrants.filter((e) => qualifiedIds.has(e.driver.id));
    const raceQualifyingResults = qResults.filter((r) => !r.dnq);

    const rDecisions: RaceContext['decisions'] = {};
    raceEntrants.forEach((e) => (rDecisions[e.driver.id] = aiRaceDecision(e.driver.id, track)));
    const rCtx: RaceContext = {
      track,
      entrants: raceEntrants,
      qualifyingResults: raceQualifyingResults,
      decisions: rDecisions,
      setupOptions,
      strategies: raceStrategiesById,
      instructions: driverInstructionsById,
      pointsByPosition: pointsSystem.pointsByPosition,
      seed: `${seed}-r${race.round}`,
      year: season.year,
      teamReputation,
      teamRaceOps,
    };
    const { results } = simulateRace(rCtx);
    allResults.push(results);
  }
  return { drivers: allResults, teams: allResults };
}

function analyzeSeason(key: string, runs: number): SeasonReport {
  const bundle = seasonBundles[key];
  const { season, teams, drivers } = bundle;
  const teamNames: Record<string, string> = {};
  teams.forEach((t) => (teamNames[t.id] = t.name));
  const driverNames: Record<string, string> = {};
  drivers.forEach((d) => (driverNames[d.id] = d.name));
  const expectedStanding: Record<string, number> = {};
  teams.forEach((t) => (expectedStanding[t.id] = t.expectedStanding ?? 99));

  const constructorTitles: Record<string, number> = {};
  const driverTitles: Record<string, number> = {};
  const pointsSum: Record<string, number> = {};
  const raceWins: Record<string, number> = {};
  const podiumTeams = new Set<string>();
  let totalRaces = 0;
  let midScores = 0;
  let backScores = 0;
  let totalStarts = 0;
  let totalDnfs = 0;

  for (let i = 0; i < runs; i++) {
    const seed = `mc-${key}-${i}`;
    const { teams: allResults } = runSeason(key, seed);
    const cs = buildConstructorStandings(allResults);
    const ds = buildDriverStandings(allResults);
    if (cs[0]) constructorTitles[cs[0].entityId] = (constructorTitles[cs[0].entityId] ?? 0) + 1;
    if (ds[0]) driverTitles[ds[0].entityId] = (driverTitles[ds[0].entityId] ?? 0) + 1;
    for (const entry of cs) pointsSum[entry.entityId] = (pointsSum[entry.entityId] ?? 0) + entry.points;
    for (const race of allResults) {
      totalRaces++;
      totalStarts += race.length;
      totalDnfs += race.filter((r) => r.status !== 'Finished').length;
      const winner = race.find((r) => r.position === 1);
      if (winner) raceWins[winner.driverId] = (raceWins[winner.driverId] ?? 0) + 1;
      race.filter((r) => r.position !== null && r.position <= 3).forEach((r) => podiumTeams.add(r.teamId));
      for (const r of race) {
        if (r.points <= 0) continue;
        const es = expectedStanding[r.teamId] ?? 99;
        if (es >= 5 && es <= 8) midScores++;
        else if (es >= 9) backScores++;
      }
    }
  }
  const topWin = Object.entries(raceWins).sort((a, b) => b[1] - a[1])[0] ?? ['', 0];

  const avgPointsByTeam: Record<string, number> = {};
  for (const id of Object.keys(pointsSum)) avgPointsByTeam[id] = +(pointsSum[id] / runs).toFixed(1);

  const grp = { top4: [0, 0], mid: [0, 0], back: [0, 0] } as Record<string, [number, number]>;
  for (const t of teams) {
    const es = expectedStanding[t.id];
    const ap = avgPointsByTeam[t.id] ?? 0;
    const bucket = es <= 4 ? 'top4' : es <= 8 ? 'mid' : 'back';
    grp[bucket][0] += ap;
    grp[bucket][1] += 1;
  }
  const groupAvgPoints = {
    top4: grp.top4[1] ? +(grp.top4[0] / grp.top4[1]).toFixed(1) : 0,
    mid: grp.mid[1] ? +(grp.mid[0] / grp.mid[1]).toFixed(1) : 0,
    back: grp.back[1] ? +(grp.back[0] / grp.back[1]).toFixed(1) : 0,
  };

  const topC = Object.entries(constructorTitles).sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
  const topD = Object.entries(driverTitles).sort((a, b) => b[1] - a[1])[0] ?? ['', 0];

  return {
    key,
    year: season.year,
    series: season.series,
    runs,
    teamNames,
    driverNames,
    expectedStanding,
    constructorTitles,
    driverTitles,
    avgPointsByTeam,
    groupAvgPoints,
    avgDnfsPerRace: +(totalDnfs / Math.max(1, totalRaces)).toFixed(1),
    dnfRateByStarts: +((totalDnfs / Math.max(1, totalStarts)) * 100).toFixed(1),
    topConstructorShare: +((topC[1] / runs) * 100).toFixed(1),
    topDriverShare: +((topD[1] / runs) * 100).toFixed(1),
    topConstructorTeam: teamNames[topC[0]] ?? topC[0],
    topDriverName: driverNames[topD[0]] ?? topD[0],
    distinctRaceWinners: Object.keys(raceWins).length,
    topWinnerShare: +((topWin[1] / Math.max(1, totalRaces)) * 100).toFixed(1),
    distinctPodiumTeams: podiumTeams.size,
    midScoresPerSeason: +(midScores / runs).toFixed(1),
    backScoresPerSeason: +(backScores / runs).toFixed(1),
  };
}

// Heavy analysis harness — skipped in the normal suite. Enable with MC_RUN=1:
//   MC_RUN=1 MC_RUNS=100 npx vitest run scripts/montecarlo.test.ts
const mc = process.env.MC_RUN || process.env.MC_RUNS || process.env.MC_SEASONS ? test : test.skip;

mc('monte carlo season dominance', () => {
  const runs = Number(process.env.MC_RUNS ?? 5);
  const seasonsEnv = process.env.MC_SEASONS;
  const keys = seasonsEnv ? seasonsEnv.split(',') : ['1995-F1', '2008-F1', '2026-F1', '2026-IndyCar'];
  const out: SeasonReport[] = [];
  for (const key of keys) {
    if (!seasonBundles[key]) throw new Error(`unknown season ${key}`);
    const rep = analyzeSeason(key, runs);
    out.push(rep);
    console.log(
      `${key}: top constructor ${rep.topConstructorTeam} ${rep.topConstructorShare}% | ` +
        `top driver ${rep.topDriverName} ${rep.topDriverShare}% | ` +
        `avg pts top4=${rep.groupAvgPoints.top4} mid(5-8)=${rep.groupAvgPoints.mid} back(9+)=${rep.groupAvgPoints.back} | ` +
        `DNFs/race=${rep.avgDnfsPerRace} DNF/start=${rep.dnfRateByStarts}%`,
    );
  }
  const label = process.env.MC_LABEL ?? 'baseline';
  writeFileSync(`scripts/montecarlo_${label}.json`, JSON.stringify(out, null, 2));
}, 1_800_000);
