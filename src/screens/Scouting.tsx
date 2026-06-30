import { useMemo, useState } from 'react';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { getMarketBundle } from '../data';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { fogView, scoutingCost, type FogView, type ScoutTarget } from '../sim/scoutingEngine';
import { formatMoney } from '../components/ui';
import type { ScoutedEntityType, VisibleRating } from '../types/scoutingTypes';

type Tab = 'senior' | 'youth';

const SKILL_LABELS: { key: string; label: string }[] = [
  { key: 'cornering', label: 'Cornering' },
  { key: 'braking', label: 'Braking' },
  { key: 'overtakingRacecraft', label: 'Overtaking' },
  { key: 'enduranceConsistency', label: 'Consistency' },
];

export function Scouting() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<Tab>('senior');

  const bundle = useMemo(
    () => (state ? getMarketBundle(state.seasonYear, state.series) : undefined),
    [state],
  );

  if (!state) return null;

  const scouting = state.scouting;
  if (!scouting) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-neutral-100">Scouting</h1>
        <Panel title="Scouting">
          <p className="text-sm text-neutral-400">Scouting is available in Career Mode.</p>
        </Panel>
      </div>
    );
  }

  const networkPct = Math.round(scouting.networkAccuracy * 100);
  const budget = teamById(state, state.selectedTeamId)?.budget ?? 0;

  const view = (target: ScoutTarget): FogView =>
    fogView(target, scouting.reports[target.id], scouting.networkAccuracy, state.randomSeed);

  const costOf = (entityId: string, entityType: ScoutedEntityType): number =>
    scoutingCost(entityType, scouting.reports[entityId]?.scoutingLevel ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Scouting</h1>
          <p className="text-sm text-neutral-400">
            A driver's true ceiling is hidden by fog. Assign scouts to a target to sharpen the
            estimate — a stronger Scouting Network reveals more, faster.
          </p>
        </div>
        <div className="flex gap-2">
          <TabButton active={tab === 'senior'} onClick={() => setTab('senior')}>
            Senior{bundle ? ` (${bundle.drivers.length})` : ''}
          </TabButton>
          <TabButton active={tab === 'youth'} onClick={() => setTab('youth')}>
            Youth{bundle ? ` (${bundle.youth.length})` : ''}
          </TabButton>
        </div>
      </div>

      <Panel title="Scouting Network">
        <div className="flex items-center gap-3">
          <div className="text-sm text-neutral-400">Network accuracy</div>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full bg-sky-500" style={{ width: `${networkPct}%` }} />
          </div>
          <span className="text-sm font-semibold tabular-nums text-neutral-200">{networkPct}%</span>
          <span className="text-xs text-neutral-500">
            Upgrade the Scouting Network facility to raise the baseline.
          </span>
          <span className="ml-auto text-xs text-neutral-400">
            Budget: <span className="font-semibold text-neutral-200">{formatMoney(budget)}</span>
          </span>
        </div>
      </Panel>

      {!bundle && (
        <Panel>
          <p className="text-sm text-neutral-400">
            No market data is available for the {state.seasonYear} {state.series} season.
          </p>
        </Panel>
      )}

      {bundle && tab === 'senior' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...bundle.drivers]
            .sort((a, b) => b.overall - a.overall)
            .map((d) => (
              <ScoutCard
                key={d.id}
                title={d.name}
                subtitle={`${d.nationality} · ${d.age} · ${d.context}`}
                overall={d.overall}
                view={view({ id: d.id, skills: d.skills, potential: d.potential })}
                cost={costOf(d.id, 'Driver')}
                budget={budget}
                onScout={() => dispatch({ type: 'SCOUT_TARGET', entityId: d.id, entityType: 'Driver' as ScoutedEntityType })}
              />
            ))}
        </div>
      )}

      {bundle && tab === 'youth' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...bundle.youth]
            .sort((a, b) => b.potential - a.potential)
            .map((y) => (
              <ScoutCard
                key={y.id}
                title={y.name}
                subtitle={`${y.nationality} · age ${y.age} · ${y.currentLevel}`}
                overall={y.overall}
                view={view({ id: y.id, skills: y.skills, potential: y.potential })}
                cost={costOf(y.id, 'YouthProspect')}
                budget={budget}
                onScout={() => dispatch({ type: 'SCOUT_TARGET', entityId: y.id, entityType: 'YouthProspect' as ScoutedEntityType })}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function potentialText(view: FogView): string {
  if (view.potential.revealed) return view.potential.value!.toFixed(1);
  const [lo, hi] = view.potential.range;
  return `${lo.toFixed(1)}–${hi.toFixed(1)}`;
}

function ScoutCard({
  title,
  subtitle,
  overall,
  view,
  cost,
  budget,
  onScout,
}: {
  title: string;
  subtitle: string;
  overall: number;
  view: FogView;
  cost: number;
  budget: number;
  onScout: () => void;
}) {
  const accPct = Math.round(view.accuracy * 100);
  const affordable = cost <= budget;
  return (
    <Panel>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-neutral-100">{title}</div>
          <div className="text-xs text-neutral-500">{subtitle}</div>
        </div>
        <div className="text-right">
          <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-amber-300">
            {overall.toFixed(1)}
          </span>
          <div className="mt-0.5 text-[10px] text-neutral-500">
            POT <span className="text-sky-300">{potentialText(view)}</span>
          </div>
        </div>
      </div>

      <div className="mb-2">
        <div className="mb-0.5 flex items-center justify-between text-[11px]">
          <span className="text-neutral-500">Scouting accuracy</span>
          <span className="tabular-nums text-neutral-400">{accPct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            className={`h-full ${view.revealed ? 'bg-green-500' : 'bg-sky-500'}`}
            style={{ width: `${accPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1">
        {SKILL_LABELS.map((s) => (
          <SkillRow key={s.key} label={s.label} value={view.skills[s.key]} />
        ))}
      </div>

      <p className="mt-2 text-[11px] italic text-neutral-500">{view.notes[0]}</p>

      <div className="mt-3 border-t border-neutral-800 pt-2">
        {view.revealed ? (
          <span className="text-xs text-green-400">Fully scouted.</span>
        ) : (
          <>
            <Button
              variant="primary"
              className="w-full px-2 py-1 text-xs"
              disabled={!affordable}
              onClick={onScout}
            >
              Scout this target — {formatMoney(cost)}
            </Button>
            {!affordable && (
              <p className="mt-1 text-center text-[11px] text-red-400">Insufficient budget</p>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

function SkillRow({ label, value }: { label: string; value: VisibleRating }) {
  const known = value !== 'Unknown';
  const pct = known ? (value / 10) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-neutral-400">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
        {known && <div className="h-full bg-neutral-500" style={{ width: `${pct}%` }} />}
      </div>
      <span className={`w-10 text-right tabular-nums ${known ? 'text-neutral-200' : 'text-neutral-600'}`}>
        {known ? value.toFixed(1) : '??'}
      </span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm ${
        active
          ? 'bg-amber-500 font-semibold text-neutral-950'
          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
      }`}
    >
      {children}
    </button>
  );
}
