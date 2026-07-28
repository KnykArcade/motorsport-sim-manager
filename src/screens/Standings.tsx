import { useSearchParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { StandingsTable } from '../components/StandingsTable';
import { CompactPagination } from '../components/CompactPagination';
import { Panel } from '../components/Panel';
import {
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  STANDINGS_PAGE_SIZE,
  pageCount,
  standingsPage,
  type StandingsTab,
} from './seasonOverviewViewModel';
import { WorldGrid, WorldLiveSeasonCard, WorldSeasonCard } from './UniverseHistory';
import type { Series } from '../types/gameTypes';
import { canViewWorldStandings, worldChampionshipOptions } from './worldStandingsViewModel';
import { standingsDossier } from './championshipRecordsViewModel';

export function Standings() {
  const { state } = useGame();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: StandingsTab = searchParams.get('tab') === 'constructors' ? 'constructors' : 'drivers';
  const page = Math.max(0, Number(searchParams.get('page') ?? 0) || 0);
  const selectedEntryId = searchParams.get('entry');
  if (!state) return null;

  const requestedSeries = searchParams.get('series') as Series | null;
  const worldEnabled = canViewWorldStandings(state.gameMode);
  const championshipOptions = worldChampionshipOptions(state.series, state.motorsportUniverse);
  const activeSeries = championshipOptions.some((entry) => entry.series === requestedSeries)
    ? requestedSeries!
    : state.series;
  const selectedChampionship = championshipOptions.find((entry) => entry.series === activeSeries);
  const viewingPlayerSeries = activeSeries === state.series;
  const roundsComplete = Math.min(state.currentRaceIndex, state.calendar.length);

  const driverName = (id: string) => state.drivers.find((driver) => driver.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((team) => team.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((team) => team.id === id)?.color;
  const teamOfDriver = (id: string) => teamName(state.drivers.find((driver) => driver.id === id)?.teamId ?? '');
  const playerDriverIds = state.drivers.filter((driver) => driver.teamId === state.selectedTeamId).map((driver) => driver.id);
  const entries = tab === 'drivers' ? state.driverStandings : state.constructorStandings;
  const dossier = standingsDossier(entries, selectedEntryId);
  const selectedId = dossier?.entry.entityId ?? null;
  const tabPageCount = pageCount(entries.length, STANDINGS_PAGE_SIZE);
  const safePage = Math.min(page, tabPageCount - 1);
  const visibleEntries = standingsPage(entries, safePage);
  const selectedName = selectedId
    ? tab === 'drivers' ? driverName(selectedId) : teamName(selectedId)
    : 'No championship entry';
  const selectedTeam = selectedId
    ? tab === 'drivers' ? teamOfDriver(selectedId) : teamName(selectedId)
    : '—';

  function updateQuery(patch: Record<string, string | number | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace: true });
  }

  function selectTab(nextTab: StandingsTab) {
    updateQuery({ tab: nextTab, page: undefined, entry: undefined });
  }

  function selectSeries(nextSeries: Series) {
    updateQuery({ series: nextSeries, page: undefined, entry: undefined });
  }

  return (
    <WorkspaceScreen className="era-feature-screen era-standings-screen ui-championship-screen">
      <WorkspaceHeader
        eyebrow="Competition center"
        title="Championships"
        subtitle={`${activeSeries} · ${roundsComplete} of ${state.calendar.length} rounds complete`}
        actions={worldEnabled && championshipOptions.length > 1 ? (
          <label className="ui-championship-selector">
            <span>Championship</span>
            <select value={activeSeries} onChange={(event) => selectSeries(event.target.value as Series)}>
              {championshipOptions.map((option) => (
                <option key={option.series} value={option.series}>
                  {option.series}{option.isPlayerSeries ? ' · Your championship' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : undefined}
      />

      {!viewingPlayerSeries ? (
        <WorkspaceBody className="ui-championship-world-body">
          {selectedChampionship?.championship ? (
            <div className="ui-championship-world-grid">
              <section className="ui-fm-pane">
                <div className="ui-fm-pane-header">
                  <div><div className="ui-fm-pane-title">Live championship</div><div className="ui-fm-pane-meta">{activeSeries} current season</div></div>
                </div>
                <div className="ui-fm-pane-body ui-fm-scroll-column">
                  {selectedChampionship.championship.liveSeason ? (
                    <WorldLiveSeasonCard championship={selectedChampionship.championship} live={selectedChampionship.championship.liveSeason} />
                  ) : <Panel><p className="text-sm text-neutral-400">No live standings are available yet.</p></Panel>}
                </div>
              </section>
              <section className="ui-fm-pane">
                <div className="ui-fm-pane-header">
                  <div><div className="ui-fm-pane-title">Current grid</div><div className="ui-fm-pane-meta">Teams, drivers, contracts, and absences</div></div>
                </div>
                <div className="ui-fm-pane-body ui-fm-scroll-column">
                  <WorldGrid championships={{ [activeSeries]: selectedChampionship.championship }} showMovements={false} />
                </div>
              </section>
              <section className="ui-fm-pane">
                <div className="ui-fm-pane-header">
                  <div><div className="ui-fm-pane-title">Latest completed season</div><div className="ui-fm-pane-meta">Most recent archived championship</div></div>
                </div>
                <div className="ui-fm-pane-body ui-fm-scroll-column">
                  {selectedChampionship.latestSeason ? (
                    <WorldSeasonCard season={selectedChampionship.latestSeason} />
                  ) : <Panel><p className="text-sm text-neutral-400">No completed season is available yet.</p></Panel>}
                </div>
              </section>
            </div>
          ) : (
            <Panel><p className="text-sm text-neutral-400">This championship is not populated in the current universe.</p></Panel>
          )}
        </WorkspaceBody>
      ) : (
        <>
          <WorkspaceTabs
            items={[
              { id: 'drivers' as const, label: `Drivers (${state.driverStandings.length})` },
              { id: 'constructors' as const, label: `Teams (${state.constructorStandings.length})` },
            ]}
            active={tab}
            onChange={selectTab}
            ariaLabel="Championship sections"
          />
          <WorkspaceBody className="ui-championship-body">
            <div className="ui-fm-workspace-grid is-three ui-championship-grid">
              <section className="ui-fm-pane ui-championship-list-pane">
                <div className="ui-fm-pane-header">
                  <div><div className="ui-fm-pane-title">{tab === 'drivers' ? 'Driver table' : 'Team table'}</div><div className="ui-fm-pane-meta">Select an entry for full context</div></div>
                </div>
                <div className="ui-fm-pane-body">
                  {entries.map((entry, index) => (
                    <button
                      key={entry.entityId}
                      type="button"
                      className={`ui-fm-list-button ${selectedId === entry.entityId ? 'is-active' : ''} ${playerDriverIds.includes(entry.entityId) || entry.entityId === state.selectedTeamId ? 'is-player' : ''}`}
                      onClick={() => updateQuery({ entry: entry.entityId })}
                    >
                      <span>P{index + 1} · {entry.points} points</span>
                      <strong>{tab === 'drivers' ? driverName(entry.entityId) : teamName(entry.entityId)}</strong>
                      <small>{tab === 'drivers' ? teamOfDriver(entry.entityId) : `${entry.wins} wins · ${entry.podiums} podiums`}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="ui-fm-pane ui-championship-table-pane">
                <div className="ui-fm-pane-header">
                  <div><div className="ui-fm-pane-title">{tab === 'drivers' ? "Drivers' championship" : "Teams' championship"}</div><div className="ui-fm-pane-meta">Points, wins, podiums, and retirements</div></div>
                </div>
                <div className="ui-fm-pane-body ui-fm-scroll-column">
                  <StandingsTable
                    entries={visibleEntries}
                    nameOf={tab === 'drivers' ? driverName : teamName}
                    subtitleOf={tab === 'drivers' ? teamOfDriver : undefined}
                    colorOf={tab === 'constructors' ? teamColor : undefined}
                    highlightId={selectedId ?? undefined}
                    positionOffset={safePage * STANDINGS_PAGE_SIZE}
                    onSelect={(entryId) => updateQuery({ entry: entryId })}
                  />
                </div>
                <CompactPagination noun={tab} total={entries.length} page={safePage} pageCount={tabPageCount} pageSize={STANDINGS_PAGE_SIZE} onPage={(nextPage) => updateQuery({ page: nextPage })} />
              </section>

              <section className="ui-fm-pane ui-championship-context-pane">
                <div className="ui-fm-pane-header">
                  <div><div className="ui-fm-pane-title">Entry dossier</div><div className="ui-fm-pane-meta">{selectedName}</div></div>
                </div>
                <div className="ui-fm-pane-body">
                  {dossier ? (
                    <div className="ui-championship-dossier">
                      <div className="ui-championship-profile">
                        <span>{tab === 'drivers' ? selectedTeam : activeSeries}</span>
                        <strong>{selectedName}</strong>
                        <small>Championship position P{dossier.position}</small>
                      </div>
                      <div className="ui-fm-key-value"><span>Points</span><strong>{dossier.entry.points}</strong></div>
                      <div className="ui-fm-key-value"><span>Gap to leader</span><strong>{dossier.position === 1 ? 'Leader' : `${dossier.gapToLeader} pts`}</strong></div>
                      <div className="ui-fm-key-value"><span>Gap to position ahead</span><strong>{dossier.position === 1 ? '—' : `${dossier.gapToAhead} pts`}</strong></div>
                      <div className="ui-fm-key-value"><span>Margin behind</span><strong>{dossier.position === entries.length ? '—' : `${dossier.gapToBehind} pts`}</strong></div>
                      <div className="ui-fm-key-value"><span>Wins</span><strong>{dossier.entry.wins}</strong></div>
                      <div className="ui-fm-key-value"><span>Podiums</span><strong>{dossier.entry.podiums}</strong></div>
                      <div className="ui-fm-key-value"><span>DNFs</span><strong>{dossier.entry.dnfs}</strong></div>
                      <div className="ui-championship-progress">
                        <span>Season progress</span>
                        <strong>{roundsComplete} / {state.calendar.length}</strong>
                        <div><i style={{ width: `${state.calendar.length ? (roundsComplete / state.calendar.length) * 100 : 0}%` }} /></div>
                      </div>
                    </div>
                  ) : <p className="ui-technical-empty">No standings entry is available yet.</p>}
                </div>
              </section>
            </div>
          </WorkspaceBody>
        </>
      )}
    </WorkspaceScreen>
  );
}
