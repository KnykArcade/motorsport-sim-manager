import { describe, expect, it } from 'vitest';
import type { MotorsportUniverseState, UniverseChampionshipState } from '../types/universeTypes';
import { aroundTheWorldEntries, canViewWorldStandings, worldChampionshipOptions } from './worldStandingsViewModel';

const nascar: UniverseChampionshipState = {
  series: 'NASCAR', seasonYear: 2027,
  teams: [{ teamId: 'team', name: 'Team', reputation: 80, seatCount: 1, driverIds: ['driver'] }],
  drivers: [{ driverId: 'driver', name: 'Driver', teamId: 'team', series: 'NASCAR', contractYearsRemaining: 2 }],
  seasonHistory: [{
    seasonYear: 2026, series: 'NASCAR', completedRaces: 36,
    driverChampionId: 'champion', driverChampionName: 'Champion Driver',
    teamChampionId: 'champion-team', teamChampionName: 'Champion Team',
    driverNames: {}, teamNames: {}, driverStandings: [], teamStandings: [],
  }],
};

const universe: MotorsportUniverseState = { version: 1, seasonYear: 2027, championships: { NASCAR: nascar } };

describe('world standings view model', () => {
  it('gates the connected world out of single-season games', () => {
    expect(canViewWorldStandings('SingleSeason')).toBe(false);
    expect(canViewWorldStandings('Career')).toBe(true);
    expect(canViewWorldStandings('Sandbox')).toBe(true);
  });

  it('keeps the player championship first and null-guards missing universe state', () => {
    expect(worldChampionshipOptions('F1').map((entry) => entry.series)).toEqual(['F1']);
    expect(worldChampionshipOptions('F1', universe).map((entry) => entry.series)).toEqual(['F1', 'NASCAR']);
  });

  it('uses only completed history for around-the-world champions', () => {
    expect(aroundTheWorldEntries('F1', universe)).toEqual([{
      series: 'NASCAR', seasonYear: 2027, championName: 'Champion Driver',
      teamChampionName: 'Champion Team', hasCompletedSeason: true,
      liveLeaderName: undefined, liveLeaderPoints: undefined,
      completedRaces: 0, totalRaces: 0,
      latestWinnerName: undefined, latestRaceName: undefined, nextRaceName: undefined,
    }]);
  });

  it('surfaces live leader, latest winner, and next round from persisted world state', () => {
    const liveUniverse: MotorsportUniverseState = {
      ...universe,
      championships: {
        NASCAR: {
          ...nascar,
          liveSeason: {
            seasonYear: 2027, totalRaces: 2, completedRaces: 1,
            driverStandings: [{ entityId: 'driver', points: 40, wins: 1, podiums: 1, dnfs: 0 }],
            teamStandings: [{ entityId: 'team', points: 40, wins: 1, podiums: 1, dnfs: 0 }],
            raceResults: [{ round: 1, raceId: 'r1', raceName: 'Opener', trackName: 'Track', winnerDriverId: 'driver', winnerDriverName: 'Driver', winnerTeamId: 'team', winnerTeamName: 'Team', podiumDriverIds: ['driver'] }],
            schedule: [{ round: 1, raceId: 'r1', raceName: 'Opener', trackName: 'Track' }, { round: 2, raceId: 'r2', raceName: 'Finale', trackName: 'Track 2' }],
          },
        },
      },
    };
    expect(aroundTheWorldEntries('F1', liveUniverse)[0]).toMatchObject({
      liveLeaderName: 'Driver', liveLeaderPoints: 40, completedRaces: 1,
      latestWinnerName: 'Driver', latestRaceName: 'Opener', nextRaceName: 'Finale',
    });
  });
});
