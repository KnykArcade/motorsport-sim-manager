import type { GameMode, Series } from '../types/gameTypes';
import type { MotorsportUniverseState, UniverseChampionshipSeason, UniverseChampionshipState } from '../types/universeTypes';

export type WorldChampionshipOption = {
  series: Series;
  isPlayerSeries: boolean;
  championship?: UniverseChampionshipState;
  latestSeason?: UniverseChampionshipSeason;
};

export type AroundTheWorldEntry = {
  series: Series;
  seasonYear: number;
  championName?: string;
  teamChampionName?: string;
  hasCompletedSeason: boolean;
  liveLeaderName?: string;
  liveLeaderPoints?: number;
  completedRaces: number;
  totalRaces: number;
  latestWinnerName?: string;
  latestRaceName?: string;
  nextRaceName?: string;
};

export function canViewWorldStandings(gameMode: GameMode): boolean {
  return gameMode !== 'SingleSeason';
}

function latestSeason(championship?: UniverseChampionshipState): UniverseChampionshipSeason | undefined {
  return [...(championship?.seasonHistory ?? [])].sort((a, b) => b.seasonYear - a.seasonYear)[0];
}

export function worldChampionshipOptions(
  playerSeries: Series,
  universe?: MotorsportUniverseState,
): WorldChampionshipOption[] {
  const championships = universe?.championships ?? {};
  const series = new Set<Series>([playerSeries]);
  (Object.keys(championships) as Series[]).forEach((entry) => {
    if (championships[entry]) series.add(entry);
  });

  return [...series]
    .sort((a, b) => (a === playerSeries ? -1 : b === playerSeries ? 1 : a.localeCompare(b)))
    .map((entry) => {
      const championship = championships[entry];
      return {
        series: entry,
        isPlayerSeries: entry === playerSeries,
        championship,
        latestSeason: latestSeason(championship),
      };
    });
}

export function aroundTheWorldEntries(
  playerSeries: Series,
  universe?: MotorsportUniverseState,
): AroundTheWorldEntry[] {
  return worldChampionshipOptions(playerSeries, universe)
    .filter((option) => !option.isPlayerSeries && option.championship)
    .map((option) => ({
      series: option.series,
      seasonYear: option.championship!.seasonYear,
      championName: option.latestSeason?.driverChampionName ?? option.latestSeason?.driverChampionId,
      teamChampionName: option.latestSeason?.teamChampionName ?? option.latestSeason?.teamChampionId,
      hasCompletedSeason: Boolean(option.latestSeason),
      liveLeaderName: option.championship!.drivers.find(
        (driver) => driver.driverId === option.championship!.liveSeason?.driverStandings[0]?.entityId,
      )?.name,
      liveLeaderPoints: option.championship!.liveSeason?.driverStandings[0]?.points,
      completedRaces: option.championship!.liveSeason?.completedRaces ?? 0,
      totalRaces: option.championship!.liveSeason?.totalRaces ?? 0,
      latestWinnerName: option.championship!.liveSeason?.raceResults.at(-1)?.winnerDriverName,
      latestRaceName: option.championship!.liveSeason?.raceResults.at(-1)?.raceName,
      nextRaceName: option.championship!.liveSeason?.schedule[
        option.championship!.liveSeason?.completedRaces ?? 0
      ]?.raceName,
    }));
}
