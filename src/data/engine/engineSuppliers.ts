// Engine manufacturers present in the universe, grouped by era and series.
// Used to seed each team's engine deal at new-game and to populate the offseason
// negotiation pool. Ratings are on a 1-10 scale; prestige (0-100) drives cost
// and desirability. These are flavourful, deterministic pools — not an exact
// historical team→engine mapping (the season data doesn't carry one).

import type { EngineSupplier } from '../../types/engineTypes';
import type { Series } from '../../types/gameTypes';

// Classic Formula 1 (roughly 1994-2005): the V8/V10 customer-engine era.
const classicF1: EngineSupplier[] = [
  { id: 'eng-renault', name: 'Renault', basePower: 9, baseReliability: 8, prestige: 95 },
  { id: 'eng-ferrari', name: 'Ferrari', basePower: 8, baseReliability: 7, prestige: 90 },
  { id: 'eng-mercedes', name: 'Mercedes-Ilmor', basePower: 8, baseReliability: 6, prestige: 85 },
  { id: 'eng-honda', name: 'Honda-Mugen', basePower: 7, baseReliability: 7, prestige: 78 },
  { id: 'eng-peugeot', name: 'Peugeot', basePower: 7, baseReliability: 5, prestige: 68 },
  { id: 'eng-ford', name: 'Ford-Cosworth', basePower: 6, baseReliability: 7, prestige: 62 },
  { id: 'eng-yamaha', name: 'Yamaha', basePower: 5, baseReliability: 5, prestige: 45 },
  { id: 'eng-hart', name: 'Hart', basePower: 4, baseReliability: 5, prestige: 35 },
  { id: 'eng-judd', name: 'Judd', basePower: 4, baseReliability: 4, prestige: 28 },
];

// Modern Formula 1 (roughly 2014+): the hybrid power-unit era.
const modernF1: EngineSupplier[] = [
  { id: 'eng-mercedes-pu', name: 'Mercedes', basePower: 9, baseReliability: 9, prestige: 96 },
  { id: 'eng-ferrari-pu', name: 'Ferrari', basePower: 8, baseReliability: 7, prestige: 90 },
  { id: 'eng-honda-rbpt', name: 'Honda RBPT', basePower: 9, baseReliability: 8, prestige: 88 },
  { id: 'eng-renault-pu', name: 'Renault', basePower: 7, baseReliability: 6, prestige: 70 },
  { id: 'eng-audi-pu', name: 'Audi', basePower: 7, baseReliability: 6, prestige: 72 },
];

// IndyCar: a two-manufacturer formula.
const indyCar: EngineSupplier[] = [
  { id: 'eng-honda-indy', name: 'Honda', basePower: 8, baseReliability: 8, prestige: 85 },
  { id: 'eng-chevy-indy', name: 'Chevrolet', basePower: 8, baseReliability: 8, prestige: 85 },
];

export function suppliersFor(year: number, series: Series): EngineSupplier[] {
  if (series === 'IndyCar') return indyCar;
  // Formula 1 (and any other open-wheel series fall back to F1 pools).
  if (year >= 2010) return modernF1;
  return classicF1;
}
