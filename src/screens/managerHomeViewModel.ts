import type { GameState } from '../game/careerState';
import type { RaceResult } from '../types/gameTypes';

export type ManagerHomeRaceResult = {
  driverId: string;
  driverName: string;
  positionLabel: string;
  points: number;
  status: RaceResult['status'];
};

export type ManagerHomePreviousRace = {
  raceId: string;
  raceName: string;
  round: number;
  headline: string;
  summary: string;
  points: number;
  results: ManagerHomeRaceResult[];
  route: string;
};

export type ManagerHomeDriverHighlight = {
  driverId: string;
  name: string;
  championshipPosition?: number;
  points: number;
  wins: number;
  morale: number;
  confidence: number;
  principalTrust?: number;
  recentForm: string;
  route: string;
};

export type ManagerHomeSnapshot = {
  previousRace?: ManagerHomePreviousRace;
  driverHighlights: ManagerHomeDriverHighlight[];
  teamChampionshipPosition?: number;
  teamPoints: number;
  recentTeamForm: string;
};

export function managerHomeSnapshot(state: GameState): ManagerHomeSnapshot {
  const playerDrivers = state.drivers.filter((driver) => driver.teamId === state.selectedTeamId);
  const completed = state.calendar
    .map((race) => ({ race, results: state.completedRaceResults[race.id] }))
    .filter((entry): entry is { race: typeof state.calendar[number]; results: RaceResult[] } =>
      Array.isArray(entry.results) && entry.results.length > 0);
  const latest = completed.at(-1);
  const latestPlayerResults = latest
    ? latest.results
      .filter((result) => result.teamId === state.selectedTeamId)
      .sort(resultSort)
    : [];
  const previousRace = latest && latestPlayerResults.length > 0
    ? previousRaceSnapshot(state, latest.race.id, latest.race.gpName, latest.race.round, latestPlayerResults)
    : undefined;
  const constructorIndex = state.constructorStandings.findIndex((entry) => entry.entityId === state.selectedTeamId);
  const constructorStanding = constructorIndex >= 0 ? state.constructorStandings[constructorIndex] : undefined;
  const recentRaces = completed.slice(-3);

  return {
    previousRace,
    driverHighlights: playerDrivers.map((driver) => {
      const standingIndex = state.driverStandings.findIndex((entry) => entry.entityId === driver.id);
      const standing = standingIndex >= 0 ? state.driverStandings[standingIndex] : undefined;
      const recent = recentRaces
        .map((entry) => entry.results.find((result) => result.driverId === driver.id))
        .filter((result): result is RaceResult => Boolean(result));
      return {
        driverId: driver.id,
        name: driver.name,
        championshipPosition: standingIndex >= 0 ? standingIndex + 1 : undefined,
        points: standing?.points ?? 0,
        wins: standing?.wins ?? 0,
        morale: driver.morale,
        confidence: driver.confidence,
        principalTrust: state.driverRelationships?.[driver.id]?.trustInPrincipal,
        recentForm: formLabel(recent),
        route: `/relationships?driver=${encodeURIComponent(driver.id)}`,
      };
    }),
    teamChampionshipPosition: constructorIndex >= 0 ? constructorIndex + 1 : undefined,
    teamPoints: constructorStanding?.points ?? 0,
    recentTeamForm: teamFormLabel(recentRaces.map((entry) =>
      entry.results.filter((result) => result.teamId === state.selectedTeamId))),
  };
}

function previousRaceSnapshot(
  state: GameState,
  raceId: string,
  raceName: string,
  round: number,
  results: RaceResult[],
): ManagerHomePreviousRace {
  const best = results[0];
  const points = results.reduce((sum, result) => sum + result.points, 0);
  const finish = resultLabel(best);
  const driverName = state.drivers.find((driver) => driver.id === best.driverId)?.name ?? best.driverId;
  return {
    raceId,
    raceName,
    round,
    headline: `${driverName} ${finish}`,
    summary: `${results.length} car${results.length === 1 ? '' : 's'} classified · ${points} team point${points === 1 ? '' : 's'} scored`,
    points,
    results: results.map((result) => ({
      driverId: result.driverId,
      driverName: state.drivers.find((driver) => driver.id === result.driverId)?.name ?? result.driverId,
      positionLabel: resultLabel(result),
      points: result.points,
      status: result.status,
    })),
    route: `/results/${raceId}`,
  };
}

function resultSort(a: RaceResult, b: RaceResult): number {
  if (a.position == null && b.position == null) return b.lapsCompleted - a.lapsCompleted;
  if (a.position == null) return 1;
  if (b.position == null) return -1;
  return a.position - b.position;
}

function resultLabel(result: RaceResult): string {
  if (result.status !== 'Finished') return result.status;
  return result.position == null ? 'unclassified' : `finished P${result.position}`;
}

function formLabel(results: RaceResult[]): string {
  if (results.length === 0) return 'No completed races';
  return results.map((result) =>
    result.status === 'Finished' && result.position != null ? `P${result.position}` : result.status).join(' · ');
}

function teamFormLabel(results: RaceResult[][]): string {
  if (results.length === 0) return 'No completed races';
  return results.map((raceResults) => {
    const best = [...raceResults].sort(resultSort)[0];
    return best ? (best.status === 'Finished' && best.position != null ? `P${best.position}` : best.status) : '—';
  }).join(' · ');
}
