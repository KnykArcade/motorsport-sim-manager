import { readFileSync, writeFileSync } from 'node:fs';
import { loadSeasonBundle } from '../src/data/seasonLoader';
import { carPerformanceRating } from '../src/sim/trackFitEngine';
import type { CarRatings } from '../src/types/gameTypes';

type EraBand = 'classic' | 'transition' | 'compressed-modern' | 'modern-reset';

const CAR_KEYS: (keyof CarRatings)[] = [
  'enginePower',
  'aeroEfficiency',
  'mechanicalGrip',
  'reliability',
  'pitCrewOperations',
];

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, lo = 1, hi = 10): number {
  return Math.max(lo, Math.min(hi, n));
}

function fmt(n: number): string {
  const rounded = r1(n);
  return Number.isInteger(rounded) ? `${rounded}.0` : String(rounded);
}

function eraBand(year: number): EraBand {
  if (year <= 2008) return 'classic';
  if (year <= 2010) return 'transition';
  if (year <= 2025) return 'compressed-modern';
  return 'modern-reset';
}

function targetForExpected(expected: number, year: number): number {
  const band = eraBand(year);
  const classic = [8.85, 8.45, 7.95, 7.35, 5.75, 5.35, 5.0, 4.65, 4.25, 3.95, 3.65, 3.4];
  const transition = [8.9, 8.55, 8.15, 7.7, 6.1, 5.75, 5.4, 5.05, 4.7, 4.35, 4.05, 3.8];
  const modern = [9.25, 8.9, 8.55, 8.15, 6.85, 6.45, 6.1, 5.75, 5.35, 5.0, 4.7, 4.45];
  const reset = [8.85, 8.45, 8.05, 7.65, 6.05, 5.65, 5.3, 4.95, 4.6, 4.25, 3.95, 3.7];
  const table = band === 'classic' ? classic : band === 'transition' ? transition : band === 'modern-reset' ? reset : modern;
  return table[Math.max(0, Math.min(table.length - 1, expected - 1))];
}

function targetReputation(expected: number, year: number): number {
  const band = eraBand(year);
  const classic = [96, 90, 83, 76, 65, 58, 52, 47, 42, 38, 34, 31];
  const modern = [96, 90, 84, 78, 68, 62, 56, 51, 46, 42, 38, 35];
  const reset = [94, 88, 81, 74, 64, 57, 51, 46, 41, 37, 33, 30];
  const table = band === 'modern-reset' ? reset : band === 'compressed-modern' || band === 'transition' ? modern : classic;
  return table[Math.max(0, Math.min(table.length - 1, expected - 1))];
}

function ratingSpread(car: CarRatings): number {
  const values = CAR_KEYS.map((key) => car[key]);
  return Math.max(...values) - Math.min(...values);
}

function rebalanceCarRatings(ratings: CarRatings, targetAvg: number): CarRatings {
  const currentAvg = CAR_KEYS.reduce((sum, key) => sum + ratings[key], 0) / CAR_KEYS.length;
  const delta = targetAvg - currentAvg;
  const spreadFactor = ratingSpread(ratings) > 2.2 ? 0.85 : 0.95;
  const out = {} as CarRatings;
  for (const key of CAR_KEYS) {
    out[key] = r1(clamp(targetAvg + (ratings[key] - currentAvg) * spreadFactor + delta * 0.05));
  }
  return out;
}

function targetRaceOps(expected: number, targetAvg: number, targetRep: number): number {
  const expectedBias = expected <= 4 ? 0.25 : expected <= 8 ? 0 : -0.15;
  return r1(clamp(0.58 * targetAvg + 0.32 * (targetRep / 10) + expectedBias));
}

function replaceCarRatings(text: string, teamId: string, ratings: CarRatings): string {
  const objectPattern = new RegExp(`(\\{\\s*\\n\\s*id: '[^']+',\\s*\\n\\s*teamId: '${teamId}',[\\s\\S]*?ratings: \\{)([\\s\\S]*?)(\\n\\s*\\},\\s*\\n\\s*condition:)`);
  return text.replace(objectPattern, (_match, before: string, body: string, after: string) => {
    let nextBody = body;
    for (const key of CAR_KEYS) {
      nextBody = nextBody.replace(new RegExp(`(\\b${key}: )-?\\d+(?:\\.\\d+)?`), `$1${fmt(ratings[key])}`);
    }
    return before + nextBody + after;
  });
}

function replaceTeamNumber(text: string, teamId: string, key: 'reputation' | 'raceOperations', value: number): string {
  const objectPattern = new RegExp(`(\\{\\s*\\n\\s*id: '${teamId}',[\\s\\S]*?\\n\\s*${key}: )-?\\d+(?:\\.\\d+)?`);
  return text.replace(objectPattern, `$1${fmt(value)}`);
}

async function main(): Promise<void> {
  let carFilesChanged = 0;
  let teamFilesChanged = 0;
  let teamRowsChanged = 0;

  for (let year = 1990; year <= 2026; year += 1) {
    const bundle = await loadSeasonBundle(year, 'F1');
    if (!bundle) continue;

    const carFile = `src/data/cars/cars${year}.ts`;
    const teamFile = `src/data/teams/teams${year}.ts`;
    let carText = readFileSync(carFile, 'utf8');
    let teamText = readFileSync(teamFile, 'utf8');
    const originalCarText = carText;
    const originalTeamText = teamText;

    const carByTeam = new Map(bundle.cars.map((car) => [car.teamId, car]));
    for (const team of bundle.teams) {
      const car = carByTeam.get(team.id);
      if (!car) continue;
      const expected = team.expectedStanding ?? 99;
      const targetAvg = targetForExpected(expected, year);
      const targetRatings = rebalanceCarRatings(car.ratings, targetAvg);
      const targetAvgActual = CAR_KEYS.reduce((sum, key) => sum + targetRatings[key], 0) / CAR_KEYS.length;
      const targetRep = targetReputation(expected, year);
      const targetOps = targetRaceOps(expected, targetAvgActual, targetRep);

      carText = replaceCarRatings(carText, team.id, targetRatings);
      teamText = replaceTeamNumber(teamText, team.id, 'reputation', targetRep);
      teamText = replaceTeamNumber(teamText, team.id, 'raceOperations', targetOps);
      teamRowsChanged += 1;

      // Keep this import live so TypeScript flags if carPerformanceRating changes shape.
      void carPerformanceRating(car);
    }

    if (carText !== originalCarText) {
      writeFileSync(carFile, carText);
      carFilesChanged += 1;
    }
    if (teamText !== originalTeamText) {
      writeFileSync(teamFile, teamText);
      teamFilesChanged += 1;
    }
  }

  console.log(`car files changed: ${carFilesChanged}`);
  console.log(`team files changed: ${teamFilesChanged}`);
  console.log(`team rows processed: ${teamRowsChanged}`);
}

void main();
