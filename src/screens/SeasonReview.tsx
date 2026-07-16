import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { StandingsTable } from '../components/StandingsTable';
import { CompactPagination } from '../components/CompactPagination';
import { isSingleSeasonMode } from '../game/modeRestrictions';
import { ARCHETYPE_SPECS, TRAIT_LABELS } from '../sim/aiTeamEngine';
import {
  RESULT_PAGE_SIZE,
  SEASON_REVIEW_TABS,
  transitionPage,
  transitionPageCount,
  type SeasonReviewTab,
} from './raceTransitionViewModel';

export function SeasonReview() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [tab, setTab] = useState<SeasonReviewTab>('honours');
  const [page, setPage] = useState(0);
  if (!state) return null;

  const driverName = (id: string) => state.drivers.find((driver) => driver.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((team) => team.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((team) => team.id === id)?.color;
  const teamOfDriver = (id: string) => teamName(state.drivers.find((driver) => driver.id === id)?.teamId ?? '');
  const champion = state.driverStandings[0];
  const constructorChampion = state.constructorStandings[0];
  const playerStanding = state.constructorStandings.find((entry) => entry.entityId === state.selectedTeamId);
  const playerTeamPosition = state.constructorStandings.findIndex((entry) => entry.entityId === state.selectedTeamId) + 1;
  const aiTeamStates = state.aiTeamStates;
  const activeStandings = tab === 'drivers'
    ? state.driverStandings
    : tab === 'constructors'
      ? state.constructorStandings
      : [];
  const pageCount = transitionPageCount(activeStandings.length, RESULT_PAGE_SIZE);
  const safePage = Math.min(page, pageCount - 1);

  const replaySeason = () => {
    dispatch({
      type: 'NEW_GAME',
      options: {
        gameMode: state.gameMode,
        seasonYear: state.seasonYear,
        series: state.series,
        teamId: state.selectedTeamId,
      },
    });
    navigate('/hq');
  };

  function selectTab(nextTab: SeasonReviewTab) {
    setTab(nextTab);
    setPage(0);
  }

  return (
    <div className="era-feature-screen era-season-review-screen space-y-3">
      <div className="text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-500">Season Complete</div>
        <h1 className="mt-1 text-3xl font-black text-neutral-50">{state.seasonYear} {state.series} — Final Review</h1>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Kpi label="World Champion" value={champion ? driverName(champion.entityId) : '—'} />
        <Kpi label="Constructors’ Champion" value={constructorChampion ? teamName(constructorChampion.entityId) : '—'} />
        <Kpi label="Your Team" value={playerTeamPosition > 0 ? `P${playerTeamPosition} · ${playerStanding?.points ?? 0} pts` : '—'} />
      </div>

      <nav className="grid grid-cols-4 gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-1" aria-label="Season review sections">
        {SEASON_REVIEW_TABS.map((item) => (
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

      {tab === 'honours' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="World Champion">
            <div className="text-2xl font-bold text-amber-300">{champion ? driverName(champion.entityId) : '—'}</div>
            <div className="text-sm text-neutral-400">{champion ? `${champion.points} pts · ${champion.wins} wins · ${champion.podiums} podiums` : ''}</div>
          </Panel>
          <Panel title="Constructors’ Champion">
            <div className="text-2xl font-bold text-amber-300">{constructorChampion ? teamName(constructorChampion.entityId) : '—'}</div>
            <div className="text-sm text-neutral-400">{constructorChampion ? `${constructorChampion.points} pts · ${constructorChampion.wins} wins` : ''}</div>
            <ChampionIdentity teamId={constructorChampion?.entityId} />
          </Panel>
          <div className="lg:col-span-2">
            <Panel title="Your Team’s Season">
              <p className="text-sm text-neutral-300">
                {teamName(state.selectedTeamId)} finished <span className="font-semibold text-neutral-100">P{playerTeamPosition}</span> in the Constructors’ Championship with {playerStanding?.points ?? 0} points.
              </p>
            </Panel>
          </div>
        </div>
      )}

      {tab === 'drivers' && (
        <StandingsTable
          title="Final Drivers’ Standings"
          entries={transitionPage(state.driverStandings, safePage)}
          nameOf={driverName}
          subtitleOf={teamOfDriver}
          positionOffset={safePage * RESULT_PAGE_SIZE}
        />
      )}

      {tab === 'constructors' && (
        <StandingsTable
          title="Final Constructors’ Standings"
          entries={transitionPage(state.constructorStandings, safePage)}
          nameOf={teamName}
          colorOf={teamColor}
          highlightId={state.selectedTeamId}
          positionOffset={safePage * RESULT_PAGE_SIZE}
        />
      )}

      {tab === 'next' && (
        <Panel title="What’s Next?">
          {state.gameMode === 'Career' ? (
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={() => navigate('/offseason')}>Enter Offseason →</Button>
              <Button onClick={() => navigate('/')}>Main Menu</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {isSingleSeasonMode(state.gameMode) && (
                <div className="rounded-lg border border-amber-800/40 bg-amber-900/10 p-3 text-sm text-amber-300">
                  Single Season Mode covers one historical year only. Offseason, multi-year development, and season advance are not available. Replay the season or convert the save to Career Mode to continue.
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" onClick={replaySeason}>Replay Season</Button>
                <Button onClick={() => navigate('/offseason')}>Convert to Career</Button>
                <Button onClick={() => navigate('/')}>Return to Main Menu</Button>
              </div>
            </div>
          )}
        </Panel>
      )}

      {activeStandings.length > 0 && (
        <CompactPagination
          noun="standings entries"
          total={activeStandings.length}
          page={safePage}
          pageCount={pageCount}
          pageSize={RESULT_PAGE_SIZE}
          onPage={setPage}
        />
      )}
    </div>
  );

  function ChampionIdentity({ teamId }: { teamId?: string }) {
    const ai = teamId ? aiTeamStates?.[teamId] : undefined;
    if (!ai) return null;
    const spec = ARCHETYPE_SPECS[ai.archetype];
    return (
      <div className="mt-3 rounded-md border border-neutral-800 bg-neutral-900/40 p-2">
        {spec && <div className="text-xs text-neutral-400"><span className="font-semibold text-neutral-300">{spec.label}</span> — {spec.description}</div>}
        {ai.philosophy && <div className="mt-2 flex flex-wrap gap-1">{ai.philosophy.traits.map((trait) => <span key={trait} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">{TRAIT_LABELS[trait]}</span>)}</div>}
      </div>
    );
  }
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3"><div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-0.5 truncate text-lg font-bold text-neutral-100" title={value}>{value}</div></div>;
}
