import { useGame } from '../../game/GameContext';
import { fogView, scoutingCost, type ScoutTarget } from '../../sim/scoutingEngine';
import type { ScoutedEntityType, VisibleRating } from '../../types/scoutingTypes';
import { Button } from '../Button';
import { formatMoney, ratingColor } from '../ui';

const SKILLS = [
  ['Cornering', 'cornering'],
  ['Braking', 'braking'],
  ['Racecraft', 'overtakingRacecraft'],
  ['Consistency', 'enduranceConsistency'],
] as const;

export function ScoutingWidget({
  target,
  entityType,
  compact = false,
}: {
  target: ScoutTarget;
  entityType: ScoutedEntityType;
  compact?: boolean;
}) {
  const { state, dispatch } = useGame();
  if (!state?.scouting) return null;

  const report = state.scouting.reports[target.id];
  const view = fogView(target, report, state.scouting.networkAccuracy, state.randomSeed, entityType);
  const cost = scoutingCost(entityType, report?.scoutingLevel ?? 0);
  const budget = state.teams.find((t) => t.id === state.selectedTeamId)?.budget ?? 0;
  const affordable = cost <= budget;
  const accuracy = Math.round(view.accuracy * 100);
  const [lo, hi] = view.potential.range;

  return (
    <div className={`rounded border border-sky-500/25 bg-sky-500/5 ${compact ? 'p-2' : 'p-3'}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-300">Scouting Report</div>
          <div className="text-xs text-neutral-400">
            Potential range <span className="font-semibold text-neutral-200">{lo.toFixed(1)}-{hi.toFixed(1)}</span>
          </div>
        </div>
        <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold tabular-nums text-sky-300">
          {accuracy}%
        </span>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded bg-neutral-800">
        <div className="h-full" style={{ width: `${accuracy}%`, backgroundColor: ratingColor(accuracy) }} />
      </div>
      {!compact && (
        <div className="mb-2 grid gap-1 text-[11px]">
          {SKILLS.map(([label, key]) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-neutral-500">{label}</span>
              <span className="font-semibold tabular-nums text-neutral-300">{ratingText(view.skills[key])}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] text-neutral-500">{report?.lastUpdated ? `Updated ${new Date(report.lastUpdated).toLocaleDateString()}` : view.notes[0]}</span>
        {view.maxed ? (
          <span className="shrink-0 text-[11px] font-semibold text-green-400">Best report</span>
        ) : (
          <Button
            variant="primary"
            className="shrink-0 px-2 py-1 text-xs"
            disabled={!affordable}
            title={affordable ? undefined : 'Insufficient budget'}
            onClick={() => dispatch({ type: 'SCOUT_TARGET', entityId: target.id, entityType })}
          >
            Scout {formatMoney(cost)}
          </Button>
        )}
      </div>
    </div>
  );
}

function ratingText(value: VisibleRating): string {
  if (value === 'Unknown') return '??';
  if (Array.isArray(value)) return `${value[0].toFixed(1)}-${value[1].toFixed(1)}`;
  return value.toFixed(1);
}
