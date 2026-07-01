// Generate news headlines after a race weekend.

import type { NewsItem, QualifyingResult, RaceResult } from '../types/gameTypes';
import { createSeededRandom, deriveSeed } from './random';
import { biggestGainer, biggestLoser } from './positionDelta';

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

  // Biggest mover (positions gained from the grid).
  const gainer = biggestGainer(race);
  if (gainer && gainer.positionsGained >= 4) {
    items.push({
      id: `news-${round}-mover`,
      round,
      headline: `${driverNames[gainer.driverId]} charges from P${gainer.startingGridPosition} to P${gainer.currentPosition}`,
      body: `One of the biggest movers of the day, climbing ${gainer.positionsGained} places.`,
      timestamp: now,
    });
  }

  // Biggest loser (positions dropped from the grid).
  const loser = biggestLoser(race);
  if (loser && loser.positionsLost >= 4) {
    items.push({
      id: `news-${round}-slider`,
      round,
      headline: `${driverNames[loser.driverId]} slips from P${loser.startingGridPosition} to P${loser.currentPosition}`,
      body: `A day to forget after losing ${loser.positionsLost} places.`,
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
