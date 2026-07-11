import { writeFileSync } from 'node:fs';
import { loadSeasonBundle } from '../src/data/seasonLoader';
import { carPerformanceRating } from '../src/sim/trackFitEngine';
import type { CarRatings } from '../src/types/gameTypes';

type EraBand = 'classic' | 'transition' | 'compressed-modern' | 'modern-reset';

type PreviewRow = {
  year: number;
  eraBand: EraBand;
  expectedStanding: number;
  teamId: string;
  team: string;
  currentAvg: number;
  targetAvg: number;
  delta: number;
  currentRep: number;
  targetRep: number;
  repDelta: number;
  currentRaceOps: number;
  targetRaceOps: number;
  raceOpsDelta: number;
  flag: string;
};

const CAR_KEYS: (keyof CarRatings)[] = [
  'enginePower',
  'aeroEfficiency',
  'mechanicalGrip',
  'reliability',
  'pitCrewOperations',
];

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, lo = 1, hi = 10): number {
  return Math.max(lo, Math.min(hi, n));
}

function eraBand(year: number): EraBand {
  if (year <= 2008) return 'classic';
  if (year <= 2010) return 'transition';
  if (year <= 2025) return 'compressed-modern';
  return 'modern-reset';
}

function targetForExpected(expected: number, year: number): number {
  const band = eraBand(year);

  // Targets are deliberately ordinal: season data already encodes the real
  // finishing order through expectedStanding. The goal is to restore a sane
  // historical spread, especially after 2010 where the current files compress
  // almost the whole grid into 7.0-9.8.
  const classic = [8.85, 8.45, 7.95, 7.35, 5.75, 5.35, 5.0, 4.65, 4.25, 3.95, 3.65, 3.4];
  const transition = [8.9, 8.55, 8.15, 7.7, 6.1, 5.75, 5.4, 5.05, 4.7, 4.35, 4.05, 3.8];
  const modern = [9.25, 8.9, 8.55, 8.15, 6.85, 6.45, 6.1, 5.75, 5.35, 5.0, 4.7, 4.45];
  const reset = [8.85, 8.45, 8.05, 7.65, 6.05, 5.65, 5.3, 4.95, 4.6, 4.25, 3.95, 3.7];

  const table = band === 'classic' ? classic : band === 'transition' ? transition : band === 'modern-reset' ? reset : modern;
  const idx = Math.max(0, Math.min(table.length - 1, expected - 1));
  return table[idx];
}

function targetReputation(expected: number, year: number): number {
  const band = eraBand(year);
  const classic = [96, 90, 83, 76, 65, 58, 52, 47, 42, 38, 34, 31];
  const modern = [96, 90, 84, 78, 68, 62, 56, 51, 46, 42, 38, 35];
  const reset = [94, 88, 81, 74, 64, 57, 51, 46, 41, 37, 33, 30];
  const table = band === 'modern-reset' ? reset : band === 'compressed-modern' || band === 'transition' ? modern : classic;
  const idx = Math.max(0, Math.min(table.length - 1, expected - 1));
  return table[idx];
}

function ratingSpread(car: CarRatings): number {
  const values = CAR_KEYS.map((key) => car[key]);
  return Math.max(...values) - Math.min(...values);
}

function rebalanceCarRatings(ratings: CarRatings, targetAvg: number): CarRatings {
  const currentAvg = CAR_KEYS.reduce((sum, key) => sum + ratings[key], 0) / CAR_KEYS.length;
  const delta = targetAvg - currentAvg;
  const currentSpread = ratingSpread(ratings);
  const out = {} as CarRatings;

  for (const key of CAR_KEYS) {
    // Preserve each car's personality, but compress extreme intra-car spreads
    // slightly so a single inflated sub-rating does not keep the average alive.
    const centered = ratings[key] - currentAvg;
    const spreadFactor = currentSpread > 2.2 ? 0.85 : 0.95;
    out[key] = r2(clamp(targetAvg + centered * spreadFactor + delta * 0.05));
  }
  return out;
}

function targetRaceOps(expected: number, targetAvg: number, targetRep: number): number {
  const expectedBias = expected <= 4 ? 0.25 : expected <= 8 ? 0 : -0.15;
  return r2(clamp(0.58 * targetAvg + 0.32 * (targetRep / 10) + expectedBias));
}

function flagFor(row: Omit<PreviewRow, 'flag'>): string {
  const flags: string[] = [];
  if (row.year >= 2011 && row.currentAvg >= 7 && row.expectedStanding >= 8) flags.push('modern backmarker too high');
  if (row.year >= 2011 && row.currentAvg >= 8.4 && row.expectedStanding >= 5) flags.push('modern midfield too high');
  if (row.delta <= -1.5) flags.push('large nerf');
  if (row.delta >= 0.8) flags.push('large buff');
  if (row.expectedStanding <= 2 && row.delta < -0.8) flags.push('front too inflated');
  return flags.join('; ');
}

async function main(): Promise<void> {
  const rows: PreviewRow[] = [];

  for (let year = 1990; year <= 2026; year += 1) {
    const bundle = await loadSeasonBundle(year, 'F1');
    if (!bundle) continue;

    const carByTeam = new Map(bundle.cars.map((car) => [car.teamId, car]));
    for (const team of bundle.teams) {
      const car = carByTeam.get(team.id);
      if (!car) continue;

      const expected = team.expectedStanding ?? 99;
      const currentAvg = r2(carPerformanceRating(car));
      const targetAvg = r2(targetForExpected(expected, year));
      const targetRatings = rebalanceCarRatings(car.ratings, targetAvg);
      const adjustedAvg = r2(CAR_KEYS.reduce((sum, key) => sum + targetRatings[key], 0) / CAR_KEYS.length);
      const currentRep = team.reputation;
      const targetRep = targetReputation(expected, year);
      const currentRaceOps = team.raceOperations ?? r2(team.reputation / 10);
      const targetOps = targetRaceOps(expected, adjustedAvg, targetRep);

      const rowBase = {
        year,
        eraBand: eraBand(year),
        expectedStanding: expected,
        teamId: team.id,
        team: team.name,
        currentAvg,
        targetAvg: adjustedAvg,
        delta: r2(adjustedAvg - currentAvg),
        currentRep,
        targetRep,
        repDelta: r2(targetRep - currentRep),
        currentRaceOps,
        targetRaceOps: targetOps,
        raceOpsDelta: r2(targetOps - currentRaceOps),
      };

      rows.push({ ...rowBase, flag: flagFor(rowBase) });
    }
  }

  const csvHeader = [
    'year',
    'eraBand',
    'expectedStanding',
    'teamId',
    'team',
    'currentAvg',
    'targetAvg',
    'delta',
    'currentRep',
    'targetRep',
    'repDelta',
    'currentRaceOps',
    'targetRaceOps',
    'raceOpsDelta',
    'flag',
  ];

  const csv = [
    csvHeader.join(','),
    ...rows.map((row) =>
      csvHeader
        .map((key) => {
          const value = row[key as keyof PreviewRow];
          const text = String(value).replaceAll('"', '""');
          return text.includes(',') || text.includes(';') ? `"${text}"` : text;
        })
        .join(','),
    ),
  ].join('\n');

  const seasonSummary = Object.values(
    rows.reduce<Record<string, { year: number; eraBand: EraBand; teams: number; avgDelta: number; largeNerfs: number; largeBuffs: number; currentSpread: number; targetSpread: number; maxCurrent: number; maxTarget: number; minCurrent: number; minTarget: number }>>((acc, row) => {
      const key = String(row.year);
      acc[key] ??= {
        year: row.year,
        eraBand: row.eraBand,
        teams: 0,
        avgDelta: 0,
        largeNerfs: 0,
        largeBuffs: 0,
        currentSpread: 0,
        targetSpread: 0,
        maxCurrent: -Infinity,
        maxTarget: -Infinity,
        minCurrent: Infinity,
        minTarget: Infinity,
      };
      const s = acc[key];
      s.teams += 1;
      s.avgDelta += row.delta;
      if (row.delta <= -1.5) s.largeNerfs += 1;
      if (row.delta >= 0.8) s.largeBuffs += 1;
      s.maxCurrent = Math.max(s.maxCurrent, row.currentAvg);
      s.maxTarget = Math.max(s.maxTarget, row.targetAvg);
      s.minCurrent = Math.min(s.minCurrent, row.currentAvg);
      s.minTarget = Math.min(s.minTarget, row.targetAvg);
      return acc;
    }, {}),
  ).map((s) => ({
    ...s,
    avgDelta: r2(s.avgDelta / s.teams),
    currentSpread: r2(s.maxCurrent - s.minCurrent),
    targetSpread: r2(s.maxTarget - s.minTarget),
  }));

  writeFileSync('scripts/ratings_rebalance_preview.csv', csv);
  writeFileSync('scripts/ratings_rebalance_summary.json', JSON.stringify({ rows, seasonSummary }, null, 2));

  console.table(
    seasonSummary.map((s) => ({
      year: s.year,
      era: s.eraBand,
      teams: s.teams,
      currentSpread: s.currentSpread,
      targetSpread: s.targetSpread,
      avgDelta: s.avgDelta,
      largeNerfs: s.largeNerfs,
      largeBuffs: s.largeBuffs,
    })),
  );
  console.log('Wrote scripts/ratings_rebalance_preview.csv');
  console.log('Wrote scripts/ratings_rebalance_summary.json');
}

void main();
