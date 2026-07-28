import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useGame } from '../game/GameContext';
import { driverById, teamById } from '../game/careerState';
import { formatLapTime } from '../sim/lapArchiveEngine';
import { Panel } from '../components/Panel';
import { RaceResultTable } from '../components/RaceResultTable';
import { CompactPagination } from '../components/CompactPagination';
import {
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  RACE_HISTORY_PAGE_SIZE,
  RACE_HISTORY_TABS,
  RACE_STORY_PAGE_SIZE,
  raceHistoryPage,
  raceHistoryPageCount,
  raceStoryEvents,
  type RaceHistoryTab,
  type RaceStoryFilter,
} from './raceHistoryViewModel';
import { selectedRecord } from './championshipRecordsViewModel';
import { EntityBrowseControls } from '../components/EntityBrowseControls';

export function RaceHistory() {
  const { state } = useGame();
  const [searchParams, setSearchParams] = useSearchParams();
  const archive = useMemo(
    () => [...(state?.raceArchive ?? [])].sort((a, b) => b.season - a.season || b.round - a.round),
    [state?.raceArchive],
  );
  const selectedId = searchParams.get('race') ?? archive[0]?.raceId ?? null;
  const requestedTab = searchParams.get('tab');
  const tab: RaceHistoryTab = requestedTab === 'qualifying'
    || requestedTab === 'pace'
    || requestedTab === 'story'
    ? requestedTab
    : 'classification';
  const requestedFilter = searchParams.get('filter');
  const storyFilter: RaceStoryFilter = requestedFilter === 'strategy' ? 'strategy' : 'all';
  const page = Math.max(0, Number(searchParams.get('page') ?? 0) || 0);

  if (!state) return null;

  const nameOf = (id: string) => driverById(state, id)?.name ?? id;
  const teamNameOf = (id: string) => teamById(state, id)?.name ?? id;
  const colorOf = (id: string) => teamById(state, id)?.color;

  if (archive.length === 0) {
    return (
      <WorkspaceScreen className="era-feature-screen era-race-history-screen ui-competition-archive-screen">
        <WorkspaceHeader eyebrow="Competition center" title="Race History" subtitle="Classification, qualifying, pace, and race stories." />
        <WorkspaceBody><Panel><p className="text-sm text-neutral-400">No races completed yet. Run a race weekend to build the archive.</p></Panel></WorkspaceBody>
      </WorkspaceScreen>
    );
  }

  const selected = selectedRecord(archive, selectedId, (entry) => entry.raceId)!;
  const results = [...(state.completedRaceResults[selected.raceId] ?? [])]
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const qualifying = [...(state.qualifyingResults[selected.raceId] ?? [])]
    .sort((a, b) => a.position - b.position);
  const events = state.raceEvents[selected.raceId] ?? [];
  const storyEvents = raceStoryEvents(events, storyFilter);
  const fastest = selected.fastestLap;
  const selectedWinner = selected.winnerDriverId ? nameOf(selected.winnerDriverId) : 'No winner archived';
  const selectedPole = selected.poleDriverId ? nameOf(selected.poleDriverId) : 'No pole archived';

  const activeEntries = tab === 'classification'
    ? results
    : tab === 'qualifying'
      ? qualifying
      : tab === 'pace'
        ? selected.laps
        : storyEvents;
  const activePageSize = tab === 'story' ? RACE_STORY_PAGE_SIZE : RACE_HISTORY_PAGE_SIZE;
  const activePageCount = raceHistoryPageCount(activeEntries.length, activePageSize);
  const safePage = Math.min(page, activePageCount - 1);
  const selectedArchiveIndex = archive.findIndex((entry) => entry.raceId === selected.raceId);

  function updateQuery(patch: Record<string, string | number | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace: true });
  }

  function selectRace(raceId: string) {
    updateQuery({ race: raceId, page: undefined });
  }

  function selectTab(nextTab: RaceHistoryTab) {
    updateQuery({ tab: nextTab, page: undefined });
  }

  function browseRace(offset: number) {
    if (!archive.length || selectedArchiveIndex < 0) return;
    const nextIndex = (selectedArchiveIndex + offset + archive.length) % archive.length;
    selectRace(archive[nextIndex].raceId);
  }

  return (
    <WorkspaceScreen className="era-feature-screen era-race-history-screen ui-competition-archive-screen">
      <WorkspaceHeader
        eyebrow="Competition center"
        title="Race History"
        subtitle={`${archive.length} archived races · ${selected.season} ${selected.gpName}`}
      />
      <WorkspaceTabs items={RACE_HISTORY_TABS} active={tab} onChange={selectTab} ariaLabel="Race history sections" />
      <WorkspaceBody className="ui-race-history-body">
        <div className="ui-fm-workspace-grid is-three ui-race-history-grid">
          <section className="ui-fm-pane ui-race-archive-list">
            <div className="ui-fm-pane-header">
              <div><div className="ui-fm-pane-title">Race archive</div><div className="ui-fm-pane-meta">Newest event first</div></div>
            </div>
            <div className="ui-fm-pane-body">
              {archive.map((entry) => (
                <button
                  key={entry.raceId}
                  type="button"
                  className={`ui-fm-list-button ${selected.raceId === entry.raceId ? 'is-active' : ''}`}
                  onClick={() => selectRace(entry.raceId)}
                >
                  <span>{entry.season} · Round {entry.round}</span>
                  <strong>{entry.gpName}</strong>
                  <small>{entry.trackName}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="ui-fm-pane ui-race-archive-detail">
            <div className="ui-fm-pane-header">
              <div><div className="ui-fm-pane-title">{selected.gpName} · {RACE_HISTORY_TABS.find((entry) => entry.id === tab)?.label}</div><div className="ui-fm-pane-meta">{selected.trackName} · {selected.season} round {selected.round}</div></div>
              <div className="flex items-center gap-2">
                {tab === 'story' && (
                  <div className="ui-race-story-filter">
                    <button type="button" className={storyFilter === 'all' ? 'is-active' : ''} onClick={() => updateQuery({ filter: undefined, page: undefined })}>All</button>
                    <button type="button" className={storyFilter === 'strategy' ? 'is-active' : ''} onClick={() => updateQuery({ filter: 'strategy', page: undefined })}>Strategy</button>
                  </div>
                )}
                <EntityBrowseControls
                  position={Math.max(0, selectedArchiveIndex)}
                  total={archive.length}
                  noun="archived races"
                  onPrevious={() => browseRace(-1)}
                  onNext={() => browseRace(1)}
                />
              </div>
            </div>
            <div className="ui-fm-pane-body ui-fm-scroll-column">
              {tab === 'classification' && (
                results.length === 0 ? <EmptyState>No classification archive for this race.</EmptyState> : (
                  <RaceResultTable results={raceHistoryPage(results, safePage)} nameOf={nameOf} teamNameOf={teamNameOf} colorOf={colorOf} highlightTeamId={state.selectedTeamId} />
                )
              )}
              {tab === 'qualifying' && (
                qualifying.length === 0 ? <EmptyState>No qualifying archive for this race.</EmptyState> : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500"><th className="pb-2 font-medium">Pos</th><th className="pb-2 font-medium">Driver</th><th className="pb-2 font-medium">Team</th><th className="pb-2 font-medium">Plan</th><th className="pb-2 text-right font-medium">Gap</th></tr></thead>
                    <tbody>{raceHistoryPage(qualifying, safePage).map((result) => (
                      <tr key={result.driverId} className="border-b border-neutral-900/70">
                        <td className="py-2 tabular-nums text-neutral-500">P{result.position}</td>
                        <td className="py-2 font-medium text-neutral-200">{nameOf(result.driverId)}{result.dnq && <span className="ml-1 text-[10px] font-semibold text-red-400">DNQ</span>}</td>
                        <td className="py-2 text-neutral-500">{teamNameOf(result.teamId)}</td>
                        <td className="py-2 text-xs text-neutral-400">{result.segment ?? result.runPlan}</td>
                        <td className="py-2 text-right tabular-nums text-neutral-500">{result.gapText || '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )
              )}
              {tab === 'pace' && (
                selected.laps.length === 0 ? <EmptyState>No lap-time archive for this race.</EmptyState> : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500"><th className="pb-2 font-medium">#</th><th className="pb-2 font-medium">Driver</th><th className="pb-2 font-medium">Team</th><th className="pb-2 font-medium">Best Lap</th><th className="pb-2 text-right font-medium">Gap</th></tr></thead>
                    <tbody>{raceHistoryPage(selected.laps, safePage).map((lap, index) => {
                      const absoluteIndex = safePage * RACE_HISTORY_PAGE_SIZE + index;
                      const gap = lap.bestLapSec - selected.laps[0].bestLapSec;
                      const isPlayer = driverById(state, lap.driverId)?.teamId === state.selectedTeamId;
                      return (
                        <tr key={lap.driverId} className={`border-b border-neutral-900/70 ${isPlayer ? 'bg-amber-500/10' : ''}`}>
                          <td className="py-2 tabular-nums text-neutral-500">{absoluteIndex + 1}</td>
                          <td className="py-2 font-medium text-neutral-200">{lap.driverName}</td>
                          <td className="py-2 text-neutral-500">{lap.teamName}</td>
                          <td className="py-2 tabular-nums text-neutral-200">{formatLapTime(lap.bestLapSec)}</td>
                          <td className="py-2 text-right tabular-nums text-neutral-500">{absoluteIndex === 0 ? '—' : `+${gap.toFixed(3)}`}</td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                )
              )}
              {tab === 'story' && (
                storyEvents.length === 0 ? <EmptyState>No events were recorded in this section.</EmptyState> : (
                  <div className="ui-race-story-list">
                    {raceHistoryPage(storyEvents, safePage, RACE_STORY_PAGE_SIZE).map((event, index) => (
                      <div key={`${event.lap}-${index}-${event.text}`}><span>Lap {event.lap}</span><p>{event.text}</p></div>
                    ))}
                  </div>
                )
              )}
            </div>
                <CompactPagination
                  noun={tab === 'story' ? 'events' : tab === 'pace' ? 'drivers' : 'entries'}
                  total={activeEntries.length}
                  page={safePage}
                  pageCount={activePageCount}
                  pageSize={activePageSize}
                  onPage={(nextPage) => updateQuery({ page: nextPage })}
                />
          </section>

          <section className="ui-fm-pane ui-race-archive-context">
            <div className="ui-fm-pane-header">
              <div><div className="ui-fm-pane-title">Event dossier</div><div className="ui-fm-pane-meta">{selected.gpName}</div></div>
            </div>
            <div className="ui-fm-pane-body">
              <div className="ui-race-dossier-head"><span>{selected.season} · Round {selected.round}</span><strong>{selected.gpName}</strong><small>{selected.trackName}</small></div>
              <div className="ui-fm-key-value"><span>Winner</span><strong>{selectedWinner}</strong></div>
              <div className="ui-fm-key-value"><span>Pole</span><strong>{selectedPole}</strong></div>
              <div className="ui-fm-key-value"><span>Fastest lap</span><strong>{fastest ? nameOf(fastest.driverId) : '—'}</strong></div>
              <div className="ui-fm-key-value"><span>Fastest time</span><strong>{fastest ? formatLapTime(fastest.timeSec) : '—'}</strong></div>
              <div className="ui-fm-key-value"><span>Classified</span><strong>{results.length}</strong></div>
              <div className="ui-fm-key-value"><span>Qualifying entries</span><strong>{qualifying.length}</strong></div>
              <div className="ui-fm-key-value"><span>Story events</span><strong>{events.length}</strong></div>
              <div className="ui-race-podium">
                <span>Podium</span>
                {selected.podium.map((driverId, index) => <div key={driverId}><i>P{index + 1}</i><strong>{nameOf(driverId)}</strong></div>)}
              </div>
            </div>
          </section>
        </div>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="ui-technical-empty">{children}</p>;
}
