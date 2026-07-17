import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { getTrackById, getRegulationSet } from '../data';
import { Panel } from '../components/Panel';
import { RatingBadge } from '../components/RatingBadge';
import { CompactPagination } from '../components/CompactPagination';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  CALENDAR_PAGE_SIZE,
  calendarEntriesForTab,
  compactPage,
  pageCount,
  type CalendarTab,
} from './seasonOverviewViewModel';

export function Calendar() {
  const { state } = useGame();
  const [tab, setTab] = useState<CalendarTab>('schedule');
  const [page, setPage] = useState(0);
  if (!state) return null;

  const driverName = (id: string) => state.drivers.find((driver) => driver.id === id)?.name ?? id;
  const regSet = getRegulationSet(state.regulationSetId);
  const entries = calendarEntriesForTab(state.calendar, tab);
  const tabPageCount = pageCount(entries.length, CALENDAR_PAGE_SIZE);
  const safePage = Math.min(page, tabPageCount - 1);
  const visibleEntries = compactPage(entries, safePage, CALENDAR_PAGE_SIZE);
  const completedCount = state.calendar.filter((race) => race.completed).length;
  const remainingCount = state.calendar.length - completedCount;
  const nextRace = state.calendar.find((race) => !race.completed);

  function selectTab(nextTab: CalendarTab) {
    setTab(nextTab);
    setPage(0);
  }

  return (
    <WorkspaceScreen className="era-feature-screen era-calendar-screen">
      <WorkspaceHeader
        eyebrow="Competition center"
        title={`${state.seasonYear} Calendar`}
        subtitle="Season schedule, circuit demands, and completed winners."
        actions={regSet ? <span className="rounded-md bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-300">{regSet.eraLabel}</span> : undefined}
      />

      <MetricStrip>
        <WorkspaceMetric label="Rounds" value={state.calendar.length} detail={`${state.series} season`} />
        <WorkspaceMetric label="Completed" value={completedCount} detail={`${Math.round((completedCount / Math.max(1, state.calendar.length)) * 100)}% complete`} />
        <WorkspaceMetric label="Remaining" value={remainingCount} detail={state.seasonComplete ? 'Season complete' : 'Still to run'} />
        <WorkspaceMetric label="Next event" value={nextRace?.gpName ?? 'Season complete'} detail={nextRace ? `Round ${nextRace.round} · ${nextRace.trackName}` : undefined} />
      </MetricStrip>

      <WorkspaceTabs
        items={[
          { id: 'schedule' as const, label: `Remaining Schedule (${remainingCount})` },
          { id: 'results' as const, label: `Completed Results (${completedCount})` },
        ]}
        active={tab}
        onChange={selectTab}
        ariaLabel="Calendar sections"
      />

      <WorkspaceBody>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleEntries.map((race) => {
          const track = getTrackById(race.trackId);
          const isCurrent = race.round === state.currentRaceIndex + 1 && !state.seasonComplete;
          const results = state.completedRaceResults[race.id];
          const winner = results?.find((result) => result.position === 1);
          return (
            <Panel key={race.id} className={isCurrent ? 'ring-1 ring-amber-500' : ''}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-500">R{race.round}</span>
                    {isCurrent && <Badge tone="next">NEXT</Badge>}
                    {race.completed && <Badge tone="done">DONE</Badge>}
                  </div>
                  <div className="mt-1 font-bold text-neutral-100">{race.gpName}</div>
                  <div className="text-xs text-neutral-400">{race.trackName}</div>
                </div>
                {track && <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-300">{track.archetype}</span>}
              </div>
              <div className="mt-2 text-xs text-neutral-500">{race.laps} laps · {race.distanceKm ?? '—'} km</div>
              {track && <>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <RatingBadge label="Aero" value={track.setupProfile.aeroDemand} />
                  <RatingBadge label="Pwr" value={track.setupProfile.powerDemand} />
                  <RatingBadge label="Mech" value={track.setupProfile.mechanicalDemand} />
                  <RatingBadge label="Risk" value={track.setupProfile.riskDemand} />
                </div>
                <div className="mt-2 truncate text-xs text-neutral-500"><span className="text-neutral-400">Setup:</span> {track.setupProfile.primarySetupProfile}</div>
              </>}
              {winner && <div className="mt-2 text-xs font-semibold text-amber-300">Winner · {driverName(winner.driverId)}</div>}
            </Panel>
          );
        })}
      </div>
      {visibleEntries.length === 0 && <Panel><p className="text-sm text-neutral-500">No races are listed in this section.</p></Panel>}
      <CompactPagination noun="races" total={entries.length} page={safePage} pageCount={tabPageCount} pageSize={CALENDAR_PAGE_SIZE} onPage={setPage} />
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'next' | 'done' }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${tone === 'next' ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300'}`}>{children}</span>;
}
