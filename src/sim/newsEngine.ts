// Generate news headlines after a race weekend.

import type { NewsItem, QualifyingResult, RaceResult } from '../types/gameTypes';
import { createSeededRandom, deriveSeed } from './random';

const WIN_HEADLINES = [
  '{driver} wins the {gp}',
  '{driver} dominates the {gp}',
  '{driver} takes the chequered flag at the {gp}',
  'Victory for {driver} at the {gp}',
] as const;

const POLE_HEADLINES = [
  '{driver} on pole at the {gp}',
  '{driver} secures pole position at the {gp}',
  '{driver} tops qualifying at the {gp}',
] as const;

function pickVariant<T>(variants: readonly T[], seed: string): T {
  const rng = createSeededRandom(seed);
  return variants[Math.floor(rng.next() * variants.length)];
}

export function generateRaceNews(
  round: number,
  gpName: string,
  qualifying: QualifyingResult[],
  race: RaceResult[],
  driverNames: Record<string, string>,
  teamNames: Record<string, string>,
  seed: string,
): NewsItem[] {
  const items: NewsItem[] = [];
  const now = new Date().toISOString();

  const winner = race.find((r) => r.position === 1);
  if (winner) {
    const winHeadline = pickVariant(WIN_HEADLINES, deriveSeed(seed, 'win-headline', `${round}`))
      .replace('{driver}', driverNames[winner.driverId] ?? winner.driverId)
      .replace('{gp}', gpName);
    items.push({
      id: `news-${round}-win`,
      round,
      headline: winHeadline,
      body: `${teamNames[winner.teamId]} takes victory after a strong weekend.`,
      timestamp: now,
    });
  }

  const pole = qualifying[0];
  if (pole) {
    const poleHeadline = pickVariant(POLE_HEADLINES, deriveSeed(seed, 'pole-headline', `${round}`))
      .replace('{driver}', driverNames[pole.driverId] ?? pole.driverId)
      .replace('{gp}', gpName);
    items.push({
      id: `news-${round}-pole`,
      round,
      headline: poleHeadline,
      timestamp: now,
    });
  }

  // Notable DNF among front runners.
  const bigDnf = race.find((r) => r.status === 'DNF' && r.gridPosition <= 5);
  if (bigDnf) {
    items.push({
      id: `news-${round}-dnf`,
      round,
      headline: `${teamNames[bigDnf.teamId]} lose valuable points as ${driverNames[bigDnf.driverId]} retires`,
      body: bigDnf.incidents[0],
      timestamp: now,
    });
  }

  // Biggest mover / loser are now generated only by careerNewsEngine.ts to
  // avoid duplicate headlines in the feed.

  return items;
}
