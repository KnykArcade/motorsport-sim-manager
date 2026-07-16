import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { toMoney } from '../sim/financeEngine';
import {
  FACILITY_SPECS,
  SPECIALIZATION_FACILITIES,
  canUpgrade,
  developmentSlots,
  effectiveFacilityEffects,
  facilityDevelopmentSuccessBonus,
  facilityEffect,
  facilityRepairCostReduction,
  facilitySetupFeedbackBonus,
  facilityYouthDevelopmentBonus,
  upgradeCostFor,
} from '../sim/facilityEngine';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { formatMoney, ratingColor } from '../components/ui';
import type { Facility, FacilitySpecialization } from '../types/facilityTypes';
import {
  FACILITY_SPECIALIZATION_LABELS,
  FACILITY_SPECIALIZATION_DESCRIPTIONS,
} from '../types/facilityTypes';
import {
  FACILITIES_WORKSPACE_TABS,
  FACILITY_PORTFOLIO_GROUPS,
  averageFacilityLevel,
  facilitiesForPortfolioGroup,
  type FacilitiesWorkspaceTab,
  type FacilityPortfolioGroupId,
} from './facilitiesViewModel';

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
  if (key === 'setupFeedback' || key === 'pitStop' || key === 'reliability') {
    return `+${value.toFixed(1)}`;
  }
  return `+${Math.round(value * 100)}%`;
}

export function Facilities() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<FacilitiesWorkspaceTab>('impacts');
  const [portfolioGroup, setPortfolioGroup] = useState<FacilityPortfolioGroupId>('development');

  if (!state) return null;

  const budget = teamById(state, state.selectedTeamId)?.budget ?? 0;
  const facilitiesState = state.facilities;

  if (!facilitiesState) {
    return (
      <div className="space-y-3">
        <FacilitiesHeader budget={budget} />
        <Panel title="Facilities">
          <p className="text-sm text-neutral-400">Facilities are available in Career Mode.</p>
        </Panel>
      </div>
    );
  }

  const pendingIds = new Set(
    facilitiesState.pendingUpgrades.map((upgrade) => upgrade.facilityId),
  );
  const averageLevel = averageFacilityLevel(facilitiesState.facilities);
  const specialization = facilitiesState.specialization ?? 'Balanced';
  const selectedGroup =
    FACILITY_PORTFOLIO_GROUPS.find((group) => group.id === portfolioGroup) ??
    FACILITY_PORTFOLIO_GROUPS[0];
  const visibleFacilities = facilitiesForPortfolioGroup(
    facilitiesState.facilities,
    selectedGroup.id,
  );

  const impacts = [
    {
      label: 'Development success',
      value: `+${Math.round(facilityDevelopmentSuccessBonus(facilitiesState) * 100)}%`,
      detail: 'Added to project outcome quality',
    },
    {
      label: 'Development speed',
      value: `+${Math.round(facilityEffect(facilitiesState, 'developmentSpeed') * 100)}%`,
      detail: 'Additional project progress per race',
    },
    {
      label: 'Setup feedback',
      value: `+${facilitySetupFeedbackBonus(facilitiesState).toFixed(1)}`,
      detail: 'Setup-confidence points for the race team',
    },
    {
      label: 'Repair savings',
      value: `${Math.round(facilityRepairCostReduction(facilitiesState) * 100)}%`,
      detail: 'Crash-repair cost reduction',
    },
    {
      label: 'Youth growth',
      value: `+${Math.round(facilityYouthDevelopmentBonus(facilitiesState) * 100)}%`,
      detail: 'Academy progression at season rollover',
    },
    {
      label: 'Pit operations',
      value: `+${facilityEffect(facilitiesState, 'pitStop').toFixed(1)}`,
      detail: 'Effective pit-crew execution',
    },
    {
      label: 'Reliability',
      value: `+${facilityEffect(facilitiesState, 'reliability').toFixed(1)}`,
      detail: 'Effective mechanical reliability',
    },
    {
      label: 'Scouting accuracy',
      value: `+${Math.round(facilityEffect(facilitiesState, 'scouting') * 100)}%`,
      detail: 'Sharper talent assessments',
    },
  ];

  return (
    <div className="space-y-3">
      <FacilitiesHeader budget={budget} />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Average Level" value={`${averageLevel.toFixed(1)} / 5`} />
        <Kpi label="Development Slots" value={String(developmentSlots(facilitiesState))} />
        <Kpi label="Specialization" value={FACILITY_SPECIALIZATION_LABELS[specialization]} />
        <Kpi label="Pending Upgrades" value={String(facilitiesState.pendingUpgrades.length)} />
      </div>

      <nav
        aria-label="Facilities workspaces"
        className="flex gap-1 rounded-xl border border-neutral-800 bg-neutral-900/50 p-1"
      >
        {FACILITIES_WORKSPACE_TABS.map((workspace) => (
          <button
            key={workspace.id}
            type="button"
            aria-current={tab === workspace.id ? 'page' : undefined}
            onClick={() => setTab(workspace.id)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              tab === workspace.id
                ? 'bg-sky-500/20 text-sky-200'
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
            }`}
          >
            {workspace.label}
            {workspace.id === 'planner' && facilitiesState.pendingUpgrades.length > 0
              ? ` (${facilitiesState.pendingUpgrades.length})`
              : ''}
          </button>
        ))}
      </nav>

      {tab === 'impacts' && (
        <Panel title="Current Infrastructure Impact">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {impacts.map((impact) => (
              <ImpactCard key={impact.label} {...impact} />
            ))}
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Values include the active {FACILITY_SPECIALIZATION_LABELS[specialization]} focus.
            Development slots are based on the average level of the entire facility portfolio.
          </p>
        </Panel>
      )}

      {tab === 'planner' && (
        <Panel
          title="Upgrade Planner"
          actions={
            <span className="text-xs text-neutral-500">
              {selectedGroup.description}
            </span>
          }
        >
          <div className="mb-3 flex gap-1" aria-label="Facility groups">
            {FACILITY_PORTFOLIO_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                aria-pressed={portfolioGroup === group.id}
                onClick={() => setPortfolioGroup(group.id)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
                  portfolioGroup === group.id
                    ? 'bg-sky-500/20 text-sky-200'
                    : 'bg-neutral-950/30 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'
                }`}
              >
                {group.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {visibleFacilities.map((facility) => (
              <FacilityCard
                key={facility.id}
                facility={facility}
                pending={pendingIds.has(facility.id)}
                affordable={toMoney(upgradeCostFor(facility)) <= budget}
                boosted={SPECIALIZATION_FACILITIES[specialization].includes(facility.type)}
                effectiveEffects={effectiveFacilityEffects(facility, facilitiesState)}
                onUpgrade={() =>
                  dispatch({ type: 'UPGRADE_FACILITY', facilityId: facility.id })
                }
              />
            ))}
          </div>
        </Panel>
      )}

      {tab === 'specialization' && (
        <Panel title="Facility Specialization">
          <p className="mb-3 text-sm text-neutral-400">
            Set the team&apos;s infrastructure focus. Associated facilities gain 25% stronger effects;
            changing focus updates the current bonuses immediately.
          </p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {(Object.keys(FACILITY_SPECIALIZATION_LABELS) as FacilitySpecialization[]).map(
              (candidate) => {
                const active = specialization === candidate;
                const boostedFacilities = SPECIALIZATION_FACILITIES[candidate];
                return (
                  <button
                    key={candidate}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      dispatch({
                        type: 'SET_FACILITY_SPECIALIZATION',
                        specialization: candidate,
                      })
                    }
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      active
                        ? 'border-amber-500 bg-amber-900/20'
                        : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
                    }`}
                  >
                    <div
                      className={`text-sm font-semibold ${
                        active ? 'text-amber-300' : 'text-neutral-200'
                      }`}
                    >
                      {FACILITY_SPECIALIZATION_LABELS[candidate]}
                    </div>
                    <div className="mt-1 text-[11px] text-neutral-500">
                      {FACILITY_SPECIALIZATION_DESCRIPTIONS[candidate]}
                    </div>
                    {boostedFacilities.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {boostedFacilities.map((type) => (
                          <span
                            key={type}
                            className="rounded bg-neutral-800/60 px-1.5 py-0.5 text-[10px] text-neutral-400"
                          >
                            {FACILITY_SPECS[type].label}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              },
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

function FacilitiesHeader({ budget }: { budget: number }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Facilities</h1>
        <p className="text-sm text-neutral-400">
          Long-term infrastructure for development, race operations, and talent.
        </p>
      </div>
      <div className="text-right">
        <div className="text-xs uppercase tracking-wide text-neutral-500">Available budget</div>
        <div className="text-lg font-bold text-neutral-100">{formatMoney(budget)}</div>
      </div>
    </div>
  );
}

function FacilityCard({
  facility,
  pending,
  affordable,
  boosted,
  effectiveEffects,
  onUpgrade,
}: {
  facility: Facility;
  pending: boolean;
  affordable: boolean;
  boosted: boolean;
  effectiveEffects: Record<string, number>;
  onUpgrade: () => void;
}) {
  const specification = FACILITY_SPECS[facility.type];
  const maxed = !canUpgrade(facility);
  const fillPct = facility.maxLevel > 0 ? (facility.level / facility.maxLevel) * 100 : 0;
  const fillColor = ratingColor(fillPct);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-neutral-100">{specification.label}</div>
          {boosted && <div className="text-[10px] font-semibold text-amber-300">25% focus bonus</div>}
        </div>
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-300">
          L{facility.level} / {facility.maxLevel}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-neutral-500">{specification.description}</p>

      <div className="mb-2 flex h-1.5 gap-0.5">
        {Array.from({ length: facility.maxLevel }).map((_, index) => (
          <div
            key={index}
            className="flex-1 rounded-sm"
            style={{ backgroundColor: index < facility.level ? fillColor : '#262626' }}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {Object.entries(effectiveEffects).map(([key, value]) => (
          <span
            key={key}
            className="rounded bg-neutral-800/60 px-1.5 py-0.5 text-[10px] text-neutral-300"
          >
            {EFFECT_LABELS[key] ?? key} {formatEffect(key, value)}
          </span>
        ))}
      </div>

      <div className="mt-3 border-t border-neutral-800 pt-2">
        {maxed ? (
          <div className="text-center text-xs text-neutral-500">Fully upgraded</div>
        ) : pending ? (
          <div className="text-center text-xs text-sky-300">Paid · Activates next season</div>
        ) : (
          <Button
            variant="primary"
            className="w-full px-2 py-1 text-xs"
            disabled={!affordable}
            onClick={onUpgrade}
          >
            {affordable
              ? `Upgrade to L${facility.level + 1} · ${formatMoney(toMoney(upgradeCostFor(facility)))}`
              : `Need ${formatMoney(toMoney(upgradeCostFor(facility)))}`}
          </Button>
        )}
      </div>
    </div>
  );
}

function ImpactCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/30 p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-0.5 text-xl font-bold text-neutral-100">{value}</div>
      <div className="mt-1 text-[11px] leading-snug text-neutral-600">{detail}</div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-0.5 truncate text-xl font-bold text-neutral-100" title={value}>
        {value}
      </div>
    </div>
  );
}
