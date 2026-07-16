// Retirement / DNF audit — Quick Sim vs Live Race, game-wide (not a unit test).
//
// Run explicitly (heavy; skipped in the normal suite):
//   RA_RUN=1 npx vitest run scripts/retirement-audit.test.ts --disable-console-intercept
//   RA_RUN=1 RA_SERIES=F1 RA_START_YEAR=1990 RA_END_YEAR=1999 RA_QUICK_RUNS=20 RA_LIVE_RUNS=6 npx vitest run scripts/retirement-audit.test.ts --disable-console-intercept
//
// Filters:
//   RA_SERIES      - series to include (e.g. 'F1'; multiple with comma)
//   RA_START_YEAR  - first year to include
//   RA_END_YEAR    - last year to include
//   RA_SEASONS     - optional explicit comma-separated list of keys (e.g. '1990-F1,1991-F1')
//   RA_QUICK_RUNS  - seasons of quick-sim runs per season (default 15)
//   RA_LIVE_RUNS   - seasons of live-race runs per season (default 5)
//   RA_ASSERT      - if 1, fail when combined 1990-1999 F1 is outside target bands

import { expect, test } from 'vitest';
import { availableSeasons, loadSeasonBundle, getTrackById, getMaxQualifiers } from '../src/data';
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
import type { RaceResult, SeasonBundle } from '../src/types/gameTypes';

type Tally = {
  starts: number;
  dnfs: number;
  races: number;
  qualEntries: number;
  dnq: number;
  causes: Record<DnfCause, number>;
};

const emptyTally = (): Tally => ({
  starts: 0,
  dnfs: 0,
  races: 0,
  qualEntries: 0,
  dnq: 0,
  causes: { Mechanical: 0, Crash: 0, TyreDamage: 0, Other: 0 },
});

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
  into.races += from.races;
  into.qualEntries += from.qualEntries;
  into.dnq += from.dnq;
  for (const c of Object.keys(from.causes) as DnfCause[]) into.causes[c] += from.causes[c];
}

function buildEntrants(bundle: SeasonBundle): Entrant[] {
  const carByTeam = new Map(bundle.cars.map((c) => [c.teamId, c]));
  const driverById = new Map(bundle.drivers.map((d) => [d.id, d]));
  const entrants: Entrant[] = [];
  for (const team of bundle.teams) {
    const car = carByTeam.get(team.id);
    if (!car) continue;
    for (const did of team.driverIds) {
      const d = driverById.get(did);
      if (d) entrants.push({ driver: d, car });
    }
  }
  return entrants;
}

function teamMaps(bundle: SeasonBundle) {
  const teamReputation: Record<string, number> = {};
  const teamRaceOps: Record<string, number> = {};
  const teamNames: Record<string, string> = {};
  for (const t of bundle.teams) {
    teamReputation[t.id] = t.reputation;
    teamRaceOps[t.id] = t.raceOperations;
    teamNames[t.id] = t.name;
  }
  return { teamReputation, teamRaceOps, teamNames };
}

async function raceContextFor(
  bundle: SeasonBundle,
  roundIdx: number,
  qSeed: string,
  rSeed: string,
): Promise<{ ctx: RaceContext; totalLaps: number; qualEntries: number; dnq: number } | null> {
  const race = bundle.season.calendar[roundIdx];
  const track = getTrackById(race.trackId);
  if (!track) return null;

  const allEntrants = buildEntrants(bundle);
  const { teamReputation, teamRaceOps } = teamMaps(bundle);
  const setupOptions = { ...setupOptionsById, ...autoSetupOptionsForTrack(track) };

  const qDecisions: QualifyingContext['decisions'] = {};
  for (const e of allEntrants) qDecisions[e.driver.id] = aiQualifyingDecision(e.driver.id, track);
  const { results: qResults } = simulateQualifying({
    track,
    entrants: allEntrants,
    decisions: qDecisions,
    setupOptions,
    runPlans: qualifyingRunPlansById,
    seed: qSeed,
    maxQualifiers: getMaxQualifiers(bundle.season.series),
    format: qualifyingFormatFor(bundle.season.year, bundle.season.series),
    teamReputation,
    teamRaceOps,
  });

  const dnqSet = new Set(qResults.filter((q) => q.dnq).map((q) => q.driverId));
  const raceEntrants = allEntrants.filter((e) => !dnqSet.has(e.driver.id));

  const rDecisions: RaceContext['decisions'] = {};
  for (const e of raceEntrants) rDecisions[e.driver.id] = aiRaceDecision(e.driver.id, track);

  const ctx: RaceContext = {
    track,
    entrants: raceEntrants,
    qualifyingResults: qResults,
    decisions: rDecisions,
    setupOptions,
    strategies: raceStrategiesById,
    instructions: driverInstructionsById,
    pointsByPosition: getPointsSystem(bundle.season.pointsSystemId).pointsByPosition,
    seed: rSeed,
    year: bundle.season.year,
    teamReputation,
    teamRaceOps,
  };

  return {
    ctx,
    totalLaps: race.laps,
    qualEntries: allEntrants.length,
    dnq: qResults.filter((q) => q.dnq).length,
  };
}

async function quickSeasonTally(bundle: SeasonBundle, runs: number): Promise<Tally> {
  const t = emptyTally();
  for (let i = 0; i < runs; i++) {
    for (let r = 0; r < bundle.season.calendar.length; r++) {
      const built = await raceContextFor(
        bundle,
        r,
        `ra-q-${bundle.season.year}-${bundle.season.series}-${i}-${r}`,
        `ra-qr-${bundle.season.year}-${bundle.season.series}-${i}-${r}`,
      );
      if (!built) continue;
      t.qualEntries += built.qualEntries;
      t.dnq += built.dnq;
      t.races++;
      const { results } = simulateRace(built.ctx);
      for (const res of results) addResult(t, res);
    }
  }
  return t;
}

async function liveSeasonTally(bundle: SeasonBundle, runs: number): Promise<Tally> {
  const { teamReputation, teamRaceOps, teamNames } = teamMaps(bundle);
  const t = emptyTally();
  for (let i = 0; i < runs; i++) {
    for (let r = 0; r < bundle.season.calendar.length; r++) {
      const built = await raceContextFor(
        bundle,
        r,
        `ra-l-q-${bundle.season.year}-${bundle.season.series}-${i}-${r}`,
        `ra-l-r-${bundle.season.year}-${bundle.season.series}-${i}-${r}`,
      );
      if (!built) continue;
      t.qualEntries += built.qualEntries;
      t.dnq += built.dnq;
      t.races++;
      const driverNames: Record<string, string> = {};
      built.ctx.entrants.forEach((e) => (driverNames[e.driver.id] = e.driver.name));
      const options: LiveRaceOptions = {
        raceId: 'ra',
        playerTeamId: '',
        totalLaps: built.totalLaps,
        driverNames,
        teamReputation,
        teamRaceOps,
        year: bundle.season.year,
        series: bundle.season.series,
      };
      const meta: LiveRaceMeta = {
        track: built.ctx.track,
        driverNames,
        teamNames,
        playerTeamId: '',
        year: bundle.season.year,
      };
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
  if (year <= 1994) return '1990-1994';
  if (year <= 2000) return '1995-2000';
  if (year <= 2005) return '2001-2005';
  if (year <= 2010) return '2006-2010';
  return 'Modern';
}

function fmt(t: Tally): string {
  const d = Math.max(1, t.dnfs);
  const c = t.causes;
  const pct = (n: number) => `${Math.round((n / d) * 100)}`;
  const dpr = t.dnfs / Math.max(1, t.races);
  return `DNF ${dpr.toFixed(2)}/race (${t.dnfs}/${t.races}) | ` +
    `${pct(c.Mechanical)}/${pct(c.Crash)}/${pct(c.TyreDamage)}/${pct(c.Other)} (m/c/t/o)`;
}

function row(label: string, t: Tally): string {
  const d = Math.max(1, t.dnfs);
  const pct = (n: number) => (n / d) * 100;
  const c = t.causes;
  const dpr = t.dnfs / Math.max(1, t.races);
  return `${label.padEnd(20)} | ` +
    `races=${t.races} q=${t.qualEntries} dnq=${t.dnq} ` +
    `dnf=${t.dnfs} dpr=${dpr.toFixed(2)} ` +
    `mech=${pct(c.Mechanical).toFixed(1)}% crash=${pct(c.Crash).toFixed(1)}% ` +
    `tyre=${pct(c.TyreDamage).toFixed(1)}% other=${pct(c.Other).toFixed(1)}%`;
}

function filteredSeasons() {
  const seriesFilter = (process.env.RA_SERIES ?? '').split(',').filter(Boolean);
  const startYear = process.env.RA_START_YEAR ? Number(process.env.RA_START_YEAR) : undefined;
  const endYear = process.env.RA_END_YEAR ? Number(process.env.RA_END_YEAR) : undefined;
  const explicit = (process.env.RA_SEASONS ?? '').split(',').filter(Boolean);

  if (explicit.length > 0) {
    return availableSeasons.filter((s) => explicit.includes(`${s.year}-${s.series}`));
  }

  return availableSeasons.filter((s) => {
    if (seriesFilter.length > 0 && !seriesFilter.includes(s.series)) return false;
    if (startYear !== undefined && s.year < startYear) return false;
    if (endYear !== undefined && s.year > endYear) return false;
    return true;
  });
}

const ra = process.env.RA_RUN ? test : test.skip;

ra('retirement audit — Quick Sim vs Live Race', async () => {
  const quickRuns = Number(process.env.RA_QUICK_RUNS ?? 15);
  const liveRuns = Number(process.env.RA_LIVE_RUNS ?? 5);
  const doAssert = process.env.RA_ASSERT === '1';
  const seasons = filteredSeasons();

  console.log(`\n=== Retirement audit (quick ${quickRuns} runs, live ${liveRuns} runs per season) ===`);
  console.log('year/series            | QUICK');
  console.log('year/series            | LIVE');

  const eraQuick: Record<string, Tally> = {};
  const eraLive: Record<string, Tally> = {};
  const bySeason: Record<string, { quick: Tally; live: Tally }> = {};

  for (const meta of seasons) {
    const key = `${meta.year}-${meta.series}`;
    const bundle = await loadSeasonBundle(meta.year, meta.series);
    if (!bundle) {
      console.warn(`Could not load season ${key}`);
      continue;
    }
    const q = await quickSeasonTally(bundle, quickRuns);
    const l = await liveSeasonTally(bundle, liveRuns);
    bySeason[key] = { quick: q, live: l };
    console.log(`${key.padEnd(20)} | QUICK ${fmt(q)}`);
    console.log(`${key.padEnd(20)} | LIVE  ${fmt(l)}`);

    const era = `${eraOf(meta.year)} ${meta.series}`;
    eraQuick[era] ??= emptyTally();
    eraLive[era] ??= emptyTally();
    mergeTally(eraQuick[era], q);
    mergeTally(eraLive[era], l);
  }

  console.log('\n=== Era aggregates (Quick) ===');
  for (const era of Object.keys(eraQuick)) {
    console.log(row(era, eraQuick[era]));
  }

  console.log('\n=== Era aggregates (Live) ===');
  for (const era of Object.keys(eraLive)) {
    console.log(row(era, eraLive[era]));
  }

  // Combined 1990-1999 F1 assertion.
  if (doAssert) {
    const combined = emptyTally();
    for (const key of Object.keys(bySeason)) {
      if (!key.endsWith('-F1')) continue;
      const year = Number(key.split('-')[0]);
      if (year >= 1990 && year <= 1999) {
        mergeTally(combined, bySeason[key].quick);
      }
    }

    const dnfPerRace = combined.dnfs / Math.max(1, combined.races);
    const mechPct = (combined.causes.Mechanical / Math.max(1, combined.dnfs)) * 100;
    const crashPct = (combined.causes.Crash / Math.max(1, combined.dnfs)) * 100;
    const tyrePct = (combined.causes.TyreDamage / Math.max(1, combined.dnfs)) * 100;
    const otherPct = (combined.causes.Other / Math.max(1, combined.dnfs)) * 100;

    console.log(`\n=== 1990-1999 F1 combined assertion ===`);
    console.log(`DNFs/race: ${dnfPerRace.toFixed(2)} (target 10.8-11.7)`);
    console.log(`Mechanical: ${mechPct.toFixed(1)}% (target 60-68)`);
    console.log(`Crash: ${crashPct.toFixed(1)}% (target 25-33)`);
    console.log(`Tyre: ${tyrePct.toFixed(1)}% (target 2-4)`);
    console.log(`Other: ${otherPct.toFixed(1)}% (target 4-8)`);

    const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
    expect(dnfPerRace, '1990-1999 F1 DNFs/race').toSatisfy((v: number) => inRange(v, 10.8, 11.7));
    expect(mechPct, '1990-1999 F1 mechanical %').toSatisfy((v: number) => inRange(v, 60, 68));
    expect(crashPct, '1990-1999 F1 crash %').toSatisfy((v: number) => inRange(v, 25, 33));
    expect(tyrePct, '1990-1999 F1 tyre %').toSatisfy((v: number) => inRange(v, 2, 4));
    expect(otherPct, '1990-1999 F1 other %').toSatisfy((v: number) => inRange(v, 4, 8));
  }
}, 1_800_000);
