// Generate news headlines after a race weekend.

import type { NewsItem, QualifyingResult, RaceResult } from '../types/gameTypes';

export function generateRaceNews(
  round: number,
  gpName: string,
  qualifying: QualifyingResult[],
  race: RaceResult[],
  driverNames: Record<string, string>,
  teamNames: Record<string, string>,
  seed: string,
): NewsItem[] {
  void seed;
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

  // Biggest mover / loser are now generated only by careerNewsEngine.ts to
  // avoid duplicate headlines in the feed.

  return items;
}
