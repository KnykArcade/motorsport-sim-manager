import { useGame } from '../game/GameContext';
import { StandingsTable } from '../components/StandingsTable';

export function Standings() {
  const { state } = useGame();
  if (!state) return null;

  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((t) => t.id === id)?.color;
  const teamOfDriver = (id: string) => teamName(state.drivers.find((d) => d.id === id)?.teamId ?? '');
  const playerDriverIds = state.drivers.filter((d) => d.teamId === state.selectedTeamId).map((d) => d.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-100">Championship Standings</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <StandingsTable
          title="Drivers' Championship"
          entries={state.driverStandings}
          nameOf={driverName}
          subtitleOf={teamOfDriver}
          highlightId={playerDriverIds[0]}
        />
        <StandingsTable
          title="Constructors' Championship"
          entries={state.constructorStandings}
          nameOf={teamName}
          colorOf={teamColor}
          highlightId={state.selectedTeamId}
        />
      </div>
    </div>
  );
}
