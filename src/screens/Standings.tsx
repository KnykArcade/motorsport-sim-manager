import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { StandingsTable } from '../components/StandingsTable';
import { CompactPagination } from '../components/CompactPagination';
import {
  STANDINGS_PAGE_SIZE,
  pageCount,
  standingsPage,
  type StandingsTab,
} from './seasonOverviewViewModel';

export function Standings() {
  const { state } = useGame();
  const [tab, setTab] = useState<StandingsTab>('drivers');
  const [page, setPage] = useState(0);
  if (!state) return null;

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

  function selectTab(nextTab: StandingsTab) {
    setTab(nextTab);
    setPage(0);
  }

  return (
    <div className="era-feature-screen era-standings-screen space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Championship Standings</h1>
          <p className="text-sm text-neutral-400">Drivers and constructors after round {Math.min(state.currentRaceIndex, state.calendar.length)}.</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">Championship leader</div>
          <div className="text-lg font-bold text-neutral-100">{leader ? (tab === 'drivers' ? driverName(leader.entityId) : teamName(leader.entityId)) : 'No results'}</div>
          <div className="text-xs text-amber-300">{leader?.points ?? 0} points</div>
        </div>
      </div>

      <nav className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-1" aria-label="Championship sections">
        <StandingsTabButton active={tab === 'drivers'} onClick={() => selectTab('drivers')}>Drivers ({state.driverStandings.length})</StandingsTabButton>
        <StandingsTabButton active={tab === 'constructors'} onClick={() => selectTab('constructors')}>Constructors ({state.constructorStandings.length})</StandingsTabButton>
      </nav>

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
    </div>
  );
}

function StandingsTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`rounded px-3 py-2 text-xs font-semibold ${active ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'}`}>{children}</button>;
}
