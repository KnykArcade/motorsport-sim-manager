import type { RegulationSet } from '../types/gameTypes';
import { Panel } from './Panel';

type RegulationPanelProps = {
  regulationSet: RegulationSet;
  seasonYear: number;
  locked?: boolean;
  compact?: boolean;
};

export function RegulationPanel({
  regulationSet,
  seasonYear,
  locked,
  compact,
}: RegulationPanelProps) {
  return (
    <Panel title={`${seasonYear} Season Regulations`}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-neutral-800 px-3 py-1 text-sm font-semibold text-neutral-100">
            {regulationSet.eraLabel}
          </span>
          <span className="text-xs text-neutral-500">
            {regulationSet.series} · {regulationSet.qualifyingFormat}
          </span>
          {locked && (
            <span className="rounded-md bg-amber-900/30 px-2 py-0.5 text-[10px] font-medium text-amber-300">
              🔒 Locked to historical data
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <RegRow label="Qualifying" value={regulationSet.qualifyingFormat} />
          <RegRow label="Race Weekend" value={regulationSet.raceWeekendFormat} />
          <RegRow
            label="Refueling"
            value={regulationSet.refuelingAllowed ? 'Allowed' : 'Banned'}
            color={regulationSet.refuelingAllowed ? 'text-green-400' : 'text-red-400'}
          />
          <RegRow
            label="DRS"
            value={regulationSet.drsEnabled ? 'Enabled' : 'Not in use'}
            color={regulationSet.drsEnabled ? 'text-green-400' : 'text-neutral-400'}
          />
          <RegRow
            label="Sprint"
            value={regulationSet.sprintSupport ? 'Supported' : 'Not in use'}
            color={regulationSet.sprintSupport ? 'text-sky-400' : 'text-neutral-400'}
          />
          <RegRow
            label="Push-to-Pass"
            value={regulationSet.pushToPass ? 'Available' : 'Not in use'}
            color={regulationSet.pushToPass ? 'text-sky-400' : 'text-neutral-400'}
          />
          <RegRow label="Tire Changes" value={regulationSet.tireChangeRules} />
          <RegRow
            label="Budget Cap"
            value={regulationSet.budgetCap ? `$${regulationSet.budgetCap}M` : 'No cap'}
            color={regulationSet.budgetCap ? 'text-amber-400' : 'text-neutral-400'}
          />
          <RegRow
            label="Testing"
            value={regulationSet.testingLimit != null ? `${regulationSet.testingLimit} days` : 'Unlimited'}
          />
        </div>

        {!compact && regulationSet.notes.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Era Notes
            </div>
            <ul className="space-y-1">
              {regulationSet.notes.map((note, i) => (
                <li key={i} className="flex gap-2 text-xs text-neutral-400">
                  <span className="text-neutral-600">•</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!compact && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Design Weights
            </div>
            <div className="grid gap-2 sm:grid-cols-4 text-xs">
              <WeightChip label="Engine Power" value={regulationSet.designRules.enginePowerWeight} />
              <WeightChip label="Aero" value={regulationSet.designRules.aeroEfficiencyWeight} />
              <WeightChip label="Grip" value={regulationSet.designRules.mechanicalGripWeight} />
              <WeightChip label="Reliability" value={regulationSet.designRules.reliabilityWeight} />
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function RegRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className={`mt-0.5 text-sm ${color ?? 'text-neutral-200'}`}>{value}</div>
    </div>
  );
}

function WeightChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded bg-neutral-800/50 px-2 py-1">
      <span className="text-neutral-400">{label}</span>
      <span className="font-semibold text-neutral-200">{value.toFixed(1)}×</span>
    </div>
  );
}
