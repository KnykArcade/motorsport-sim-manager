import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { toMoney } from '../sim/financeEngine';
import {
  FACILITY_SPECS,
  SPECIALIZATION_FACILITIES,
  canUpgrade,
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
import {
  WorkspaceBody,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import { formatMoney } from '../components/ui';
import type { FacilitySpecialization } from '../types/facilityTypes';
import {
  FACILITY_SPECIALIZATION_LABELS,
  FACILITY_SPECIALIZATION_DESCRIPTIONS,
} from '../types/facilityTypes';
import {
  FACILITIES_WORKSPACE_TABS,
  FACILITY_PORTFOLIO_GROUPS,
  facilitiesForPortfolioGroup,
  type FacilitiesWorkspaceTab,
  type FacilityPortfolioGroupId,
} from './facilitiesViewModel';
import {
  FmDecisionBar,
  FmKeyValue,
  FmListButton,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
import {
  facilityUpgradeDisabledReason,
  selectedTechnicalRecord,
} from './technicalCommercialViewModel';

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

export function FacilitiesBody() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<FacilitiesWorkspaceTab>('planner');
  const [portfolioGroup, setPortfolioGroup] = useState<FacilityPortfolioGroupId>('development');
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>();

  if (!state) return null;

  const budget = teamById(state, state.selectedTeamId)?.budget ?? 0;
  const facilitiesState = state.facilities;

  if (!facilitiesState) {
    return <Panel title="Facilities"><p className="text-sm text-neutral-400">Facilities are available in Career Mode.</p></Panel>;
  }

  const pendingIds = new Set(
    facilitiesState.pendingUpgrades.map((upgrade) => upgrade.facilityId),
  );
  const specialization = facilitiesState.specialization ?? 'Balanced';
  const selectedGroup =
    FACILITY_PORTFOLIO_GROUPS.find((group) => group.id === portfolioGroup) ??
    FACILITY_PORTFOLIO_GROUPS[0];
  const visibleFacilities = facilitiesForPortfolioGroup(
    facilitiesState.facilities,
    selectedGroup.id,
  );
  const selectedFacility = selectedTechnicalRecord(visibleFacilities, selectedFacilityId);

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
    <div className="space-y-4">
      <WorkspaceTabs
        items={FACILITIES_WORKSPACE_TABS.map((workspace) => ({
          ...workspace,
          label: workspace.id === 'planner' && facilitiesState.pendingUpgrades.length > 0
            ? `${workspace.label} (${facilitiesState.pendingUpgrades.length})`
            : workspace.label,
        }))}
        active={tab}
        onChange={setTab}
        ariaLabel="Facilities workspaces"
      />

      <WorkspaceBody>
      <div className="ui-decision-strip flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="ui-decision-strip-pulse" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-semibold text-neutral-100">Infrastructure operations desk</div>
            <div className="truncate text-neutral-400">
              {facilitiesState.pendingUpgrades.length > 0
                ? `${facilitiesState.pendingUpgrades.length} upgrade${facilitiesState.pendingUpgrades.length === 1 ? '' : 's'} are in the construction queue.`
                : 'No construction is queued. Review the planner for the next technical priority.'}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          {formatMoney(budget)} available
        </span>
      </div>
      {tab === 'planner' && (
        <div className="ui-facilities-workspace">
          <FmWorkspaceGrid columns="three" className="ui-facilities-grid">
            <FmPane>
              <FmPaneHeader title="Facility groups" meta={selectedGroup.description} />
              <FmPaneBody className="overflow-auto">
                <div className="ui-facility-group-list" aria-label="Facility groups">
                  {FACILITY_PORTFOLIO_GROUPS.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      aria-pressed={portfolioGroup === group.id}
                      onClick={() => setPortfolioGroup(group.id)}
                      className={portfolioGroup === group.id ? 'is-active' : ''}
                    >
                      <strong>{group.label}</strong>
                      <span>{group.description}</span>
                    </button>
                  ))}
                </div>
                <div className="ui-facility-record-list">
                  {visibleFacilities.map((facility) => {
                    const specification = FACILITY_SPECS[facility.type];
                    return (
                      <FmListButton
                        key={facility.id}
                        active={selectedFacility?.id === facility.id}
                        urgent={pendingIds.has(facility.id)}
                        onClick={() => setSelectedFacilityId(facility.id)}
                      >
                        <span>{pendingIds.has(facility.id) ? 'Construction queued' : `Level ${facility.level}/${facility.maxLevel}`}</span>
                        <strong>{specification.label}</strong>
                        <small>{SPECIALIZATION_FACILITIES[specialization].includes(facility.type) ? '25% specialization bonus' : 'Standard effect'}</small>
                      </FmListButton>
                    );
                  })}
                </div>
              </FmPaneBody>
            </FmPane>

            <FmPane className="ui-facility-detail-pane">
              <FmPaneHeader
                title={selectedFacility ? FACILITY_SPECS[selectedFacility.type].label : 'Facility profile'}
                meta={selectedFacility ? `Level ${selectedFacility.level} of ${selectedFacility.maxLevel}` : undefined}
              />
              <FmPaneBody className="overflow-auto">
                {selectedFacility && (
                  <div className="ui-technical-dossier">
                    <section>
                      <h3>Purpose</h3>
                      <p>{FACILITY_SPECS[selectedFacility.type].description}</p>
                    </section>
                    <section>
                      <FmKeyValue label="Current level" value={`${selectedFacility.level}/${selectedFacility.maxLevel}`} />
                      <FmKeyValue label="Construction status" value={pendingIds.has(selectedFacility.id) ? 'Paid · activates next season' : 'Available for planning'} />
                      <FmKeyValue label="Upgrade cost" value={canUpgrade(selectedFacility) ? formatMoney(toMoney(upgradeCostFor(selectedFacility))) : 'Maximum level'} />
                      <FmKeyValue label="Specialization" value={SPECIALIZATION_FACILITIES[specialization].includes(selectedFacility.type) ? FACILITY_SPECIALIZATION_LABELS[specialization] : 'No active boost'} />
                    </section>
                    <section>
                      <h3>Effective benefits</h3>
                      <div className="ui-facility-effect-list">
                        {Object.entries(effectiveFacilityEffects(selectedFacility, facilitiesState)).map(([key, value]) => (
                          <FmKeyValue key={key} label={EFFECT_LABELS[key] ?? key} value={formatEffect(key, value)} />
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </FmPaneBody>
            </FmPane>

            <FmPane className="ui-facility-context-pane">
              <FmPaneHeader title="Portfolio effects" meta={FACILITY_SPECIALIZATION_LABELS[specialization]} />
              <FmPaneBody className="overflow-auto">
                <div className="ui-facility-impact-list">
                  {impacts.map((impact) => (
                    <div key={impact.label}>
                      <span>{impact.label}</span>
                      <strong>{impact.value}</strong>
                      <small>{impact.detail}</small>
                    </div>
                  ))}
                </div>
                <p className="ui-technical-muted">Values include the active specialization. Development slots use the average level of the complete portfolio.</p>
              </FmPaneBody>
            </FmPane>
          </FmWorkspaceGrid>
          <FmDecisionBar actions={selectedFacility && (() => {
            const pending = pendingIds.has(selectedFacility.id);
            const affordable = toMoney(upgradeCostFor(selectedFacility)) <= budget;
            const disabledReason = facilityUpgradeDisabledReason({ maxed: !canUpgrade(selectedFacility), pending, affordable });
            return (
              <Button
                variant="primary"
                disabled={!!disabledReason}
                title={disabledReason}
                onClick={() => dispatch({ type: 'UPGRADE_FACILITY', facilityId: selectedFacility.id })}
              >
                Upgrade to L{Math.min(selectedFacility.maxLevel, selectedFacility.level + 1)} · {formatMoney(toMoney(upgradeCostFor(selectedFacility)))}
              </Button>
            );
          })()}>
            <strong>{selectedFacility ? FACILITY_SPECS[selectedFacility.type].label : 'Select a facility'}</strong>
            <span>{selectedFacility ? facilityUpgradeDisabledReason({ maxed: !canUpgrade(selectedFacility), pending: pendingIds.has(selectedFacility.id), affordable: toMoney(upgradeCostFor(selectedFacility)) <= budget }) ?? 'The selected upgrade will join the construction queue.' : 'Choose a facility to review its effects and upgrade eligibility.'}</span>
          </FmDecisionBar>
        </div>
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
      </WorkspaceBody>
    </div>
  );
}

export function Facilities() {
  return <FacilitiesBody />;
}
