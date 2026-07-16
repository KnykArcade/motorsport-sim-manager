import { useMemo, useState } from 'react';
import { useGame } from '../game/GameContext';
import { driverById, teamById } from '../game/careerState';
import { formatLapTime } from '../sim/lapArchiveEngine';
import { Panel } from '../components/Panel';
import { RaceResultTable } from '../components/RaceResultTable';
import { CompactPagination } from '../components/CompactPagination';
import { Button } from '../components/Button';
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

export function RaceHistory() {
  const { state } = useGame();
  const archive = useMemo(
    () => [...(state?.raceArchive ?? [])].sort((a, b) => b.season - a.season || b.round - a.round),
    [state?.raceArchive],
  );
  const [selectedId, setSelectedId] = useState<string | null>(archive[0]?.raceId ?? null);
  const [tab, setTab] = useState<RaceHistoryTab>('classification');
  const [page, setPage] = useState(0);
  const [storyFilter, setStoryFilter] = useState<RaceStoryFilter>('all');

  if (!state) return null;

  const nameOf = (id: string) => driverById(state, id)?.name ?? id;
  const teamNameOf = (id: string) => teamById(state, id)?.name ?? id;
  const colorOf = (id: string) => teamById(state, id)?.color;

  if (archive.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-neutral-100">Race History</h1>
        <Panel>
          <p className="text-sm text-neutral-400">No races completed yet. Run a race weekend to build the archive.</p>
        </Panel>
      </div>
    );
  }

  const selected = archive.find((entry) => entry.raceId === selectedId) ?? archive[0];
  const selectedIndex = archive.findIndex((entry) => entry.raceId === selected.raceId);
  const results = [...(state.completedRaceResults[selected.raceId] ?? [])]
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const qualifying = [...(state.qualifyingResults[selected.raceId] ?? [])]
    .sort((a, b) => a.position - b.position);
  const events = state.raceEvents[selected.raceId] ?? [];
  const storyEvents = raceStoryEvents(events, storyFilter);
  const fastest = selected.fastestLap;

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

  function selectRace(raceId: string) {
    setSelectedId(raceId);
    setPage(0);
  }

  function selectTab(nextTab: RaceHistoryTab) {
    setTab(nextTab);
    setPage(0);
  }

  return (
    <div className="era-feature-screen era-race-history-screen space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Race History</h1>
          <p className="text-sm text-neutral-400">Classification, qualifying, pace, and the story of every completed race.</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Archive</div>
          <div className="text-lg font-bold text-neutral-100">{archive.length} race{archive.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-[auto_minmax(260px,1fr)_auto]">
        <Button
          variant="secondary"
          disabled={selectedIndex >= archive.length - 1}
          onClick={() => selectRace(archive[selectedIndex + 1]?.raceId ?? selected.raceId)}
        >
          Older race
        </Button>
        <label className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2">
          <span className="mr-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Selected race</span>
          <select
            value={selected.raceId}
            onChange={(event) => selectRace(event.target.value)}
            className="w-[calc(100%-7rem)] bg-transparent text-sm font-semibold text-neutral-100 outline-none"
          >
            {archive.map((entry) => (
              <option key={entry.raceId} value={entry.raceId}>
                {entry.season} · Round {entry.round} · {entry.gpName}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          disabled={selectedIndex <= 0}
          onClick={() => selectRace(archive[selectedIndex - 1]?.raceId ?? selected.raceId)}
        >
          Newer race
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Kpi label="Winner" value={selected.winnerDriverId ? nameOf(selected.winnerDriverId) : '—'} />
        <Kpi label="Pole" value={selected.poleDriverId ? nameOf(selected.poleDriverId) : '—'} />
        <Kpi label="Fastest Lap" value={fastest ? `${nameOf(fastest.driverId)} · ${formatLapTime(fastest.timeSec)}` : '—'} />
      </div>

      <nav className="grid grid-cols-4 gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-1" aria-label="Race history sections">
        {RACE_HISTORY_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectTab(item.id)}
            aria-current={tab === item.id ? 'page' : undefined}
            className={`rounded px-3 py-2 text-xs font-semibold ${tab === item.id ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'classification' && (
        <Panel title={`${selected.gpName} · Race Classification`} actions={<span className="text-xs text-neutral-500">{selected.trackName}</span>}>
          {results.length === 0 ? <EmptyState>No classification archive for this race.</EmptyState> : (
            <RaceResultTable
              results={raceHistoryPage(results, safePage)}
              nameOf={nameOf}
              teamNameOf={teamNameOf}
              colorOf={colorOf}
              highlightTeamId={state.selectedTeamId}
            />
          )}
        </Panel>
      )}

      {tab === 'qualifying' && (
        <Panel title={`${selected.gpName} · Qualifying`}>
          {qualifying.length === 0 ? <EmptyState>No qualifying archive for this race.</EmptyState> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="pb-2 font-medium">Pos</th>
                  <th className="pb-2 font-medium">Driver</th>
                  <th className="pb-2 font-medium">Team</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 text-right font-medium">Gap</th>
                </tr>
              </thead>
              <tbody>
                {raceHistoryPage(qualifying, safePage).map((result) => (
                  <tr key={result.driverId} className="border-b border-neutral-900/70">
                    <td className="py-2 tabular-nums text-neutral-500">P{result.position}</td>
                    <td className="py-2 font-medium text-neutral-200">
                      {nameOf(result.driverId)}
                      {result.dnq && <span className="ml-1 text-[10px] font-semibold text-red-400">DNQ</span>}
                    </td>
                    <td className="py-2 text-neutral-500">{teamNameOf(result.teamId)}</td>
                    <td className="py-2 text-xs text-neutral-400">{result.segment ?? result.runPlan}</td>
                    <td className="py-2 text-right tabular-nums text-neutral-500">{result.gapText || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {tab === 'pace' && (
        <Panel title={`${selected.gpName} · Best-Lap Pace`}>
          {selected.laps.length === 0 ? <EmptyState>No lap-time archive for this race.</EmptyState> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Driver</th>
                  <th className="pb-2 font-medium">Team</th>
                  <th className="pb-2 font-medium">Best Lap</th>
                  <th className="pb-2 text-right font-medium">Gap</th>
                </tr>
              </thead>
              <tbody>
                {raceHistoryPage(selected.laps, safePage).map((lap, index) => {
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
                })}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {tab === 'story' && (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-1">
            <StoryFilterButton active={storyFilter === 'all'} onClick={() => { setStoryFilter('all'); setPage(0); }}>All Key Moments ({events.length})</StoryFilterButton>
            <StoryFilterButton active={storyFilter === 'strategy'} onClick={() => { setStoryFilter('strategy'); setPage(0); }}>Strategy & Conditions ({raceStoryEvents(events, 'strategy').length})</StoryFilterButton>
          </div>
          <Panel title={`${selected.gpName} · Race Story`}>
            {storyEvents.length === 0 ? <EmptyState>No events were recorded in this section.</EmptyState> : (
              <div className="grid gap-2 md:grid-cols-2">
                {raceHistoryPage(storyEvents, safePage, RACE_STORY_PAGE_SIZE).map((event, index) => (
                  <div key={`${event.lap}-${index}-${event.text}`} className="flex gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm">
                    <span className="w-12 shrink-0 font-semibold tabular-nums text-amber-300">Lap {event.lap}</span>
                    <span className="text-neutral-300">{event.text}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}

      <CompactPagination
        noun={tab === 'story' ? 'events' : tab === 'pace' ? 'drivers' : 'entries'}
        total={activeEntries.length}
        page={safePage}
        pageCount={activePageCount}
        pageSize={activePageSize}
        onPage={setPage}
      />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-0.5 truncate text-lg font-bold text-neutral-100" title={value}>{value}</div>
    </div>
  );
}

function StoryFilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`rounded px-3 py-2 text-xs font-semibold ${active ? 'bg-sky-500/20 text-sky-200' : 'text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200'}`}>{children}</button>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-500">{children}</p>;
}
