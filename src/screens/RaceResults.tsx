import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { getTrackById } from '../data';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { RaceResultTable } from '../components/RaceResultTable';
import { NewsFeed } from '../components/NewsFeed';
import { StandingsTable } from '../components/StandingsTable';
import { CompactPagination } from '../components/CompactPagination';
import {
  EVENT_PAGE_SIZE,
  RACE_RESULTS_TABS,
  RESULT_PAGE_SIZE,
  transitionPage,
  transitionPageCount,
  type RaceResultsTab,
} from './raceTransitionViewModel';

export function RaceResults() {
  const { raceId } = useParams();
  const { state } = useGame();
  const navigate = useNavigate();
  const [tab, setTab] = useState<RaceResultsTab>('summary');
  const [page, setPage] = useState(0);
  const [championship, setChampionship] = useState<'drivers' | 'constructors'>('drivers');
  if (!state || !raceId) return null;

  const race = state.calendar.find((entry) => entry.id === raceId);
  const results = [...(state.completedRaceResults[raceId] ?? [])]
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const events = state.raceEvents[raceId] ?? [];
  const track = race ? getTrackById(race.trackId) : undefined;
  if (!race || results.length === 0) return null;

  const driverName = (id: string) => state.drivers.find((driver) => driver.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((team) => team.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((team) => team.id === id)?.color;
  const teamOfDriver = (id: string) => teamName(state.drivers.find((driver) => driver.id === id)?.teamId ?? '');
  const playerResults = results.filter((result) => result.teamId === state.selectedTeamId);
  const winner = results[0];
  const activeStandings = championship === 'drivers' ? state.driverStandings : state.constructorStandings;
  const activeEntries = tab === 'classification'
    ? results
    : tab === 'story'
      ? events
      : tab === 'championships'
        ? activeStandings
        : [];
  const pageSize = tab === 'story' ? EVENT_PAGE_SIZE : RESULT_PAGE_SIZE;
  const pageCount = transitionPageCount(activeEntries.length, pageSize);
  const safePage = Math.min(page, pageCount - 1);
  const trackImpact = track
    ? `${race.trackName} rewarded ${topDemand(track)}. ${track.setupProfile.strategyNotes}`
    : '';

  function selectTab(nextTab: RaceResultsTab) {
    setTab(nextTab);
    setPage(0);
  }

  return (
    <div className="era-feature-screen era-race-results-screen space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">{race.gpName} — Result</h1>
          <p className="text-sm text-neutral-400">{race.trackName} · Round {race.round}</p>
        </div>
        {state.seasonComplete ? (
          <Button variant="primary" onClick={() => navigate('/season-review')}>Season Review →</Button>
        ) : (
          <Button variant="primary" onClick={() => navigate('/hq')}>Back to HQ →</Button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Kpi label="Winner" value={winner ? driverName(winner.driverId) : '—'} />
        <Kpi label="Winning Team" value={winner ? teamName(winner.teamId) : '—'} />
        <Kpi
          label="Your Best Finish"
          value={playerResults[0]?.position ? `P${playerResults[0].position} · ${driverName(playerResults[0].driverId)}` : 'No classified finish'}
        />
      </div>

      <nav className="grid grid-cols-4 gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-1" aria-label="Race result sections">
        {RACE_RESULTS_TABS.map((item) => (
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

      {tab === 'summary' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Your Team">
            {playerResults.length === 0 ? <Empty>No team result was recorded.</Empty> : (
              <div className="grid gap-2 sm:grid-cols-2">
                {playerResults.map((result) => (
                  <div key={result.driverId} className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
                    <div className="text-sm font-semibold text-neutral-100">{driverName(result.driverId)}</div>
                    <div className="mt-1 text-xl font-bold text-amber-300">
                      {result.position ? `P${result.position}` : result.status}
                    </div>
                    <div className="text-xs text-neutral-500">Started P{result.gridPosition} · {result.points} pts</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Track Impact"><p className="text-sm text-neutral-300">{trackImpact}</p></Panel>
          <div className="lg:col-span-2">
            <Panel title="Headlines">
              <NewsFeed items={state.news.filter((item) => item.round === race.round)} />
            </Panel>
          </div>
        </div>
      )}

      {tab === 'classification' && (
        <Panel title="Race Classification">
          <RaceResultTable
            results={transitionPage(results, safePage)}
            nameOf={driverName}
            teamNameOf={teamName}
            colorOf={teamColor}
            highlightTeamId={state.selectedTeamId}
          />
        </Panel>
      )}

      {tab === 'story' && (
        <Panel title="Race Event Log">
          {events.length === 0 ? <Empty>Quiet race — no major incidents.</Empty> : (
            <div className="grid gap-2 md:grid-cols-2">
              {transitionPage(events, safePage, EVENT_PAGE_SIZE).map((event, index) => (
                <div key={`${event.lap}-${index}-${event.text}`} className="flex gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm">
                  <span className="w-12 shrink-0 font-semibold tabular-nums text-amber-300">Lap {event.lap}</span>
                  <span className="text-neutral-300">{event.text}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === 'championships' && (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-1">
            <SubTab active={championship === 'drivers'} onClick={() => { setChampionship('drivers'); setPage(0); }}>Drivers</SubTab>
            <SubTab active={championship === 'constructors'} onClick={() => { setChampionship('constructors'); setPage(0); }}>Constructors</SubTab>
          </div>
          <StandingsTable
            title={championship === 'drivers' ? "Drivers' Championship" : "Constructors' Championship"}
            entries={transitionPage(activeStandings, safePage)}
            nameOf={championship === 'drivers' ? driverName : teamName}
            subtitleOf={championship === 'drivers' ? teamOfDriver : undefined}
            colorOf={championship === 'constructors' ? teamColor : undefined}
            highlightId={championship === 'constructors' ? state.selectedTeamId : undefined}
            positionOffset={safePage * RESULT_PAGE_SIZE}
          />
        </>
      )}

      {activeEntries.length > 0 && (
        <CompactPagination
          noun={tab === 'story' ? 'events' : tab === 'classification' ? 'finishers' : 'standings entries'}
          total={activeEntries.length}
          page={safePage}
          pageCount={pageCount}
          pageSize={pageSize}
          onPage={setPage}
        />
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3"><div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-0.5 truncate text-lg font-bold text-neutral-100" title={value}>{value}</div></div>;
}

function SubTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`rounded px-3 py-2 text-xs font-semibold ${active ? 'bg-sky-500/20 text-sky-200' : 'text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200'}`}>{children}</button>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-500">{children}</p>;
}

function topDemand(track: ReturnType<typeof getTrackById>): string {
  if (!track) return 'a balanced approach';
  const demands: [string, number][] = [
    ['engine power', track.setupProfile.powerDemand],
    ['aero efficiency', track.setupProfile.aeroDemand],
    ['mechanical grip', track.setupProfile.mechanicalDemand],
  ];
  demands.sort((a, b) => b[1] - a[1]);
  return `${demands[0][0]} and ${demands[1][0]}`;
}
