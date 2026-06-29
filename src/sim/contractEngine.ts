// Third-driver (reserve) contracts. A 3rd driver is signed mid-season on a
// cheaper deal than a full race seat. They sit in the reserve pool and can be
// swapped into a race seat. If a 3rd driver outperforms a seat driver over the
// season they push for a proper seat in the offseason — promote them or risk
// losing them to the open market.

import { toMoney } from './financeEngine';
import type { GameState } from '../game/careerState';
import type { Driver, StandingsEntry } from '../types/gameTypes';

// A 3rd-driver deal pays a fraction of an equivalent full seat salary.
export const THIRD_DRIVER_SALARY_FACTOR = 0.5;

// Annual salary ($M) a market driver commands on a 3rd-driver deal.
export function thirdDriverSalary(marketSalary: number): number {
  return Math.max(0.2, marketSalary * THIRD_DRIVER_SALARY_FACTOR);
}

// One-off fee charged when signing a 3rd driver mid-season: the discounted
// salary prorated over the races left in the season (you pay for the rest of
// the year now). Returned in money units.
export function thirdDriverMidSeasonFee(
  marketSalary: number,
  racesRemaining: number,
  totalRaces: number,
): number {
  const fraction = totalRaces > 0 ? Math.max(0.1, racesRemaining / totalRaces) : 1;
  return toMoney(thirdDriverSalary(marketSalary) * fraction);
}

export type ThirdDriverAmbition = {
  driverId: string;
  name: string;
  points: number;
  bestSeatPoints: number;
  outperformed: boolean;
  // True when the driver expects a full-seat deal next season (and will leave
  // for another team if not promoted).
  wantsSeat: boolean;
};

function pointsFor(standings: StandingsEntry[], driverId: string): number {
  return standings.find((s) => s.entityId === driverId)?.points ?? 0;
}

// Evaluate each of the player's 3rd drivers against their seat team-mates using
// the current driver standings. A 3rd driver who scored points and beat a seat
// driver wants a full seat next year.
export function thirdDriverAmbitions(state: GameState): ThirdDriverAmbition[] {
  const playerDrivers = state.drivers.filter((d) => d.teamId === state.selectedTeamId);
  const thirds = playerDrivers.filter((d) => d.contractType === 'third');
  const seatDrivers = playerDrivers.filter((d) => d.contractType !== 'third');
  const standings = state.driverStandings;

  return thirds.map((d: Driver) => {
    const points = pointsFor(standings, d.id);
    const seatPoints = seatDrivers.map((s) => pointsFor(standings, s.id));
    // Compare against the weaker seat driver — beating either is enough.
    const bestSeatPoints = seatPoints.length ? Math.min(...seatPoints) : 0;
    const outperformed = points > 0 && points > bestSeatPoints;
    return {
      driverId: d.id,
      name: d.name,
      points,
      bestSeatPoints,
      outperformed,
      wantsSeat: outperformed,
    };
  });
}
