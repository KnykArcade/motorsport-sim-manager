import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { developmentProjectCatalog } from '../data/development/developmentProjects';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { formatMoney } from '../components/ui';
import type { DevelopmentProject } from '../types/gameTypes';

export function Development() {
  const { state, dispatch } = useGame();
  if (!state) return null;
  const team = teamById(state, state.selectedTeamId);
  const budget = team?.budget ?? 0;

  const effectSummary = (p: DevelopmentProject) => {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(p.currentSeasonEffects ?? {})) parts.push(`+${v} ${k}`);
    for (const [k, v] of Object.entries(p.nextSeasonEffects ?? {})) parts.push(`+${v} ${k} (next yr)`);
    return parts.join(', ') || 'Infrastructure / research';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-100">Development</h1>
        <div className="text-sm text-neutral-400">
          Budget: <span className="font-semibold text-neutral-100">{formatMoney(budget)}</span>
        </div>
      </div>

      <Panel title="Active Projects">
        {state.activeDevelopmentProjects.length === 0 ? (
          <p className="text-sm text-neutral-500">No active projects. Start one below.</p>
        ) : (
          <div className="space-y-2">
            {state.activeDevelopmentProjects.map((p) => (
              <div key={p.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-100">{p.name}</span>
                  <span className="text-xs text-neutral-500">
                    {p.progressRaces}/{p.durationRaces} races
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${(p.progressRaces / p.durationRaces) * 100}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-neutral-500">{effectSummary(p)}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Available Projects">
        <div className="grid gap-3 md:grid-cols-2">
          {developmentProjectCatalog.map((p) => {
            const affordable = budget >= p.cost;
            return (
              <div key={p.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-neutral-100">{p.name}</div>
                    <div className="mt-0.5 flex gap-1.5">
                      <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">{p.category}</span>
                      <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">{p.horizon}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-neutral-100">{formatMoney(p.cost)}</span>
                </div>
                <div className="mt-2 text-xs text-neutral-400">{effectSummary(p)}</div>
                <div className="mt-1 text-xs text-neutral-500">
                  {p.durationRaces} races · {Math.round(p.successChance * 100)}% success · {Math.round(p.carryoverRate * 100)}% carryover
                </div>
                {p.risk && <div className="mt-1 text-xs text-orange-400/80">⚠ {p.risk}</div>}
                <Button
                  className="mt-3 w-full"
                  variant={affordable ? 'primary' : 'secondary'}
                  disabled={!affordable}
                  onClick={() => dispatch({ type: 'START_DEVELOPMENT', projectId: p.id })}
                >
                  {affordable ? 'Start Project' : 'Insufficient Budget'}
                </Button>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
