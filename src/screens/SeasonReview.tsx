import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { StandingsTable } from '../components/StandingsTable';

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
          <div className="text-2xl font-bold text-amber-300">{constructorChamp ? teamName(constructorChamp.entityId) : '—'}</div>
          <div className="text-sm text-neutral-400">
            {constructorChamp ? `${constructorChamp.points} pts · ${constructorChamp.wins} wins` : ''}
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
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={replaySeason}>Replay Season</Button>
            <Button onClick={() => navigate('/offseason')}>Convert to Career</Button>
            <Button onClick={() => navigate('/')}>Return to Main Menu</Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
