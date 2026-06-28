// Generate news headlines after a race weekend.

import type { NewsItem, QualifyingResult, RaceResult } from '../types/gameTypes';
import { createSeededRandom, deriveSeed } from './random';

export function generateRaceNews(
  round: number,
  gpName: string,
  qualifying: QualifyingResult[],
  race: RaceResult[],
  driverNames: Record<string, string>,
  teamNames: Record<string, string>,
  seed: string,
): NewsItem[] {
  const rng = createSeededRandom(deriveSeed(seed, 'news', round));
  const items: NewsItem[] = [];
  const now = new Date().toISOString();

  const winner = race.find((r) => r.position === 1);
  if (winner) {
    items.push({
      id: `news-${round}-win`,
      round,
      headline: `${driverNames[winner.driverId]} wins the ${gpName}`,
      body: `${teamNames[winner.teamId]} takes victory after a strong weekend.`,
      timestamp: now,
    });
  }

  const pole = qualifying[0];
  if (pole) {
    items.push({
      id: `news-${round}-pole`,
      round,
      headline: `${driverNames[pole.driverId]} on pole at the ${gpName}`,
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

  // A big mover.
  const mover = [...race]
    .filter((r) => r.position !== null)
    .sort((a, b) => (b.gridPosition - (b.position ?? 99)) - (a.gridPosition - (a.position ?? 99)))[0];
  if (mover && mover.position !== null && mover.gridPosition - mover.position >= 4) {
    items.push({
      id: `news-${round}-mover`,
      round,
      headline: `${driverNames[mover.driverId]} charges from P${mover.gridPosition} to P${mover.position}`,
      timestamp: now,
    });
  }

  const flavor = [
    'Paddock rumors grow around the driver market after recent results.',
    'Engineers report promising data from the latest development package.',
    'Championship momentum is shifting as the season unfolds.',
  ];
  items.push({
    id: `news-${round}-flavor`,
    round,
    headline: rng.pick(flavor),
    timestamp: now,
  });

  return items;
}
