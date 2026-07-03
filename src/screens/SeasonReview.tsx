import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { StandingsTable } from '../components/StandingsTable';
import { isSingleSeasonMode } from '../game/modeRestrictions';
import { ARCHETYPE_SPECS, TRAIT_LABELS } from '../sim/aiTeamEngine';

export function SeasonReview() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  if (!state) return null;

  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((t) => t.id === id)?.color;
  const teamOfDriver = (id: string) => teamName(state.drivers.find((d) => d.id === id)?.teamId ?? '');

  const champion = state.driverStandings[0];
  const constructorChamp = state.constructorStandings[0];
  const playerTeamPos = state.constructorStandings.findIndex((e) => e.entityId === state.selectedTeamId) + 1;

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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-500">Season Complete</div>
        <h1 className="mt-1 text-3xl font-black text-neutral-50">{state.seasonYear} {state.series} — Final Review</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="World Champion">
          <div className="text-2xl font-bold text-amber-300">{champion ? driverName(champion.entityId) : '—'}</div>
          <div className="text-sm text-neutral-400">
            {champion ? `${champion.points} pts · ${champion.wins} wins · ${champion.podiums} podiums` : ''}
          </div>
        </Panel>
        <Panel title="Constructors' Champion">
          <div className="space-y-2">
            <div className="text-2xl font-bold text-amber-300">{constructorChamp ? teamName(constructorChamp.entityId) : '—'}</div>
            <div className="text-sm text-neutral-400">
              {constructorChamp ? `${constructorChamp.points} pts · ${constructorChamp.wins} wins` : ''}
            </div>
            {(() => {
              const ai = state.aiTeamStates?.[constructorChamp?.entityId ?? ''];
              if (!ai) return null;
              const spec = ARCHETYPE_SPECS[ai.archetype];
              return (
                <div className="mt-2 rounded-md border border-neutral-800 bg-neutral-900/40 p-2 space-y-1">
                  {spec && (
                    <div className="text-xs text-neutral-400">
                      <span className="font-semibold text-neutral-300">{spec.label}</span> — {spec.description}
                    </div>
                  )}
                  {ai.philosophy && (
                    <div className="flex flex-wrap gap-1">
                      {ai.philosophy.traits.map((t) => (
                        <span key={t} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
                          {TRAIT_LABELS[t]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </Panel>
      </div>

      <Panel title="Your Team's Season">
        <p className="text-sm text-neutral-300">
          {teamName(state.selectedTeamId)} finished <span className="font-semibold text-neutral-100">P{playerTeamPos}</span> in the
          Constructors' Championship with {state.constructorStandings.find((e) => e.entityId === state.selectedTeamId)?.points ?? 0} points.
        </p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <StandingsTable title="Final Drivers' Standings" entries={state.driverStandings} nameOf={driverName} subtitleOf={teamOfDriver} />
        <StandingsTable title="Final Constructors' Standings" entries={state.constructorStandings} nameOf={teamName} colorOf={teamColor} highlightId={state.selectedTeamId} />
      </div>

      <Panel title="What's Next?">
        {state.gameMode === 'Career' ? (
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => navigate('/offseason')}>Enter Offseason →</Button>
            <Button onClick={() => navigate('/')}>Main Menu</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {isSingleSeasonMode(state.gameMode) && (
              <div className="rounded-lg border border-amber-800/40 bg-amber-900/10 p-3 text-sm text-amber-300">
                Single Season Mode covers one historical year only. Offseason, multi-year development, and season advance are not available.
                You can replay this season with the same or a different team, or convert to Career Mode to continue into future years.
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
    </div>
  );
}
