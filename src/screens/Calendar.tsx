import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { getTrackById, getRegulationSet } from '../data';
import { Panel } from '../components/Panel';
import { RatingBadge } from '../components/RatingBadge';
import { CompactPagination } from '../components/CompactPagination';
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

  function selectTab(nextTab: CalendarTab) {
    setTab(nextTab);
    setPage(0);
  }

  return (
    <div className="era-feature-screen era-calendar-screen space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">{state.seasonYear} Calendar</h1>
          <p className="text-sm text-neutral-400">Season schedule, circuit demands, and completed winners.</p>
        </div>
        {regSet && <span className="rounded-md bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-300">{regSet.eraLabel}</span>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Rounds" value={String(state.calendar.length)} />
        <Kpi label="Completed" value={String(completedCount)} />
        <Kpi label="Remaining" value={String(remainingCount)} />
      </div>

      <nav className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-1" aria-label="Calendar sections">
        <CalendarTabButton active={tab === 'schedule'} onClick={() => selectTab('schedule')}>Remaining Schedule ({remainingCount})</CalendarTabButton>
        <CalendarTabButton active={tab === 'results'} onClick={() => selectTab('results')}>Completed Results ({completedCount})</CalendarTabButton>
      </nav>

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
    </div>
  );
}

function CalendarTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`rounded px-3 py-2 text-xs font-semibold ${active ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'}`}>{children}</button>;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3"><div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div><div className="text-lg font-bold text-neutral-100">{value}</div></div>;
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'next' | 'done' }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${tone === 'next' ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300'}`}>{children}</span>;
}
