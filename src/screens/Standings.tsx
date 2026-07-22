import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { StandingsTable } from '../components/StandingsTable';
import { CompactPagination } from '../components/CompactPagination';
import { Panel } from '../components/Panel';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  STANDINGS_PAGE_SIZE,
  pageCount,
  standingsPage,
  type StandingsTab,
} from './seasonOverviewViewModel';
import { WorldGrid, WorldSeasonCard } from './UniverseHistory';
import type { Series } from '../types/gameTypes';
import { canViewWorldStandings, worldChampionshipOptions } from './worldStandingsViewModel';

export function Standings() {
  const { state } = useGame();
  const [tab, setTab] = useState<StandingsTab>('drivers');
  const [page, setPage] = useState(0);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  if (!state) return null;

  const activeSeries = selectedSeries ?? state.series;
  const worldEnabled = canViewWorldStandings(state.gameMode);
  const championshipOptions = worldChampionshipOptions(state.series, state.motorsportUniverse);
  const selectedChampionship = championshipOptions.find((entry) => entry.series === activeSeries);
  const viewingPlayerSeries = activeSeries === state.series;

  const driverName = (id: string) => state.drivers.find((driver) => driver.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((team) => team.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((team) => team.id === id)?.color;
  const teamOfDriver = (id: string) => teamName(state.drivers.find((driver) => driver.id === id)?.teamId ?? '');
  const playerDriverIds = state.drivers.filter((driver) => driver.teamId === state.selectedTeamId).map((driver) => driver.id);
  const entries = tab === 'drivers' ? state.driverStandings : state.constructorStandings;
  const tabPageCount = pageCount(entries.length, STANDINGS_PAGE_SIZE);
  const safePage = Math.min(page, tabPageCount - 1);
  const visibleEntries = standingsPage(entries, safePage);
  const leader = entries[0];
  const runnerUp = entries[1];
  const playerTeamPosition = state.constructorStandings.findIndex(
    (entry) => entry.entityId === state.selectedTeamId,
  ) + 1;
  const playerTeamPoints = state.constructorStandings.find(
    (entry) => entry.entityId === state.selectedTeamId,
  )?.points ?? 0;

  function selectTab(nextTab: StandingsTab) {
    setTab(nextTab);
    setPage(0);
  }

  function selectSeries(nextSeries: Series) {
    setSelectedSeries(nextSeries);
    setPage(0);
  }

  return (
    <WorkspaceScreen className="era-feature-screen era-standings-screen">
      <WorkspaceHeader
        eyebrow="Competition center"
        title="Championship Standings"
        subtitle={`Drivers and constructors after round ${Math.min(state.currentRaceIndex, state.calendar.length)} of ${state.calendar.length}.`}
      />

      {worldEnabled && championshipOptions.length > 1 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950/35 p-3">
          <label className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500" htmlFor="championship-selector">Championship</label>
          <select
            id="championship-selector"
            className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-semibold text-neutral-200 sm:w-auto"
            value={activeSeries}
            onChange={(event) => selectSeries(event.target.value as Series)}
          >
            {championshipOptions.map((option) => (
              <option key={option.series} value={option.series}>
                {option.series}{option.isPlayerSeries ? ' · Your championship' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {!viewingPlayerSeries ? (
        <WorkspaceBody className="space-y-4">
          {selectedChampionship?.championship ? (
            <>
              <WorldGrid championships={{ [activeSeries]: selectedChampionship.championship }} showMovements={false} />
              {selectedChampionship.latestSeason ? (
                <div>
                  <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-neutral-500">Most recent completed season</div>
                  <WorldSeasonCard season={selectedChampionship.latestSeason} />
                </div>
              ) : (
                <Panel><p className="text-sm text-neutral-400">No completed season is available yet. This championship's current teams, drivers, and contract years are shown above.</p></Panel>
              )}
            </>
          ) : (
            <Panel><p className="text-sm text-neutral-400">This championship is not populated in the current universe.</p></Panel>
          )}
        </WorkspaceBody>
      ) : (
      <>

      <MetricStrip>
        <WorkspaceMetric label={`${tab === 'drivers' ? 'Driver' : 'Constructor'} leader`} value={leader ? (tab === 'drivers' ? driverName(leader.entityId) : teamName(leader.entityId)) : 'No results'} detail={`${leader?.points ?? 0} points`} />
        <WorkspaceMetric label="Lead margin" value={leader && runnerUp ? `${leader.points - runnerUp.points} pts` : '—'} detail={runnerUp ? `over ${tab === 'drivers' ? driverName(runnerUp.entityId) : teamName(runnerUp.entityId)}` : 'Not established'} />
        <WorkspaceMetric label="My team" value={playerTeamPosition > 0 ? `P${playerTeamPosition}` : 'Not ranked'} detail={`${playerTeamPoints} constructor points`} />
        <WorkspaceMetric label="Season progress" value={`${Math.min(state.currentRaceIndex, state.calendar.length)} / ${state.calendar.length}`} detail={state.seasonComplete ? 'Season complete' : 'Rounds completed'} />
      </MetricStrip>

      <WorkspaceTabs
        items={[
          { id: 'drivers' as const, label: `Drivers (${state.driverStandings.length})` },
          { id: 'constructors' as const, label: `Constructors (${state.constructorStandings.length})` },
        ]}
        active={tab}
        onChange={selectTab}
        ariaLabel="Championship sections"
      />

      <WorkspaceBody>
      <StandingsTable
        title={tab === 'drivers' ? "Drivers' Championship" : "Constructors' Championship"}
        entries={visibleEntries}
        nameOf={tab === 'drivers' ? driverName : teamName}
        subtitleOf={tab === 'drivers' ? teamOfDriver : undefined}
        colorOf={tab === 'constructors' ? teamColor : undefined}
        highlightId={tab === 'drivers' ? playerDriverIds.find((id) => visibleEntries.some((entry) => entry.entityId === id)) : state.selectedTeamId}
        positionOffset={safePage * STANDINGS_PAGE_SIZE}
      />
      <CompactPagination noun={tab} total={entries.length} page={safePage} pageCount={tabPageCount} pageSize={STANDINGS_PAGE_SIZE} onPage={setPage} />
      </WorkspaceBody>
      </>
      )}
    </WorkspaceScreen>
  );
}
