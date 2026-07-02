// Retirement / DNF audit — Quick Sim vs Live Race, game-wide (not a unit test).
//
// For every available season bundle it runs full headless seasons in both the
// Quick Sim (`simulateRace`) and the Live Race (lap-by-lap `stepLiveRace`), and
// reports DNF rate + cause split (mechanical / crash / tyre-damage / other) by
// year and by era, so the two engines can be compared and tuned to the era
// targets.
//
// Run explicitly (heavy; skipped in the normal suite):
//   RA_RUN=1 npx vitest run scripts/retirement-audit.test.ts --disable-console-intercept
//   RA_RUN=1 RA_QUICK_RUNS=20 RA_LIVE_RUNS=6 npx vitest run scripts/retirement-audit.test.ts --disable-console-intercept

import { test } from 'vitest';
import { seasonBundles, getTrackById, getMaxQualifiers } from '../src/data';
import { getPointsSystem } from '../src/data/pointsSystems/pointsSystems';
import { setupOptionsById } from '../src/data/setupOptions/setupOptions';
import { autoSetupOptionsForTrack } from '../src/sim/autoSetup';
import { raceStrategiesById } from '../src/data/decisions/raceStrategies';
import { driverInstructionsById } from '../src/data/decisions/driverInstructions';
import { qualifyingRunPlansById } from '../src/data/decisions/qualifyingRunPlans';
import { aiRaceDecision, aiQualifyingDecision } from '../src/game/ai';
import { simulateQualifying, qualifyingFormatFor } from '../src/sim/qualifyingEngine';
import { simulateRace } from '../src/sim/raceEngine';
import { createLiveRace, finalizeResults, type LiveRaceMeta, type LiveRaceOptions } from '../src/sim/liveRaceEngine';
import { stepLiveRace } from '../src/sim/raceTickEngine';
import { classifyDnfCause, type DnfCause } from '../src/sim/dnfModel';
import type { Entrant, RaceContext, QualifyingContext } from '../src/types/simTypes';
import type { RaceResult } from '../src/types/gameTypes';

type Tally = { starts: number; dnfs: number; causes: Record<DnfCause, number> };

const emptyTally = (): Tally => ({ starts: 0, dnfs: 0, causes: { Mechanical: 0, Crash: 0, TyreDamage: 0, Other: 0 } });

function addResult(t: Tally, res: RaceResult) {
  t.starts++;
  if (res.status === 'DNF') {
    t.dnfs++;
    t.causes[classifyDnfCause(res.incidents[0])]++;
  }
}

function mergeTally(into: Tally, from: Tally) {
  into.starts += from.starts;
  into.dnfs += from.dnfs;
  for (const c of Object.keys(from.causes) as DnfCause[]) into.causes[c] += from.causes[c];
}

function buildEntrants(key: string): Entrant[] {
  const { teams, drivers, cars } = seasonBundles[key];
  const carByTeam = new Map(cars.map((c) => [c.teamId, c]));
  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const entrants: Entrant[] = [];
  for (const team of teams) {
    const car = carByTeam.get(team.id);
    if (!car) continue;
    for (const did of team.driverIds) {
      const d = driverById.get(did);
      if (d) entrants.push({ driver: d, car });
    }
  }
  return entrants;
}

function teamMaps(key: string) {
  const { teams } = seasonBundles[key];
  const teamReputation: Record<string, number> = {};
  const teamRaceOps: Record<string, number> = {};
  const teamNames: Record<string, string> = {};
  teams.forEach((t) => {
    teamReputation[t.id] = t.reputation;
    teamRaceOps[t.id] = t.raceOperations;
    teamNames[t.id] = t.name;
  });
  return { teamReputation, teamRaceOps, teamNames };
}

function raceContextFor(key: string, roundIdx: number, seed: string): { ctx: RaceContext; totalLaps: number } | null {
  const { season } = seasonBundles[key];
  const race = season.calendar[roundIdx];
  const track = getTrackById(race.trackId);
  if (!track) return null;
  const entrants = buildEntrants(key);
  const { teamReputation, teamRaceOps } = teamMaps(key);
  const setupOptions = { ...setupOptionsById, ...autoSetupOptionsForTrack(track) };

  const qDecisions: QualifyingContext['decisions'] = {};
  entrants.forEach((e) => (qDecisions[e.driver.id] = aiQualifyingDecision(e.driver.id, track)));
  const { results: qResults } = simulateQualifying({
    track, entrants, decisions: qDecisions, setupOptions, runPlans: qualifyingRunPlansById,
    seed, maxQualifiers: getMaxQualifiers(season.series),
    format: qualifyingFormatFor(season.year, season.series), teamReputation, teamRaceOps,
  });
  const rDecisions: RaceContext['decisions'] = {};
  entrants.forEach((e) => (rDecisions[e.driver.id] = aiRaceDecision(e.driver.id, track)));
  const ctx: RaceContext = {
    track, entrants, qualifyingResults: qResults, decisions: rDecisions, setupOptions,
    strategies: raceStrategiesById, instructions: driverInstructionsById,
    pointsByPosition: getPointsSystem(season.pointsSystemId).pointsByPosition,
    seed, year: season.year, teamReputation, teamRaceOps,
  };
  return { ctx, totalLaps: race.laps };
}

function quickSeasonTally(key: string, runs: number): Tally {
  const { season } = seasonBundles[key];
  const t = emptyTally();
  for (let i = 0; i < runs; i++) {
    for (let r = 0; r < season.calendar.length; r++) {
      const built = raceContextFor(key, r, `ra-q-${key}-${i}-${r}`);
      if (!built) continue;
      const { results } = simulateRace(built.ctx);
      for (const res of results) addResult(t, res);
    }
  }
  return t;
}

function liveSeasonTally(key: string, runs: number): Tally {
  const { season } = seasonBundles[key];
  const { teamReputation, teamRaceOps, teamNames } = teamMaps(key);
  const t = emptyTally();
  for (let i = 0; i < runs; i++) {
    for (let r = 0; r < season.calendar.length; r++) {
      const built = raceContextFor(key, r, `ra-l-${key}-${i}-${r}`);
      if (!built) continue;
      const driverNames: Record<string, string> = {};
      built.ctx.entrants.forEach((e) => (driverNames[e.driver.id] = e.driver.name));
      const options: LiveRaceOptions = {
        raceId: 'ra', playerTeamId: '', totalLaps: built.totalLaps, driverNames,
        teamReputation, teamRaceOps, year: season.year, series: season.series,
      };
      const meta: LiveRaceMeta = { track: built.ctx.track, driverNames, teamNames, playerTeamId: '', year: season.year };
      let s = createLiveRace(built.ctx, options);
      let guard = 0;
      while (s.phase !== 'finished' && guard < s.totalLaps * 2 + 10) {
        if (s.pendingPrompt) s = { ...s, pendingPrompt: null };
        s = stepLiveRace(s, meta);
        guard++;
      }
      const { results } = finalizeResults(s, built.ctx);
      for (const res of results) addResult(t, res);
    }
  }
  return t;
}

function eraOf(year: number): string {
  if (year <= 1994) return '1990-1994 F1';
  if (year <= 2000) return '1995-2000 F1';
  if (year <= 2005) return '2001-2005 F1';
  if (year <= 2010) return '2006-2010 F1';
  return 'Modern';
}

function fmt(t: Tally): string {
  const d = Math.max(1, t.dnfs);
  const pct = (n: number) => `${Math.round((n / d) * 100)}`;
  const c = t.causes;
  return `DNF ${((t.dnfs / Math.max(1, t.starts)) * 100).toFixed(1)}% | ` +
    `${pct(c.Mechanical)}/${pct(c.Crash)}/${pct(c.TyreDamage)}/${pct(c.Other)} (m/c/t/o)`;
}

const ra = process.env.RA_RUN ? test : test.skip;

ra('retirement audit — Quick Sim vs Live Race, game-wide', () => {
  const quickRuns = Number(process.env.RA_QUICK_RUNS ?? 15);
  const liveRuns = Number(process.env.RA_LIVE_RUNS ?? 5);
  const keys = (process.env.RA_SEASONS ?? Object.keys(seasonBundles).join(',')).split(',');

  console.log(`\n=== Retirement audit (quick ${quickRuns} seasons, live ${liveRuns} seasons each) ===`);
  console.log('year/series          | QUICK  DNF% m/c/t/o        | LIVE   DNF% m/c/t/o');

  const eraQuick: Record<string, Tally> = {};
  const eraLive: Record<string, Tally> = {};

  for (const key of keys) {
    if (!seasonBundles[key]) throw new Error(`unknown season ${key}`);
    const { season } = seasonBundles[key];
    const q = quickSeasonTally(key, quickRuns);
    const l = liveSeasonTally(key, liveRuns);
    console.log(`${key.padEnd(20)} | ${fmt(q).padEnd(30)} | ${fmt(l)}`);
    const era = season.series === 'IndyCar' ? 'Modern IndyCar' : eraOf(season.year);
    eraQuick[era] ??= emptyTally();
    eraLive[era] ??= emptyTally();
    mergeTally(eraQuick[era], q);
    mergeTally(eraLive[era], l);
  }

  console.log('\n=== Era aggregates ===');
  console.log('era                  | QUICK  DNF% m/c/t/o        | LIVE   DNF% m/c/t/o');
  for (const era of Object.keys(eraQuick)) {
    console.log(`${era.padEnd(20)} | ${fmt(eraQuick[era]).padEnd(30)} | ${fmt(eraLive[era])}`);
  }

  // Game-wide tyre-share check.
  const allLive = emptyTally();
  Object.values(eraLive).forEach((t) => mergeTally(allLive, t));
  const tyreShare = (allLive.causes.TyreDamage / Math.max(1, allLive.dnfs)) * 100;
  console.log(`\nGame-wide Live tyre/damage share of DNFs: ${tyreShare.toFixed(1)}% (target < 10-12%)`);
}, 1_800_000);
