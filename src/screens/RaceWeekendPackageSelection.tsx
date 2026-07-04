import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../game/GameContext';
import { currentRace } from '../game/careerState';
import { getTrackById } from '../data';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import {
  RACE_WEEKEND_PACKAGES,
  availablePackagesForSeries,
  computeAllPackageCosts,
  formatPackageCost,
  PACKAGE_COLORS,
  PACKAGE_BORDER_COLORS,
  teamScaleTier,
  trackCostClass,
  canAffordAnyNormalPackage,
} from '../sim/raceWeekendPackageEngine';
import type { RaceWeekendPackageType } from '../types/raceWeekendPackageTypes';
import type { MotorsportEraTheme } from '../theme/eraTheme';

type Props = {
  onConfirm: () => void;
  eraTheme?: MotorsportEraTheme;
};

export function RaceWeekendPackageSelection({ onConfirm, eraTheme }: Props) {
  const { state, dispatch } = useGame();
  const race = state ? currentRace(state) : undefined;
  const track = race ? getTrackById(race.trackId) : undefined;
  const team = state?.teams.find((t) => t.id === state.selectedTeamId);
  const currentPackage =
    state?.raceWeekendPackage && race && state.raceWeekendPackage.raceId === race.id
      ? state.raceWeekendPackage
      : undefined;
  const [selected, setSelected] = useState<RaceWeekendPackageType | null>(
    currentPackage?.packageType ?? null,
  );

  useEffect(() => {
    setSelected(currentPackage?.packageType ?? null);
  }, [currentPackage?.packageType, race?.id]);

  const availablePackages = useMemo(
    () => (state ? availablePackagesForSeries(state.series) : []),
    [state],
  );

  const allCosts = useMemo(() => {
    if (!state || !team || !track) return null;
    return computeAllPackageCosts(state.series, team, track);
  }, [state, team, track]);

  const canAffordNormal = useMemo(
    () => (state && team && track ? canAffordAnyNormalPackage(state.series, team, track) : true),
    [state, team, track],
  );

  if (!state || !race || !track || !team || !allCosts) {
    return (
      <Panel title="Race Weekend Package">
        <p className="text-neutral-400">Loading race weekend data...</p>
      </Panel>
    );
  }

  const tier = teamScaleTier(team);
  const trackClass = trackCostClass(track);
  const selectedDef = selected ? RACE_WEEKEND_PACKAGES[selected] : null;
  const selectedCost = selected ? (selected === 'MandatoryMinimum' ? { cost: 0, baseCost: 0, teamScale: 1, trackModifier: 1, packageModifier: 0, damageReserve: 0 } : allCosts[selected]) : null;
  const canAfford = selectedCost ? selected === 'MandatoryMinimum' || team.budget >= selectedCost.cost : false;
  const alreadySelected = currentPackage?.packageType === selected;

  const handleConfirm = () => {
    if (!selected || !canAfford || alreadySelected) return;
    dispatch({ type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: selected });
    onConfirm();
  };

  const confirmButton = selectedDef && selectedCost ? (
    <Button
      variant="primary"
      disabled={!canAfford || alreadySelected}
      onClick={handleConfirm}
      className="px-3 py-1.5 text-xs"
    >
      {alreadySelected ? 'Already Selected' : 'Confirm Package'}
    </Button>
  ) : null;

  return (
    <div className={`space-y-4 ${eraTheme === 'f1-1990s' ? 'text-neutral-100' : ''}`}>
      <Panel
        title={eraTheme === 'f1-1990s' ? '1990s Garage Package Desk' : 'Race Weekend Package Selection'}
        actions={confirmButton}
        className={eraTheme === 'f1-1990s' ? 'border-amber-500/30 bg-black/55' : ''}
      >
        <div className="mb-4 space-y-1 text-sm text-neutral-400">
          <p>
            <span className="text-neutral-500">Race:</span>{' '}
            <span className="text-neutral-200">{race.gpName}</span>
            {' — '}
            <span className="text-neutral-300">{track.name}</span>
          </p>
          <p>
            <span className="text-neutral-500">Team Scale:</span>{' '}
            <span className="text-neutral-200">{tier}</span>
            {'  ·  '}
            <span className="text-neutral-500">Track Class:</span>{' '}
            <span className="text-neutral-200">{trackClass}</span>
          </p>
          <p>
            <span className="text-neutral-500">Budget:</span>{' '}
            <span className="text-neutral-200">${(team.budget / 1_000_000).toFixed(2)}M</span>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {availablePackages.map((pkgType) => {
            const def = RACE_WEEKEND_PACKAGES[pkgType];
            const cost = allCosts[pkgType];
            const affordable = team.budget >= cost.cost;
            const isSelected = selected === pkgType;
            const isCurrent = currentPackage?.packageType === pkgType;

            return (
              <button
                key={pkgType}
                onClick={() => setSelected(pkgType)}
                disabled={isCurrent}
                className={`rounded-lg border p-3 text-left transition-all ${
                  isSelected
                    ? `${PACKAGE_BORDER_COLORS[pkgType]} bg-neutral-900/80 ring-1 ring-amber-500/30`
                    : isCurrent
                      ? 'border-neutral-700 bg-neutral-900/40 opacity-60'
                      : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={`text-sm font-semibold ${PACKAGE_COLORS[pkgType]}`}>
                    {def.shortLabel}
                  </span>
                  {isCurrent && (
                    <span className="text-xs text-amber-500">Selected</span>
                  )}
                </div>
                <p className="mb-2 text-xs text-neutral-400">{def.description}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className={affordable ? 'text-neutral-300' : 'text-red-400'}>
                    {formatPackageCost(cost.cost)}
                  </span>
                  <div className="flex gap-2 text-neutral-500">
                    <span title="Pace modifier">
                      {def.effects.paceModifier > 0 ? '+' : ''}
                      {def.effects.paceModifier.toFixed(1)} pace
                    </span>
                    <span title="Reliability prep">
                      {def.effects.reliabilityPrep > 0 ? '+' : ''}
                      {def.effects.reliabilityPrep.toFixed(2)} rel
                    </span>
                  </div>
                </div>
                {!affordable && (
                  <p className="mt-1 text-xs text-red-400">Insufficient budget</p>
                )}
              </button>
            );
          })}
        </div>

        {!canAffordNormal && (
          <div className="mt-4 rounded-lg border border-rose-600/50 bg-rose-950/20 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-semibold text-rose-400">
                {RACE_WEEKEND_PACKAGES.MandatoryMinimum.shortLabel}
              </span>
              <span className="text-xs text-rose-500/80">Emergency Fallback</span>
            </div>
            <p className="mb-2 text-xs text-neutral-400">
              {RACE_WEEKEND_PACKAGES.MandatoryMinimum.description}
            </p>
            <p className="mb-3 text-xs text-amber-500/80">
              Your team cannot afford a standard race package. Minimum Operations will get the cars
              to the grid, but performance, reliability, morale, and sponsor confidence may suffer.
            </p>
            <button
              onClick={() => setSelected('MandatoryMinimum')}
              disabled={currentPackage?.packageType === 'MandatoryMinimum'}
              className={`w-full rounded-lg border p-3 text-left transition-all ${
                selected === 'MandatoryMinimum'
                  ? 'border-rose-600/50 bg-neutral-900/80 ring-1 ring-amber-500/30'
                  : currentPackage?.packageType === 'MandatoryMinimum'
                    ? 'border-neutral-700 bg-neutral-900/40 opacity-60'
                    : 'border-rose-700/40 bg-rose-950/20 hover:border-rose-600/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-300">Cost: Free (Emergency)</span>
                <span className="text-xs text-rose-400">
                  Pace -0.5 · Reliability -0.35 · Sponsors -20 · Morale -12
                </span>
              </div>
              {RACE_WEEKEND_PACKAGES.MandatoryMinimum.warnings.map((w, i) => (
                <p key={i} className="mt-1 text-xs text-amber-500/70">⚠ {w}</p>
              ))}
            </button>
          </div>
        )}
      </Panel>

      {selectedDef && selectedCost && (
        <Panel
          title="Package Details"
          className={eraTheme === 'f1-1990s' ? 'border-amber-500/30 bg-black/55' : ''}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className={`mb-2 text-sm font-semibold ${PACKAGE_COLORS[selected!]}`}>
                {selectedDef.label}
              </h3>
              <p className="mb-3 text-sm text-neutral-400">{selectedDef.description}</p>

              <div className="space-y-1 text-xs text-neutral-400">
                <CostBreakdownRow label="Base cost" value={formatPackageCost(selectedCost.baseCost)} />
                <CostBreakdownRow label="Team scale" value={`×${selectedCost.teamScale.toFixed(2)}`} />
                <CostBreakdownRow label="Track modifier" value={`×${selectedCost.trackModifier.toFixed(2)}`} />
                <CostBreakdownRow label="Package modifier" value={`×${selectedCost.packageModifier.toFixed(2)}`} />
                <CostBreakdownRow label="Damage reserve" value={formatPackageCost(selectedCost.damageReserve)} />
                <div className="my-1 border-t border-neutral-800" />
                <CostBreakdownRow
                  label="Total cost"
                  value={formatPackageCost(selectedCost.cost)}
                  bold
                />
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-neutral-300">Effects</h3>
              <div className="space-y-1 text-xs">
                <EffectRow label="Pace modifier" value={selectedDef.effects.paceModifier} format="decimal" />
                <EffectRow label="Reliability prep" value={selectedDef.effects.reliabilityPrep} format="decimal" />
                <EffectRow label="Pit crew prep" value={selectedDef.effects.pitCrewPrep} format="decimal" />
                <EffectRow label="Sponsor satisfaction" value={selectedDef.effects.sponsorSatisfaction} format="integer" />
                <EffectRow label="Driver morale" value={selectedDef.effects.driverMorale} format="integer" />
                <EffectRow label="Tyre preservation" value={selectedDef.effects.tyrePreservation} format="decimal" />
                <EffectRow label="Development data gain" value={selectedDef.effects.developmentDataGain} format="multiplier" />
                <EffectRow label="Operational risk" value={selectedDef.effects.operationalRiskMultiplier} format="multiplier" />
                <EffectRow label="Crash risk" value={selectedDef.effects.crashRiskMultiplier} format="multiplier" />
              </div>

              {selectedDef.warnings.length > 0 && (
                <div className="mt-3 space-y-1">
                  {selectedDef.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-500/80">⚠ {w}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm">
              {canAfford ? (
                <span className="text-neutral-400">
                  Cost: <span className="text-neutral-200">{formatPackageCost(selectedCost.cost)}</span>
                  {' — '}
                  Remaining: <span className="text-neutral-200">
                    ${((team.budget - selectedCost.cost) / 1_000_000).toFixed(2)}M
                  </span>
                </span>
              ) : (
                <span className="text-red-400">Insufficient budget for this package.</span>
              )}
            </div>
            {eraTheme !== 'f1-1990s' && (
              <Button
                variant="primary"
                disabled={!canAfford || alreadySelected}
                onClick={handleConfirm}
              >
                {alreadySelected ? 'Already Selected' : 'Confirm Package'}
              </Button>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

function CostBreakdownRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className={bold ? 'font-semibold text-neutral-200' : 'text-neutral-300'}>{value}</span>
    </div>
  );
}

function EffectRow({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format: 'decimal' | 'integer' | 'multiplier';
}) {
  const display =
    format === 'integer'
      ? `${value > 0 ? '+' : ''}${value}`
      : format === 'multiplier'
        ? `×${value.toFixed(2)}`
        : `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
  const color =
    value > 0
      ? 'text-green-400'
      : value < 0
        ? 'text-red-400'
        : 'text-neutral-400';
  return (
    <div className="flex justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className={color}>{display}</span>
    </div>
  );
}
