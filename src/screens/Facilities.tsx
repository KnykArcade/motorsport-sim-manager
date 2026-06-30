import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { toMoney } from '../sim/financeEngine';
import {
  FACILITY_SPECS,
  canUpgrade,
  facilityDevelopmentSuccessBonus,
  facilityRepairCostReduction,
  facilitySetupFeedbackBonus,
  facilityYouthDevelopmentBonus,
  upgradeCostFor,
} from '../sim/facilityEngine';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { formatMoney } from '../components/ui';
import type { Facility } from '../types/facilityTypes';

const EFFECT_LABELS: Record<string, string> = {
  developmentSuccess: 'Dev success',
  developmentSpeed: 'Dev speed',
  setupFeedback: 'Setup feedback',
  repairCostReduction: 'Repair savings',
  youthDevelopment: 'Youth growth',
  pitStop: 'Pit stops',
  reliability: 'Reliability',
  scouting: 'Scouting',
};

function formatEffect(key: string, value: number): string {
  if (key === 'setupFeedback') return `+${value.toFixed(1)}`;
  if (key === 'pitStop' || key === 'reliability') return `+${value.toFixed(1)}`;
  if (key === 'scouting') return `+${Math.round(value * 100)}%`;
  return `+${Math.round(value * 100)}%`;
}

export function Facilities() {
  const { state, dispatch } = useGame();
  if (!state) return null;

  const budget = teamById(state, state.selectedTeamId)?.budget ?? 0;
  const fs = state.facilities;
  const pendingIds = new Set((fs?.pendingUpgrades ?? []).map((u) => u.facilityId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Facilities</h1>
        <p className="text-sm text-neutral-400">
          Invest in long-term infrastructure. Upgrades are paid now and come online next season.
          Budget: <span className="font-semibold text-neutral-200">{formatMoney(budget)}</span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Dev Success" value={`+${Math.round(facilityDevelopmentSuccessBonus(fs) * 100)}%`} />
        <Kpi label="Setup Feedback" value={`+${facilitySetupFeedbackBonus(fs).toFixed(1)}`} />
        <Kpi label="Repair Savings" value={`${Math.round(facilityRepairCostReduction(fs) * 100)}%`} />
        <Kpi label="Youth Growth" value={`+${Math.round(facilityYouthDevelopmentBonus(fs) * 100)}%`} />
      </div>

      {!fs ? (
        <Panel title="Facilities">
          <p className="text-sm text-neutral-400">Facilities are available in Career Mode.</p>
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {fs.facilities.map((f) => (
            <FacilityCard
              key={f.id}
              f={f}
              pending={pendingIds.has(f.id)}
              affordable={toMoney(upgradeCostFor(f)) <= budget}
              onUpgrade={() => dispatch({ type: 'UPGRADE_FACILITY', facilityId: f.id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FacilityCard({
  f,
  pending,
  affordable,
  onUpgrade,
}: {
  f: Facility;
  pending: boolean;
  affordable: boolean;
  onUpgrade: () => void;
}) {
  const spec = FACILITY_SPECS[f.type];
  const maxed = !canUpgrade(f);
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="font-bold text-neutral-100">{spec.label}</div>
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-300">
          L{f.level} / {f.maxLevel}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-neutral-500">{spec.description}</p>

      <div className="mb-2 flex h-1.5 gap-0.5">
        {Array.from({ length: f.maxLevel }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm ${i < f.level ? 'bg-amber-500' : 'bg-neutral-800'}`}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {Object.entries(f.effects).map(([key, value]) => (
          <span key={key} className="rounded bg-neutral-800/60 px-1.5 py-0.5 text-[10px] text-neutral-300">
            {EFFECT_LABELS[key] ?? key} {formatEffect(key, value)}
          </span>
        ))}
      </div>

      <div className="mt-3 border-t border-neutral-800 pt-2">
        {maxed ? (
          <div className="text-center text-xs text-neutral-500">Fully upgraded</div>
        ) : pending ? (
          <div className="text-center text-xs text-sky-300">Upgrading next season…</div>
        ) : (
          <Button
            variant="primary"
            className="w-full px-2 py-1 text-xs"
            disabled={!affordable}
            onClick={onUpgrade}
          >
            {affordable
              ? `Upgrade to L${f.level + 1} — ${formatMoney(toMoney(upgradeCostFor(f)))}`
              : `Need ${formatMoney(toMoney(upgradeCostFor(f)))}`}
          </Button>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-neutral-100">{value}</div>
    </div>
  );
}
