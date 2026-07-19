import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { activeDriversForTeam, driversForTeam } from '../game/careerState';
import type { GameState } from '../game/careerState';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { DriverDossierButton } from '../components/driverCards/DriverDossier';
import { ratingColor } from '../components/ui';
import { TEAM_ORDER_SPECS } from '../sim/relationshipEngine';
import {
  computeConfidenceState,
  overallConfidenceScore,
  confidencePerformanceModifier,
  contractLoyaltyModifier,
} from '../sim/driverConfidenceEngine';
import { promiseProgress } from './relationships/promiseProgress';
import type {
  TeamOrder,
  DriverRelationship,
  ConfidenceState,
  DriverWant,
  DriverPromise,
  PromiseType,
} from '../types/relationshipTypes';
import { contractClauseLabel } from '../sim/phase18ContractClauseEngine';
import {
  currentRelationshipAttention,
  type RelationshipAttentionProfile,
} from '../sim/relationshipAttentionEngine';
import type { ContractBreachResponse } from '../types/phase18Types';
import { RelationshipPriorityBoard } from './relationships/RelationshipPriorityBoard';
import { RelationshipActivityPanel } from './relationships/RelationshipActivityPanel';
import { currentRelationshipActivity } from './relationships/relationshipActivityViewModel';
import {
  relationshipStatusLabel,
} from './relationships/relationshipPriorityViewModel';
import {
  currentCollectiveStakeholders,
  type CollectiveStakeholderProfile,
} from './relationships/relationshipStakeholderViewModel';
import { currentPotentialEmployerStanding } from './relationships/relationshipEmployerViewModel';
import { currentExternalTalentContext } from './relationships/relationshipTalentViewModel';
import { relationshipCommandSummary } from './relationships/relationshipCommandViewModel';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';

const ORDER_LABEL: Record<TeamOrder, string> = Object.fromEntries(
  TEAM_ORDER_SPECS.map((s) => [s.order, s.label]),
) as Record<TeamOrder, string>;

const CONFIDENCE_STATE_COLORS: Record<ConfidenceState, string> = {
  Inspired: 'bg-green-600 text-white',
  Confident: 'bg-green-500 text-white',
  Settled: 'bg-emerald-500 text-white',
  Neutral: 'bg-neutral-600 text-white',
  Concerned: 'bg-amber-500 text-white',
  Frustrated: 'bg-orange-500 text-white',
  Disillusioned: 'bg-red-500 text-white',
  'Checked Out': 'bg-red-700 text-white',
};

const WANT_LABELS: Record<DriverWant, string> = {
  number_one_status: 'Number One Status',
  equal_treatment: 'Equal Treatment',
  better_reliability: 'Better Reliability',
  development_priority: 'Development Priority',
  contract_renewal: 'Contract Renewal',
  race_seat_security: 'Race Seat Security',
  less_risky_strategy: 'Less Risky Strategy',
  more_aggressive_strategy: 'More Aggressive Strategy',
  better_teammate_treatment: 'Better Teammate Treatment',
  podium_capable_car: 'Podium-Capable Car',
  title_contending_car: 'Title-Contending Car',
  better_salary: 'Better Salary',
  academy_promotion: 'Academy Promotion',
  practice_time: 'More Practice Time',
  team_stability: 'Team Stability',
};

const PROMISE_TYPE_LABELS: Record<PromiseType, string> = {
  equal_treatment: 'Equal Treatment',
  number_one_status: 'Number One Status',
  improved_reliability: 'Improved Reliability',
  development_priority: 'Development Priority',
  contract_renewal: 'Contract Renewal',
  promotion: 'Promotion to Race Seat',
  reserve_practice_time: 'Reserve Practice Time',
  no_midseason_replacement: 'No Midseason Replacement',
  better_strategy_support: 'Better Strategy Support',
  priority_upgrades: 'Priority Upgrades',
  fight_teammate: 'Right to Fight Teammate',
  calmer_risk_approach: 'Calmer Risk Approach',
};

function confidenceStateDescription(state: ConfidenceState): string {
  switch (state) {
    case 'Inspired': return 'On top of the world — performing above their normal ceiling.';
    case 'Confident': return 'Believes in the car and team — performing at their best.';
    case 'Settled': return 'Comfortable and steady — a small positive edge.';
    case 'Neutral': return 'Neither up nor down — baseline performance.';
    case 'Concerned': return 'Doubts are creeping in — slight performance drag.';
    case 'Frustrated': return 'Things are not going their way — noticeable impact.';
    case 'Disillusioned': return 'Has largely lost faith — significant performance loss.';
    case 'Checked Out': return 'Mentally gone — only going through the motions.';
  }
}

function trustLevelDescription(label: string, value: number): string {
  if (value >= 80) return `${label} is very high — the driver fully believes in this area.`;
  if (value >= 65) return `${label} is solid — the driver trusts things are heading the right way.`;
  if (value >= 45) return `${label} is middling — the driver is neither impressed nor alarmed.`;
  if (value >= 25) return `${label} is low — the driver has real doubts.`;
  return `${label} is critically low — the driver has almost no faith left.`;
}

function egoDescription(ego: number): string {
  if (ego >= 75) return 'Very high ego — this driver reacts strongly to team orders, teammate losses, and any sign of being sidelined. Handle with care.';
  if (ego >= 55) return 'Moderate ego — this driver wants to feel valued and will notice if they are not getting fair treatment.';
  if (ego >= 35) return 'Balanced ego — this driver is generally team-oriented but still wants respect.';
  return 'Low ego — this driver is a team player who rarely demands special treatment.';
}

function wantDescription(want: DriverWant): string {
  switch (want) {
    case 'number_one_status': return 'Wants to be the clear number-one driver in the team.';
    case 'equal_treatment': return 'Wants equal treatment with their teammate — no favouritism.';
    case 'better_reliability': return 'Wants the car to be more reliable — tired of mechanical failures.';
    case 'development_priority': return 'Wants development parts prioritised for their side of the garage.';
    case 'contract_renewal': return 'Wants a new contract or extension signed soon.';
    case 'race_seat_security': return 'Wants assurance they will keep their race seat.';
    case 'less_risky_strategy': return 'Prefers safer, more conservative race strategies.';
    case 'more_aggressive_strategy': return 'Wants the team to take more strategic risks to gain positions.';
    case 'better_teammate_treatment': return 'Wants the team to treat their teammate more fairly (or stop favouring them).';
    case 'podium_capable_car': return 'Wants a car that can fight for podiums.';
    case 'title_contending_car': return 'Wants a car that can fight for the championship.';
    case 'better_salary': return 'Wants a better-paid contract.';
    case 'academy_promotion': return 'Wants to be promoted from the academy to a race seat.';
    case 'practice_time': return 'Wants more practice and testing time.';
    case 'team_stability': return 'Wants the team to be stable — no management upheaval or financial trouble.';
  }
}

function loyaltyRiskText(modifier: number): string {
  if (modifier >= 8) return 'Very loyal — unlikely to leave even for a better offer.';
  if (modifier >= 4) return 'Loyal — would need a strong reason to leave.';
  if (modifier >= 0) return 'Neutral — will listen to rival offers.';
  if (modifier >= -4) return 'Restless — actively considering options.';
  if (modifier >= -8) return 'Unhappy — looking for a way out.';
  return 'Disillusioned — will leave at the first opportunity.';
}

export function Relationships() {
  const [activeSection, setActiveSection] = useState<'overview' | 'activity' | 'race' | 'reserve' | 'clauses' | 'orders'>('overview');
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
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
  const teamId = state.selectedTeamId;
  const teamBudget = state.teams.find((team) => team.id === teamId)?.budget ?? 0;
  const teamDrivers = driversForTeam(state, teamId);
  const activeDrivers = activeDriversForTeam(state, teamId);
  const reserveDrivers = teamDrivers.filter((d) => !activeDrivers.some((ad) => ad.id === d.id));
  const orders = (state.teamOrderHistory ?? []).slice().reverse();
  const allPromises = state.driverPromises ?? [];
  const contractClauses = (state.phase18?.contractClauses ?? []).filter((clause) =>
    clause.teamId === teamId && clause.partyType === 'Driver' && teamDrivers.some((driver) => driver.id === clause.partyId),
  );
  const activePromiseCount = allPromises.filter((promise) => promise.status === 'active' && teamDrivers.some((driver) => driver.id === promise.driverId)).length;
  const relationshipPriorities = currentRelationshipAttention(state);
  const relationshipActivityCount = currentRelationshipActivity(state).length;
  const collectiveStakeholders = currentCollectiveStakeholders(state);
  const employerStanding = currentPotentialEmployerStanding(state);
  const externalTalent = currentExternalTalentContext(state);
  const commandSummary = relationshipCommandSummary({
    characterProfiles: relationshipPriorities,
    collectiveProfiles: collectiveStakeholders,
    employerStanding,
    externalTalent,
  });
  const deskSignal = commandSummary.topSignal;
  const ownerPriority = relationshipPriorities.find((profile) => profile.target.type === 'Owner');
  const driverContractYears = (id: string) =>
    state.drivers.find((d) => d.id === id)?.contractYearsRemaining ?? 0;

  const handleMakePromise = (driverId: string, promiseType: PromiseType, dueSeason?: number, dueRound?: number) => {
    dispatch({ type: 'MAKE_PROMISE', driverId, promiseType, dueSeason, dueRound });
  };

  const handleReviewRelationship = (profile: RelationshipAttentionProfile) => {
    if (profile.target.type === 'Driver') {
      setActiveSection(activeDrivers.some((driver) => driver.id === profile.target.id) ? 'race' : 'reserve');
      return;
    }
    if (profile.target.type === 'RivalPrincipal') {
      navigate('/rivals');
      return;
    }
    if (profile.target.type === 'Owner') {
      navigate('/teams');
      return;
    }
    navigate('/staff');
  };

  const handleReviewCollective = (profile: CollectiveStakeholderProfile) => {
    navigate(profile.id === 'Commercial' ? '/sponsors' : '/staff');
  };

  return (
    <WorkspaceScreen>
      <WorkspaceHeader
        eyebrow="People center"
        title="Relationship Command Center"
        subtitle="Who holds authority, who has influence, and which relationship needs attention now"
        actions={<Button variant="ghost" onClick={() => navigate('/rivals')}>Rival Matrix</Button>}
      />
      <MetricStrip>
        <WorkspaceMetric label="Must act now" value={commandSummary.mustActNow} detail="Across all hierarchy tiers" />
        <WorkspaceMetric label="Watch closely" value={commandSummary.watchClosely} detail="Across all hierarchy tiers" />
        <WorkspaceMetric
          label="Owner standing"
          value={ownerPriority ? relationshipStatusLabel(ownerPriority.status) : 'Unavailable'}
          detail={ownerPriority ? `Authority #1 · influence ${ownerPriority.influence}` : 'No owner profile'}
        />
        <WorkspaceMetric label="Active promises" value={activePromiseCount} detail="Binding management commitments" />
      </MetricStrip>
      <WorkspaceTabs
        items={[
          { id: 'overview', label: `Priority Board (${commandSummary.active})` },
          { id: 'activity', label: `Activity (${relationshipActivityCount})` },
          { id: 'race', label: 'Race Drivers' },
          { id: 'reserve', label: `Reserve (${reserveDrivers.length})` },
          { id: 'clauses', label: `Clauses & Promises (${contractClauses.length + activePromiseCount})` },
          { id: 'orders', label: `Team Orders (${orders.length})` },
        ]}
        active={activeSection}
        onChange={setActiveSection}
        ariaLabel="Relationship management sections"
      />
      <WorkspaceBody className="space-y-4">
      <div className="ui-decision-strip flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="ui-decision-strip-pulse" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-semibold text-neutral-100">People operations desk</div>
            <div className="truncate text-neutral-400">
              {deskSignal?.status === 'MustActNow' || deskSignal?.status === 'WatchClosely'
                  ? `${deskSignal.title}: ${deskSignal.reason}`
                : 'No immediate relationship response is required. Keep the owner and core team aligned.'}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          {deskSignal
              ? `${relationshipStatusLabel(deskSignal.status)} · Authority #${deskSignal.rank}`
            : 'No active profiles'}
        </span>
      </div>

      {activeSection === 'overview' && (
        <RelationshipPriorityBoard
          profiles={relationshipPriorities}
          onReview={handleReviewRelationship}
          collectiveProfiles={collectiveStakeholders}
          onReviewCollective={handleReviewCollective}
          employerStanding={employerStanding}
          onReviewEmployers={() => navigate('/principal?tab=career')}
          externalTalent={externalTalent}
          onReviewDriverMarket={() => navigate('/market')}
          onReviewStaffMarket={() => navigate('/staff')}
        />
      )}

      {activeSection === 'activity' && <RelationshipActivityPanel state={state} />}

      {/* Race Drivers Section */}
      {activeSection === 'race' && <div>
        <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Race Drivers</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {activeDrivers.map((d) => {
            const rel = rels[d.id];
            if (!rel) {
              return (
                <Panel key={d.id} title={driverName(d.id)}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded bg-[var(--era-accent-soft)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--era-accent-strong)]">
                      Race Driver
                    </span>
                    <span className="text-[11px] text-neutral-500">Relationship data initializing...</span>
                  </div>
                </Panel>
              );
            }
            return (
              <DriverCard
                key={d.id}
                rel={rel}
                driverName={driverName}
                promises={allPromises.filter((p) => p.driverId === d.id)}
                contractYears={driverContractYears(d.id)}
                state={state}
                isRaceDriver
                onMakePromise={handleMakePromise}
              />
            );
          })}
        </div>
      </div>}

      {/* Reserve / Third Driver Section */}
      {activeSection === 'reserve' && reserveDrivers.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Reserve / Third Driver</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {reserveDrivers.map((d) => {
              const rel = rels[d.id];
              if (!rel) {
                return (
                  <Panel key={d.id} title={driverName(d.id)}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
                        Reserve
                      </span>
                      <span className="text-[11px] text-neutral-500">Relationship data initializing...</span>
                    </div>
                  </Panel>
                );
              }
              return (
                <DriverCard
                  key={d.id}
                  rel={rel}
                  driverName={driverName}
                  promises={allPromises.filter((p) => p.driverId === d.id)}
                  contractYears={driverContractYears(d.id)}
                  state={state}
                  onMakePromise={handleMakePromise}
                />
              );
            })}
          </div>
        </div>
      )}
      {activeSection === 'reserve' && reserveDrivers.length === 0 && <Panel title="Reserve / Third Driver"><p className="text-sm text-neutral-500">No reserve or third driver is currently signed.</p></Panel>}

      {/* Empty state if no drivers */}
      {activeSection === 'race' && teamDrivers.length === 0 && (
        <Panel title="No Drivers">
          <p className="text-sm text-neutral-400">Your team has no drivers signed.</p>
        </Panel>
      )}

      {activeSection === 'clauses' && <Panel title="Contract Clauses & Promise Links">
        <p className="mb-3 text-xs text-neutral-400">
          These are binding management commitments. A linked promise updates the clause automatically; a breach affects trust, morale and future negotiations.
        </p>
        {contractClauses.length === 0 ? <p className="text-sm text-neutral-500">No contract clauses are active.</p> : (
          <div className="grid gap-3 lg:grid-cols-2">
            {contractClauses.slice().reverse().map((clause) => (
              <div key={clause.id} className={`rounded border p-3 ${clause.status === 'Breached' ? 'border-red-500/50 bg-red-500/5' : clause.status === 'Active' ? 'border-sky-500/30 bg-neutral-900/50' : 'border-neutral-800 bg-neutral-900/30'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div><div className="font-semibold text-neutral-100">{driverName(clause.partyId)} · {contractClauseLabel(clause.clauseType)}</div><div className="text-[10px] uppercase text-neutral-500">{clause.status} · risk {clause.risk ?? 'Secure'}</div></div>
                  {clause.linkedPromiseId && <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-300">promise linked</span>}
                </div>
                <p className="mt-2 text-xs text-neutral-300">{clause.description}</p>
                <div className="mt-2 text-[11px] text-amber-200">Trigger: {clause.triggerDescription}</div>
                <div className="mt-1 text-[11px] text-red-300">If broken: {clause.breachConsequence}</div>
                {clause.resolutionNote && <div className="mt-1 text-[11px] text-neutral-500">{clause.resolutionNote}</div>}
                {clause.status === 'Breached' && !clause.resolutionNote?.startsWith('Management response:') && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(['Apologize', 'Compensate', 'PromiseCorrection', 'AcceptDamage'] as ContractBreachResponse[]).map((response) => (
                      <Button
                        key={response}
                        variant="ghost"
                        className="px-2 py-1 text-[10px]"
                        disabled={response === 'Compensate' && (clause.renegotiationCost ?? 0) > teamBudget}
                        title={response === 'Compensate' && (clause.renegotiationCost ?? 0) > teamBudget ? 'Insufficient budget for compensation' : undefined}
                        onClick={() => dispatch({ type: 'RESPOND_TO_CONTRACT_BREACH', clauseId: clause.id, response })}
                      >
                        {response === 'PromiseCorrection' ? 'Promise correction' : response}{response === 'Compensate' && clause.renegotiationCost ? ` ($${(clause.renegotiationCost / 1_000_000).toFixed(1)}M)` : ''}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>}

      {activeSection === 'orders' && <Panel title="Team-Order Log (this season)">
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
      </Panel>}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function Bar({ label, value, good }: { label: string; value: number; good: boolean }) {
  const color = ratingColor(good ? value : 100 - value);
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-xs">
        <span className="text-neutral-400">{label}</span>
        <span className="tabular-nums font-medium" style={{ color }}>{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

type DriverCardProps = {
  rel: DriverRelationship;
  driverName: (id: string) => string;
  promises: DriverPromise[];
  contractYears: number;
  state: GameState;
  isRaceDriver?: boolean;
  onMakePromise?: (driverId: string, promiseType: PromiseType, dueSeason?: number, dueRound?: number) => void;
};

function DriverCard({
  rel,
  driverName,
  promises,
  contractYears,
  state,
  isRaceDriver = false,
  onMakePromise,
}: DriverCardProps) {
  const confidenceState = computeConfidenceState(rel);
  const confidenceScore = overallConfidenceScore(rel);
  const perfMod = confidencePerformanceModifier(rel);
  const loyaltyMod = contractLoyaltyModifier(rel);
  const activePromises = promises.filter((p) => p.status === 'active');
  const keptPromises = promises.filter((p) => p.status === 'kept');
  const brokenPromises = promises.filter((p) => p.status === 'broken');
  const expiredPromises = promises.filter((p) => p.status === 'expired');
  const driver = state.drivers.find((d) => d.id === rel.driverId);

  return (
    <Panel
      title={driverName(rel.driverId)}
      actions={driver && (
        <DriverDossierButton
          state={state}
          subject={{ type: 'driver', driver }}
          context={isRaceDriver ? 'Race Driver - relationship file' : 'Reserve - relationship file'}
          focus="relationship"
        />
      )}
    >
      {/* Header badges */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${isRaceDriver ? 'bg-blue-950/60 text-blue-300' : 'bg-neutral-800 text-neutral-400'}`}>
          {isRaceDriver ? 'Race Driver' : 'Reserve'}
        </span>
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

      {/* Core relationship bars */}
      <div className="space-y-2">
        <Bar label="Morale" value={rel.morale} good />
        <Bar label="Team Loyalty" value={rel.teamLoyalty} good />
        <Bar label="Engineer Chemistry" value={rel.engineerChemistry} good />
        {isRaceDriver && (
          <Bar label="Teammate Relationship" value={rel.teammateRelationship} good />
        )}
        <Bar label="Frustration" value={rel.frustration} good={false} />
      </div>

      {/* Confidence / Trust / Ego section */}
      <div className="mt-4 border-t border-neutral-800 pt-3">
        <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">Confidence &amp; Trust</h3>
        <div className="space-y-2">
          <Bar label="Self Confidence" value={rel.selfConfidence} good />
          <Bar label="Trust in Car" value={rel.trustInCar} good />
          <Bar label="Trust in Team" value={rel.trustInTeam} good />
          <Bar label="Trust in Principal" value={rel.trustInPrincipal} good />
          <Bar label="Ego" value={rel.ego} good={false} />
        </div>

        {/* Confidence state badge */}
        <div className="mt-3 flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${CONFIDENCE_STATE_COLORS[confidenceState]}`}>
            {confidenceState}
          </span>
          <span className="text-[11px] text-neutral-500">
            Score: {confidenceScore}/100
          </span>
          <span className={`text-[11px] tabular-nums ${perfMod >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {perfMod >= 0 ? '+' : ''}{(perfMod * 100).toFixed(0)}% pace
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">{confidenceStateDescription(confidenceState)}</p>

        {/* Trust descriptions */}
        <div className="mt-2 space-y-1">
          <p className="text-[11px] text-neutral-500">{trustLevelDescription('Trust in Car', rel.trustInCar)}</p>
          <p className="text-[11px] text-neutral-500">{trustLevelDescription('Trust in Team', rel.trustInTeam)}</p>
          <p className="text-[11px] text-neutral-500">{trustLevelDescription('Trust in Principal', rel.trustInPrincipal)}</p>
        </div>

        {/* Ego description */}
        <p className="mt-2 text-[11px] text-neutral-500">{egoDescription(rel.ego)}</p>
      </div>

      {/* Personality traits */}
      {rel.personalityTraits.length > 0 && (
        <div className="mt-4 border-t border-neutral-800 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">Personality</h3>
          <div className="flex flex-wrap gap-1.5">
            {rel.personalityTraits.map((trait) => (
              <span
                key={trait}
                className="rounded bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300"
              >
                {trait}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Wants */}
      {rel.wants.length > 0 && (
        <div className="mt-4 border-t border-neutral-800 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">Current Wants</h3>
          <ul className="space-y-1.5">
            {rel.wants.map((want) => (
              <li key={want} className="flex items-start gap-2">
                <span className="mt-0.5 rounded bg-indigo-950/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-indigo-300 whitespace-nowrap">
                  {WANT_LABELS[want]}
                </span>
                <span className="text-[11px] text-neutral-500">{wantDescription(want)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Promises */}
      {promises.length > 0 && (
        <div className="mt-4 border-t border-neutral-800 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">Promises</h3>

          {activePromises.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-[11px] font-medium text-neutral-400">Active</p>
              <ul className="space-y-1">
                {activePromises.map((p) => (
                  <li key={p.id}>
                    <PromiseProgress promise={p} state={state} driverName={driverName} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {keptPromises.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-[11px] font-medium text-neutral-400">Kept</p>
              <ul className="space-y-1">
                {keptPromises.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-[11px]">
                    <span className="rounded bg-green-950/60 px-1.5 py-0.5 text-green-300">
                      {PROMISE_TYPE_LABELS[p.promiseType]}
                    </span>
                    <span className="text-neutral-600">Fulfilled</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {brokenPromises.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-[11px] font-medium text-neutral-400">Broken</p>
              <ul className="space-y-1">
                {brokenPromises.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-[11px]">
                    <span className="rounded bg-red-950/60 px-1.5 py-0.5 text-red-300">
                      {PROMISE_TYPE_LABELS[p.promiseType]}
                    </span>
                    <span className="text-neutral-600">Trust impact: {p.trustImpact}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {expiredPromises.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-medium text-neutral-400">Expired</p>
              <ul className="space-y-1">
                {expiredPromises.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-[11px]">
                    <span className="rounded bg-neutral-700 px-1.5 py-0.5 text-neutral-400">
                      {PROMISE_TYPE_LABELS[p.promiseType]}
                    </span>
                    <span className="text-neutral-600">Deadline passed unmet</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Contract loyalty risk */}
      <div className="mt-4 border-t border-neutral-800 pt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase text-neutral-500">Contract Loyalty</h3>
          <span className="text-[11px] tabular-nums text-neutral-400">
            {contractYears} yr{contractYears === 1 ? '' : 's'} left
          </span>
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">{loyaltyRiskText(loyaltyMod)}</p>
      </div>

      {/* Promise actions */}
      {onMakePromise && (
        <PromiseMaker
          driverId={rel.driverId}
          activePromises={activePromises}
          onMakePromise={onMakePromise}
        />
      )}
    </Panel>
  );
}

const PROMISE_OPTIONS: PromiseType[] = [
  'equal_treatment',
  'number_one_status',
  'improved_reliability',
  'development_priority',
  'contract_renewal',
  'promotion',
  'reserve_practice_time',
  'no_midseason_replacement',
  'better_strategy_support',
  'priority_upgrades',
  'fight_teammate',
  'calmer_risk_approach',
];

function PromiseMaker({
  driverId,
  activePromises,
  onMakePromise,
}: {
  driverId: string;
  activePromises: DriverPromise[];
  onMakePromise: (driverId: string, promiseType: PromiseType, dueSeason?: number, dueRound?: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<PromiseType>('equal_treatment');
  const [dueRound, setDueRound] = useState<string>('');

  const activeTypes = new Set(activePromises.map((p) => p.promiseType));
  const isDuplicate = activeTypes.has(selectedType);

  const handleSubmit = () => {
    if (isDuplicate) return;
    const round = dueRound ? parseInt(dueRound, 10) : undefined;
    onMakePromise(driverId, selectedType, undefined, round);
    setShowForm(false);
    setDueRound('');
  };

  return (
    <div className="mt-4 border-t border-neutral-800 pt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-neutral-500">Make a Promise</h3>
        {!showForm && (
          <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => setShowForm(true)}>
            + New Promise
          </Button>
        )}
      </div>

      {showForm && (
        <div className="mt-2 space-y-2 rounded-lg bg-neutral-800/40 p-3">
          <select
            className="w-full rounded bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as PromiseType)}
          >
            {PROMISE_OPTIONS.map((pt) => (
              <option key={pt} value={pt} disabled={activeTypes.has(pt)}>
                {PROMISE_TYPE_LABELS[pt]}{activeTypes.has(pt) ? ' (active)' : ''}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Due round (optional)"
              className="w-40 rounded bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 placeholder-neutral-600"
              value={dueRound}
              onChange={(e) => setDueRound(e.target.value)}
            />
            <Button variant="primary" className="px-3 py-1 text-xs" onClick={handleSubmit} disabled={isDuplicate}>
              Make Promise
            </Button>
            <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
          {isDuplicate && (
            <p className="text-[10px] text-amber-400">
              An active promise of this type already exists for this driver. Resolve it first.
            </p>
          )}
          <p className="text-[10px] text-neutral-600">
            Making a promise boosts trust immediately. The game will judge fulfillment from race results, team orders, contracts, development, and season progress.
          </p>
        </div>
      )}
    </div>
  );
}

function PromiseProgress({
  promise,
  state,
  driverName,
}: {
  promise: DriverPromise;
  state: GameState;
  driverName: (id: string) => string;
}) {
  const progress = promiseProgress(promise, state);
  const toneClass = {
    good: 'bg-green-500',
    watch: 'bg-amber-400',
    bad: 'bg-red-500',
    neutral: 'bg-blue-400',
  }[progress.tone];
  const statusClass = {
    good: 'text-green-300',
    watch: 'text-amber-300',
    bad: 'text-red-300',
    neutral: 'text-blue-300',
  }[progress.tone];

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/35 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-blue-950/60 px-1.5 py-0.5 text-blue-300">
            {PROMISE_TYPE_LABELS[promise.promiseType]}
          </span>
          <span className={`text-[11px] font-semibold ${statusClass}`}>{progress.status}</span>
        </div>
        <span className="text-[10px] text-neutral-500">{progress.deadline}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800" aria-label={`${PROMISE_TYPE_LABELS[promise.promiseType]} promise progress for ${driverName(promise.driverId)}`}>
        <div className={`h-full ${toneClass}`} style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="mt-1 flex items-start justify-between gap-3">
        <p className="text-[11px] text-neutral-500">{progress.detail}</p>
        <span className="shrink-0 text-[11px] tabular-nums text-neutral-400">{progress.percent}%</span>
      </div>
    </div>
  );
}
