// Youth Generation Engine — fills the Youth Academy pool with fictional
// prospects when curated data is insufficient.
//
// Every Career Mode season must have at least MIN_YOUTH_PROSPECTS visible
// youth academy prospects (ages 14–17). When curated/historical youth data
// for the selected season has fewer than the minimum, this engine generates
// deterministic fictional prospects to fill the pool.
//
// Generated youth are reproducible for the same save/year/series (seeded),
// persist in save state, and support varied archetypes from elite wonderkids
// to pay drivers and bust risks.

import type { YouthProspect } from '../types/marketTypes';
import type { Series } from '../types/gameTypes';
import { createSeededRandom, deriveSeed } from './random';
import { normalizeName } from '../data/registry/masterRegistry';

export const MIN_YOUTH_PROSPECTS = 12;
export const MAX_GENERATED_YOUTH = 20;
export const YOUTH_GEN_MIN_AGE = 14;
export const YOUTH_GEN_MAX_AGE = 17;

// Prospect archetypes for varied generation.
type YouthArchetype =
  | 'EliteWonderkid'
  | 'HighUpsideRisk'
  | 'SolidProfessional'
  | 'TechnicalSpecialist'
  | 'PayDriver'
  | 'LateBloomer'
  | 'OverhypedBust';

const ARCHETYPE_WEIGHTS: Record<YouthArchetype, number> = {
  EliteWonderkid: 0.05,
  HighUpsideRisk: 0.15,
  SolidProfessional: 0.25,
  TechnicalSpecialist: 0.15,
  PayDriver: 0.15,
  LateBloomer: 0.15,
  OverhypedBust: 0.10,
};

const NATIONALITIES = [
  'GBR', 'ITA', 'FRA', 'ESP', 'DEU', 'BRA', 'ARG', 'JPN', 'AUS',
  'USA', 'CAN', 'NLD', 'BEL', 'PRT', 'MEX', 'THA', 'CHN', 'ZAF',
  'FIN', 'SWE', 'DNK', 'NOR', 'CHE', 'AUT',
];

const FIRST_NAMES = [
  'Leo', 'Max', 'Theo', 'Luca', 'Enzo', 'Mateo', 'Kai', 'Finn', 'Jules',
  'Arlo', 'Nico', 'Rafael', 'Hugo', 'Otis', 'Diego', 'Kazuki', 'Ren',
  'Soren', 'Liam', 'Caius', 'Marco', 'Dante', 'Eli', 'Remy', 'Axel',
  'Tariq', 'Nikolai', 'Bruno', 'Sacha', 'Pablo', 'Yuki', 'Connor',
];

const LAST_NAMES = [
  'Vega', 'Marchetti', 'Lambert', 'Okafor', 'Silva', 'Kowalski', 'Bauer',
  'Romano', 'Andersen', 'Costa', 'Petrov', 'Nakamura', 'Ferreira', 'Schmidt',
  'Dubois', 'Lindqvist', 'Moreau', 'Russo', 'Hartmann', 'Olsen', 'Verdi',
  'Khan', 'Mendes', 'Weber', 'Fontana', 'Petersen', 'Aaltonen', 'Berg',
  'Carvalho', 'Novak', 'Yamamoto', 'Sullivan',
];

const SHARED_SERIES: Series[] = ['F1', 'CART', 'Champ Car', 'IndyCar', 'NASCAR'];

type Rng = {
  next: () => number;
  nextInt: (min: number, max: number) => number;
  pick: <T>(arr: T[]) => T;
};

function makeRng(seed: string): Rng {
  const rng = createSeededRandom(seed);
  return {
    next: () => rng.next(),
    nextInt: (min: number, max: number) => Math.floor(rng.next() * (max - min + 1)) + min,
    pick: <T>(arr: T[]): T => arr[Math.floor(rng.next() * arr.length)],
  };
}

function pickArchetype(rng: Rng): YouthArchetype {
  const roll = rng.next();
  let cumulative = 0;
  for (const [archetype, weight] of Object.entries(ARCHETYPE_WEIGHTS)) {
    cumulative += weight;
    if (roll < cumulative) return archetype as YouthArchetype;
  }
  return 'SolidProfessional';
}

function archetypeToProspect(
  archetype: YouthArchetype,
  rng: Rng,
  year: number,
  index: number,
): YouthProspect {
  const age = rng.nextInt(YOUTH_GEN_MIN_AGE, YOUTH_GEN_MAX_AGE);
  const birthYear = year - age;
  const nationality = rng.pick(NATIONALITIES);
  const firstName = rng.pick(FIRST_NAMES);
  const lastName = rng.pick(LAST_NAMES);
  const name = `${firstName} ${lastName}`;
  const id = `gen-yth-${year}-${index}-${deriveSeed(name, nationality)}`;
  const preferred = rng.pick(SHARED_SERIES);
  const secondary = rng.pick(SHARED_SERIES.filter((series) => series !== preferred));

  let overall: number;
  let potential: number;
  let developmentRate: number;
  let yearsUntilF1Ready: number;
  let signingCost: number;
  let yearlyAcademyCost: number;
  let riskLevel: string;
  let notes: string;
  let currentLevel: string;

  switch (archetype) {
    case 'EliteWonderkid':
      overall = rng.nextInt(72, 82);
      potential = rng.nextInt(90, 99);
      developmentRate = rng.nextInt(75, 95) / 100;
      yearsUntilF1Ready = rng.nextInt(1, 2);
      signingCost = rng.nextInt(30, 80) / 10;
      yearlyAcademyCost = rng.nextInt(30, 60) / 10;
      riskLevel = 'Low';
      notes = 'Generational talent with elite ceiling. High competition from AI teams.';
      currentLevel = 'Karting / F4 prodigy';
      break;
    case 'HighUpsideRisk':
      overall = rng.nextInt(55, 68);
      potential = rng.nextInt(85, 95);
      developmentRate = rng.nextInt(40, 80) / 100;
      yearsUntilF1Ready = rng.nextInt(2, 4);
      signingCost = rng.nextInt(20, 50) / 10;
      yearlyAcademyCost = rng.nextInt(20, 40) / 10;
      riskLevel = 'High';
      notes = 'High ceiling but volatile development. Could be a star or a bust.';
      currentLevel = 'F4 / Regional formula';
      break;
    case 'SolidProfessional':
      overall = rng.nextInt(60, 72);
      potential = rng.nextInt(72, 82);
      developmentRate = rng.nextInt(60, 85) / 100;
      yearsUntilF1Ready = rng.nextInt(2, 4);
      signingCost = rng.nextInt(10, 30) / 10;
      yearlyAcademyCost = rng.nextInt(10, 30) / 10;
      riskLevel = 'Low';
      notes = 'Safe prospect with a solid floor. Reliable development curve.';
      currentLevel = 'F4 / F3 pathway';
      break;
    case 'TechnicalSpecialist':
      overall = rng.nextInt(55, 68);
      potential = rng.nextInt(70, 82);
      developmentRate = rng.nextInt(65, 88) / 100;
      yearsUntilF1Ready = rng.nextInt(3, 5);
      signingCost = rng.nextInt(10, 30) / 10;
      yearlyAcademyCost = rng.nextInt(10, 30) / 10;
      riskLevel = 'Medium';
      notes = 'Strong feedback and technical skills. Valuable for testing and development.';
      currentLevel = 'F4 / Formula Regional';
      break;
    case 'PayDriver':
      overall = rng.nextInt(45, 60);
      potential = rng.nextInt(55, 72);
      developmentRate = rng.nextInt(30, 60) / 100;
      yearsUntilF1Ready = rng.nextInt(3, 6);
      signingCost = rng.nextInt(-30, 10) / 10;
      yearlyAcademyCost = rng.nextInt(-20, 10) / 10;
      riskLevel = 'High';
      notes = 'Brings financial backing but limited on-track upside.';
      currentLevel = 'Formula Regional / Pay drive';
      break;
    case 'LateBloomer':
      overall = rng.nextInt(45, 58);
      potential = rng.nextInt(78, 90);
      developmentRate = rng.nextInt(35, 65) / 100;
      yearsUntilF1Ready = rng.nextInt(3, 5);
      signingCost = rng.nextInt(10, 30) / 10;
      yearlyAcademyCost = rng.nextInt(10, 20) / 10;
      riskLevel = 'Medium';
      notes = 'Modest early rating but hidden growth potential. May surprise.';
      currentLevel = 'Karting / Late starter';
      break;
    case 'OverhypedBust':
      overall = rng.nextInt(62, 75);
      potential = rng.nextInt(60, 72);
      developmentRate = rng.nextInt(20, 45) / 100;
      yearsUntilF1Ready = rng.nextInt(3, 6);
      signingCost = rng.nextInt(20, 50) / 10;
      yearlyAcademyCost = rng.nextInt(20, 40) / 10;
      riskLevel = 'High';
      notes = 'Looks promising but may develop poorly. Risky investment.';
      currentLevel = 'F4 / Hyped junior';
      break;
  }

  // Generate skills around the overall rating with some variance.
  const baseSkill = overall;
  const variance = 0.4;
  const skill = () => Math.max(1, Math.min(100, Math.round(baseSkill + (rng.next() * variance * 2 - variance) * 10)));

  return {
    id,
    name,
    age,
    birthYear,
    nationality,
    currentLevel,
    marketPool: 'Youth',
    marketStatus: 'Prospect',
    seriesPreferences: [
      { series: preferred, weight: 100 },
      { series: secondary, weight: 65 },
    ],
    academyEligibleNow: true,
    earliestFullAcademyYear: year,
    skills: {
      cornering: skill(),
      braking: skill(),
      straights: skill(),
      tractionAcceleration: skill(),
      elevationBlindCorners: skill(),
      technical: skill(),
      overtakingRacecraft: skill(),
      surfaceGripBumpiness: skill(),
      riskManagement: skill(),
      enduranceConsistency: skill(),
    },
    overall,
    potential,
    potentialDelta: Math.max(0, Math.round((potential - overall) * 10) / 10),
    developmentRate,
    yearsUntilF1Ready,
    signingCost,
    yearlyAcademyCost,
    riskLevel,
    suggestedPath: 'Academy',
    notes,
  };
}

// Generate deterministic fictional youth prospects to fill the pool.
// The series argument is retained for API compatibility, but deliberately does
// not affect the seed: future careers share one universe-wide youth class for a
// given save/year regardless of which championship the player manages.
// occupiedNames is an optional set of normalized names to avoid collisions.
export function generateYouthProspects(
  seed: string,
  series: string,
  year: number,
  count: number,
  occupiedNames?: Set<string>,
): YouthProspect[] {
  void series;
  const genSeed = deriveSeed(seed, 'youth-gen', 'shared-universe', year);
  const rng = makeRng(genSeed);
  const prospects: YouthProspect[] = [];
  let attempts = 0;
  const maxAttempts = count * 10;
  while (prospects.length < count && attempts < maxAttempts) {
    const archetype = pickArchetype(rng);
    const prospect = archetypeToProspect(archetype, rng, year, prospects.length);
    const key = normalizeName(prospect.name);
    if (occupiedNames && occupiedNames.has(key)) {
      attempts++;
      continue;
    }
    // Also avoid duplicates within the generated set.
    if (prospects.some((p) => normalizeName(p.name) === key)) {
      attempts++;
      continue;
    }
    prospects.push(prospect);
  }
  return prospects;
}

// Ensure the youth pool has at least MIN_YOUTH_PROSPECTS.
// If existing prospects are fewer than the minimum, generate enough to fill.
// occupiedNames is an optional set of normalized names to avoid collisions with
// existing drivers in the career universe.
export function ensureMinimumYouthProspects(
  existing: YouthProspect[],
  seed: string,
  series: string,
  year: number,
  occupiedNames?: Set<string>,
): YouthProspect[] {
  if (existing.length >= MIN_YOUTH_PROSPECTS) return existing;
  const needed = MIN_YOUTH_PROSPECTS - existing.length;
  const existingNames = new Set(existing.map((p) => normalizeName(p.name)));
  const allOccupied = occupiedNames
    ? new Set([...occupiedNames, ...existingNames])
    : existingNames;
  const generated = generateYouthProspects(seed, series, year, needed, allOccupied);
  return [...existing, ...generated];
}
