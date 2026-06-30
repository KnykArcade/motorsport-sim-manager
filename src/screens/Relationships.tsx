import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import { TEAM_ORDER_SPECS } from '../sim/relationshipEngine';
import type { TeamOrder } from '../types/relationshipTypes';

const ORDER_LABEL: Record<TeamOrder, string> = Object.fromEntries(
  TEAM_ORDER_SPECS.map((s) => [s.order, s.label]),
) as Record<TeamOrder, string>;

export function Relationships() {
  const { state } = useGame();
  if (!state) return null;

  const rels = state.driverRelationships;
  if (!rels) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-neutral-100">Relationships</h1>
        <Panel title="Relationships">
          <p className="text-sm text-neutral-400">Driver relationships are available in Career Mode.</p>
        </Panel>
      </div>
    );
  }

  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;
  const playerDrivers = state.drivers.filter((d) => d.teamId === state.selectedTeamId);
  const orders = (state.teamOrderHistory ?? []).slice().reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Driver Relationships</h1>
        <p className="text-sm text-neutral-400">
          The human side of your garage. Team orders during a race move morale, loyalty and the
          teammate relationship — and a number-one driver asked to yield will not forget it.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {playerDrivers.map((d) => {
          const rel = rels[d.id];
          if (!rel) return null;
          return (
            <Panel key={d.id} title={driverName(d.id)}>
              <div className="mb-2 flex items-center gap-2">
                {d.contractType === 'third' && (
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
                    Reserve
                  </span>
                )}
                {rel.numberOneExpectation && (
                  <span className="rounded bg-amber-950/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
                    Expects #1 status
                  </span>
                )}
                {rel.teammateId && (
                  <span className="text-[11px] text-neutral-500">
                    Teammate: {driverName(rel.teammateId)}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <Bar label="Morale" value={rel.morale} good />
                <Bar label="Team Loyalty" value={rel.teamLoyalty} good />
                <Bar label="Engineer Chemistry" value={rel.engineerChemistry} good />
                <Bar label="Teammate Relationship" value={rel.teammateRelationship} good />
                <Bar label="Frustration" value={rel.frustration} good={false} />
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel title="Team-Order Log (this season)">
        {orders.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No team orders issued yet. Call them from the Live Race pit wall.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 text-neutral-300">
                <span className="rounded bg-neutral-800/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
                  Lap {o.lap}
                </span>
                <span className="font-medium text-neutral-100">{ORDER_LABEL[o.order] ?? o.order}</span>
                {o.favoredDriverId && (
                  <span className="text-xs text-neutral-500">
                    favouring {driverName(o.favoredDriverId)}
                    {o.disadvantagedDriverId ? ` over ${driverName(o.disadvantagedDriverId)}` : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Bar({ label, value, good }: { label: string; value: number; good: boolean }) {
  // For "good" metrics high is green; for frustration high is red.
  const tone = good
    ? value >= 66
      ? 'bg-green-500'
      : value >= 33
        ? 'bg-amber-400'
        : 'bg-red-500'
    : value >= 66
      ? 'bg-red-500'
      : value >= 33
        ? 'bg-amber-400'
        : 'bg-green-500';
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-xs">
        <span className="text-neutral-400">{label}</span>
        <span className="tabular-nums font-medium text-neutral-200">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
        <div className={`h-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
