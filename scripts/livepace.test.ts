// Live Race Pace validation harness (not a unit test).
//
// Measures the behaviour of the Live Race Pace system:
//   1. DNF-cause split by era (quick sim) vs the era targets in dnfModel.
//   2. Live-race pace/tyre/risk progression across race segments.
//   3. Strategy-mode balance (Conservative safer/slower, Push/Attack faster/riskier).
//
// Run explicitly (heavy; skipped in the normal suite):
//   LP_RUN=1 npx vitest run scripts/livepace.test.ts
//   LP_RUN=1 LP_RUNS=40 npx vitest run scripts/livepace.test.ts

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
import { stepLiveRace, setPlayerPaceMode } from '../src/sim/raceTickEngine';
import { classifyDnfCause, eraDnfProfile, eraReliabilityScale, type DnfCause } from '../src/sim/dnfModel';
import type { PaceMode, LiveRaceState } from '../src/types/liveTypes';
import type { Entrant, RaceContext, QualifyingContext } from '../src/types/simTypes';

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

function buildRaceContext(key: string, roundIdx: number, seed: string): { ctx: RaceContext; totalLaps: number } | null {
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
    track,
    entrants,
    decisions: qDecisions,
    setupOptions,
    runPlans: qualifyingRunPlansById,
    seed,
    maxQualifiers: getMaxQualifiers(season.series),
    format: qualifyingFormatFor(season.year, season.series),
    teamReputation,
    teamRaceOps,
  });

  const rDecisions: RaceContext['decisions'] = {};
  entrants.forEach((e) => (rDecisions[e.driver.id] = aiRaceDecision(e.driver.id, track)));
  const ctx: RaceContext = {
    track,
    entrants,
    qualifyingResults: qResults,
    decisions: rDecisions,
    setupOptions,
    strategies: raceStrategiesById,
    instructions: driverInstructionsById,
    pointsByPosition: getPointsSystem(season.pointsSystemId).pointsByPosition,
    seed,
    year: season.year,
    teamReputation,
    teamRaceOps,
  };
  return { ctx, totalLaps: race.laps };
}

// -----------------------------------------------------------------------------
// 1. DNF-cause split by era (quick sim)
// -----------------------------------------------------------------------------

function dnfSplitBySeason(key: string, runs: number) {
  const { season } = seasonBundles[key];
  const entrants = buildEntrants(key);
  const { teamReputation, teamRaceOps } = teamMaps(key);
  const counts: Record<DnfCause, number> = { Mechanical: 0, Crash: 0, TyreDamage: 0, Other: 0 };
  let dnfs = 0;
  let starts = 0;

  for (let i = 0; i < runs; i++) {
    for (let r = 0; r < season.calendar.length; r++) {
      const race = season.calendar[r];
      const track = getTrackById(race.trackId);
      if (!track) continue;
      const seed = `lp-${key}-${i}-${r}`;
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
      const { results } = simulateRace(ctx);
      for (const res of results) {
        starts++;
        if (res.status === 'DNF') {
          dnfs++;
          counts[classifyDnfCause(res.incidents[0])]++;
        }
      }
    }
  }
  const total = Math.max(1, dnfs);
  const observed = {
    reliability: counts.Mechanical / total,
    crash: counts.Crash / total,
    tyre: counts.TyreDamage / total,
    other: counts.Other / total,
  };
  return {
    year: season.year,
    dnfRate: dnfs / Math.max(1, starts),
    relDnfsPerSeason: counts.Mechanical / runs,
    observed,
    target: eraDnfProfile(season.year),
    relScale: eraReliabilityScale(season.year),
  };
}

// -----------------------------------------------------------------------------
// 2 & 3. Live-race helpers
// -----------------------------------------------------------------------------

function liveOptions(key: string, ctx: RaceContext, totalLaps: number, playerTeamId: string): { options: LiveRaceOptions; meta: LiveRaceMeta } {
  const { season } = seasonBundles[key];
  const { teamReputation, teamRaceOps, teamNames } = teamMaps(key);
  const driverNames: Record<string, string> = {};
  ctx.entrants.forEach((e) => (driverNames[e.driver.id] = e.driver.name));
  const options: LiveRaceOptions = {
    raceId: 'lp', playerTeamId, totalLaps, driverNames, teamReputation, teamRaceOps, year: season.year, series: season.series,
  };
  const meta: LiveRaceMeta = { track: ctx.track, driverNames, teamNames, playerTeamId, year: season.year };
  return { options, meta };
}

function runLive(
  state: LiveRaceState,
  meta: LiveRaceMeta,
  forceMode?: { driverId: string; mode: PaceMode },
): { state: LiveRaceState; avgLivePace: number } {
  let s = state;
  let guard = 0;
  let paceSum = 0;
  let paceN = 0;
  while (s.phase !== 'finished' && guard < s.totalLaps * 2 + 10) {
    if (s.pendingPrompt) {
      // auto-resolve player prompts with the first (default) option
      s = { ...s, pendingPrompt: null };
    }
    if (forceMode) s = setPlayerPaceMode(s, forceMode.driverId, forceMode.mode);
    s = stepLiveRace(s, meta);
    if (forceMode) {
      const c = s.cars.find((x) => x.driverId === forceMode.driverId);
      if (c && c.running) {
        paceSum += c.liveRacePace;
        paceN++;
      }
    }
    guard++;
  }
  return { state: s, avgLivePace: paceN ? paceSum / paceN : 0 };
}

// -----------------------------------------------------------------------------

const lp = process.env.LP_RUN ? test : test.skip;

lp('live pace — DNF cause split by era', () => {
  const runs = Number(process.env.LP_RUNS ?? 30);
  const keys = (process.env.LP_SEASONS ?? '1992-F1,1998-F1,2003-F1,2008-F1,2010-F1,2026-F1').split(',');
  console.log(`\n=== DNF cause split by era (${runs} seasons each) ===`);
  console.log('year | DNF% | rel/season | observed r/c/t/o vs target r/c/t/o | relScale');
  for (const key of keys) {
    if (!seasonBundles[key]) throw new Error(`unknown season ${key}`);
    const d = dnfSplitBySeason(key, runs);
    const o = d.observed;
    const t = d.target;
    const pct = (n: number) => `${Math.round(n * 100)}`;
    console.log(
      `${d.year} | ${(d.dnfRate * 100).toFixed(1)}% | ${d.relDnfsPerSeason.toFixed(1)} | ` +
      `obs ${pct(o.reliability)}/${pct(o.crash)}/${pct(o.tyre)}/${pct(o.other)} ` +
      `vs tgt ${pct(t.reliability)}/${pct(t.crash)}/${pct(t.tyre)}/${pct(t.other)} | ×${d.relScale}`,
    );
  }
}, 600_000);

lp('live pace — segment progression sample', () => {
  const key = process.env.LP_SAMPLE_SEASON ?? '2008-F1';
  const built = buildRaceContext(key, 0, `lp-sample-${key}`);
  if (!built) throw new Error('no context');
  const playerTeamId = seasonBundles[key].teams[5].id; // a midfield team
  const { options, meta } = liveOptions(key, built.ctx, built.totalLaps, playerTeamId);
  let s = createLiveRace(built.ctx, options);

  const segLaps = [1, 0.15, 0.35, 0.5, 0.7, 0.9, 1.0].map((f) => (f <= 1 && f > 0 && f < 1 ? Math.round(f * s.totalLaps) : f === 1 ? s.totalLaps : 1));
  const marks = new Set([1, Math.round(0.2 * s.totalLaps), Math.round(0.4 * s.totalLaps), Math.round(0.6 * s.totalLaps), Math.round(0.8 * s.totalLaps), s.totalLaps - 1]);

  console.log(`\n=== Live-race segment progression: ${key} round 1 (${s.totalLaps} laps) ===`);
  console.log('Tracking leader + player car. lap | leader pace/tyre | player pos/mode/livePace/base/tyre/relRisk/crashRisk/status');
  void segLaps;
  while (s.phase !== 'finished') {
    if (s.pendingPrompt) s = { ...s, pendingPrompt: null };
    s = stepLiveRace(s, meta);
    if (marks.has(s.currentLap)) {
      const leader = s.cars.find((c) => c.position === 1);
      const player = s.cars.filter((c) => c.isPlayer).sort((a, b) => (a.position ?? 99) - (b.position ?? 99))[0];
      if (leader && player) {
        console.log(
          `L${s.currentLap} | leader ${meta.driverNames[leader.driverId]} pace ${leader.liveRacePace.toFixed(1)} tyre ${Math.round(leader.tire.wear)}% | ` +
          `player ${player.running ? `P${player.position}` : 'OUT'} ${player.paceMode} live ${player.liveRacePace.toFixed(1)} base ${player.baseRacePace.toFixed(1)} ` +
          `tyre ${Math.round(player.tire.wear)}% rel ${player.reliabilityRiskLevel} crash ${player.crashRiskLevel} — ${player.statusMessage}`,
        );
      }
    }
  }
  const { results } = finalizeResults(s, built.ctx);
  const podium = results.filter((r) => r.position != null && r.position <= 5)
    .map((r) => `P${r.position} ${meta.driverNames[r.driverId]}`);
  console.log(`Top 5: ${podium.join(', ')}`);
  const dnf = results.filter((r) => r.status === 'DNF').map((r) => `${meta.driverNames[r.driverId]} (${r.incidents[0]})`);
  console.log(`DNFs (${dnf.length}): ${dnf.join(', ') || 'none'}`);
}, 600_000);

lp('live pace — strategy-mode balance', () => {
  const runs = Number(process.env.LP_MODE_RUNS ?? 40);
  const key = process.env.LP_SAMPLE_SEASON ?? '2008-F1';
  const playerTeamId = seasonBundles[key].teams[5].id;
  const modes: PaceMode[] = ['Conservative', 'Balanced', 'Push', 'Attack'];
  console.log(`\n=== Strategy-mode balance: ${key}, midfield car, ${runs} races each ===`);
  console.log('mode | avg live pace | DNF% | avg finish tyre% | avg posGain');
  for (const mode of modes) {
    let paceSum = 0, paceN = 0, dnf = 0, tyreSum = 0, posGain = 0, finN = 0, n = 0;
    for (let i = 0; i < runs; i++) {
      const built = buildRaceContext(key, i % seasonBundles[key].season.calendar.length, `lp-mode-${key}-${mode}-${i}`);
      if (!built) continue;
      const { options, meta } = liveOptions(key, built.ctx, built.totalLaps, playerTeamId);
      const driverId = built.ctx.entrants.find((e) => e.driver.teamId === playerTeamId)?.driver.id;
      if (!driverId) continue;
      const s0 = createLiveRace(built.ctx, options);
      const { state: s, avgLivePace } = runLive(s0, meta, { driverId, mode });
      const car = s.cars.find((c) => c.driverId === driverId);
      if (!car) continue;
      n++;
      paceSum += avgLivePace; paceN++;
      if (car.status === 'DNF') dnf++;
      else {
        finN++;
        tyreSum += car.tire.wear;
        posGain += car.grid - (car.position ?? car.grid);
      }
    }
    console.log(
      `${mode.padEnd(13)} | ${(paceN ? paceSum / paceN : 0).toFixed(2)} | ${((dnf / Math.max(1, n)) * 100).toFixed(1)}% | ` +
      `${(finN ? tyreSum / finN : 0).toFixed(0)}% | ${(finN ? posGain / finN : 0).toFixed(2)}`,
    );
  }
}, 600_000);
