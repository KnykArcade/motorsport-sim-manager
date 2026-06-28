import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import { StatBar } from '../components/StatBar';

export function Drivers() {
  const { state } = useGame();
  if (!state) return null;

  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((t) => t.id === id)?.color ?? '#666';

  const ordered = [...state.drivers].sort((a, b) => b.ratings.overall - a.ratings.overall);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-100">Drivers</h1>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map((d) => {
          const isPlayer = d.teamId === state.selectedTeamId;
          return (
            <Panel key={d.id} className={isPlayer ? 'ring-1 ring-amber-500/60' : ''}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-1.5 rounded-sm" style={{ backgroundColor: teamColor(d.teamId) }} />
                  <span className="font-bold text-neutral-100">#{d.number} {d.name}</span>
                </div>
                <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-amber-300">
                  {d.ratings.overall.toFixed(1)}
                </span>
              </div>
              <div className="mb-2 text-xs text-neutral-500">{teamName(d.teamId)}</div>
              <div className="grid grid-cols-1 gap-1">
                <StatBar label="Qualifying" value={d.ratings.qualifying} />
                <StatBar label="Race Pace" value={d.ratings.racePace} />
                <StatBar label="Cornering" value={d.ratings.cornering} />
                <StatBar label="Overtaking" value={d.ratings.overtakingRacecraft} />
                <StatBar label="Composure" value={d.ratings.composure} />
                <StatBar label="Aggression" value={d.ratings.aggression} />
                <StatBar label="Morale" value={d.morale / 10} />
                <StatBar label="Confidence" value={d.confidence / 10} />
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
