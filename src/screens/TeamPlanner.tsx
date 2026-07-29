import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '../components/Button';
import { formatMoney } from '../components/ui';
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
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import { activeDriversForTeam } from '../game/careerState';
import { useGame } from '../game/GameContext';
import { workflowDestination } from '../components/layoutWorkflow';
import {
  buildTeamPlanner,
  plannerHorizon,
  type PlannerCandidate,
  type PlannerHorizonId,
  type PlannerSeat,
} from './teamPlannerViewModel';

type PlannerPlacements = Record<string, string>;

function placementKey(horizonId: PlannerHorizonId, seatId: string): string {
  return `${horizonId}:${seatId}`;
}

function readPlacements(storageKey: string): PlannerPlacements {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
}

function seatTone(status: PlannerSeat['status']): string {
  if (status === 'vacant') return 'is-danger';
  if (status === 'weak' || status === 'expiring') return 'is-warning';
  if (status === 'secure') return 'is-secure';
  return '';
}

function candidateSourceLabel(candidate: PlannerCandidate): string {
  return candidate.source === 'academy' ? 'Academy' : 'Recruitment shortlist';
}

export function TeamPlanner() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const planner = useMemo(() => state ? buildTeamPlanner(state) : undefined, [state]);
  const requestedHorizon = searchParams.get('horizon');
  const requestedCandidate = searchParams.get('candidate');
  const horizon = planner ? plannerHorizon(planner, requestedHorizon) : undefined;
  const storageKey = state ? `team-planner:${state.id}:${state.selectedTeamId}:${state.seasonYear}` : '';
  const [placementState, setPlacementState] = useState<{ key: string; values: PlannerPlacements }>(() => ({
    key: storageKey,
    values: storageKey ? readPlacements(storageKey) : {},
  }));
  const placements = placementState.key === storageKey
    ? placementState.values
    : readPlacements(storageKey);
  const nextAction = state ? workflowDestination(state) : undefined;

  useEffect(() => {
    if (!storageKey) return;
    sessionStorage.setItem(storageKey, JSON.stringify(placements));
  }, [placements, storageKey]);

  if (!state || !planner || !horizon) return null;

  const selectedCandidate = horizon.candidates.find((candidate) => candidate.id === requestedCandidate)
    ?? horizon.candidates[0];
  const activeDrivers = activeDriversForTeam(state, state.selectedTeamId);
  const negotiationSeat = activeDrivers[0];
  const hypotheticalCoverage = horizon.seats.filter((seat) =>
    Boolean(placements[placementKey(horizon.id, seat.id)]),
  ).length;
  const remainingRequiredGaps = horizon.seats.filter((seat) =>
    seat.required
    && seat.status === 'vacant'
    && !placements[placementKey(horizon.id, seat.id)],
  ).length;

  const updateQuery = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  const setPlacement = (seatId: string, candidateId: string) => {
    const key = placementKey(horizon.id, seatId);
    setPlacementState((current) => {
      const values = current.key === storageKey ? current.values : readPlacements(storageKey);
      const next = { ...values };
      for (const existingKey of Object.keys(next)) {
        if (existingKey.startsWith(`${horizon.id}:`) && next[existingKey] === candidateId) {
          delete next[existingKey];
        }
      }
      if (candidateId) next[key] = candidateId;
      else delete next[key];
      return { key: storageKey, values: next };
    });
  };

  const clearHorizon = () => {
    setPlacementState((current) => {
      const values = current.key === storageKey ? current.values : readPlacements(storageKey);
      return {
        key: storageKey,
        values: Object.fromEntries(
          Object.entries(values).filter(([key]) => !key.startsWith(`${horizon.id}:`)),
        ),
      };
    });
  };

  const candidateAction = (candidate: PlannerCandidate) => {
    if (candidate.source === 'academy') {
      navigate(candidate.actionRoute);
      return;
    }
    if (candidate.knowledge < 100) {
      dispatch({ type: 'SCOUT_TARGET', entityId: candidate.entityId, entityType: 'Driver' });
      navigate(`/scouting?tab=senior&target=${encodeURIComponent(candidate.entityId)}`);
      return;
    }
    if (negotiationSeat && horizon.id !== 'current') {
      navigate(`/market/${encodeURIComponent(candidate.entityId)}/negotiate/${encodeURIComponent(negotiationSeat.id)}`);
      return;
    }
    navigate(candidate.actionRoute);
  };

  const commitmentGroups = ['Staff', 'Engine', 'Sponsor', 'Technical'] as const;

  return (
    <WorkspaceScreen className="era-feature-screen ui-team-planner-screen">
      <WorkspaceHeader
        eyebrow="Long-term organization planning"
        title="Motorsport Team Planner"
        subtitle={`${planner.teamName} · Safe what-if planning across ${state.seasonYear}–${state.seasonYear + 2}`}
        actions={<span className="ui-team-planner-safe">Planning only · no contracts changed</span>}
      />

      <WorkspaceTabs
        items={planner.horizons.map((item) => ({
          id: item.id,
          label: `${item.label} · ${item.year}`,
        }))}
        active={horizon.id}
        onChange={(id) => updateQuery({ horizon: id, candidate: undefined })}
        ariaLabel="Team planning horizons"
      />

      <MetricStrip>
        <WorkspaceMetric
          label="Required lineup gaps"
          value={remainingRequiredGaps}
          detail={hypotheticalCoverage ? `${hypotheticalCoverage} position${hypotheticalCoverage === 1 ? '' : 's'} provisionally covered` : 'Before provisional placements'}
        />
        <WorkspaceMetric
          label="Known annual costs"
          value={formatMoney(horizon.committedCosts)}
          detail="Drivers, academy, staff and engine"
        />
        <WorkspaceMetric
          label="Known annual income"
          value={formatMoney(horizon.committedIncome)}
          detail="Committed sponsor value"
        />
        <WorkspaceMetric
          label="Projected headroom"
          value={formatMoney(horizon.projectedHeadroom)}
          detail="No prize money or future offers assumed"
        />
      </MetricStrip>

      <WorkspaceBody className="overflow-hidden">
        <FmWorkspaceGrid columns="three" className="ui-team-planner-grid">
          <FmPane className="ui-team-planner-seats">
            <FmPaneHeader title={`${horizon.year} seats`} meta={`${horizon.seats.length} planning positions`} />
            <FmPaneBody className="overflow-auto">
              {horizon.seats.map((seat) => {
                const key = placementKey(horizon.id, seat.id);
                const provisional = horizon.candidates.find((candidate) => candidate.id === placements[key]);
                const eligibleCandidates = horizon.candidates.filter((candidate) => candidate.readyYear <= horizon.year);
                return (
                  <section key={seat.id} className={`ui-team-planner-seat ${seatTone(seat.status)}`}>
                    <header>
                      <div>
                        <span>{seat.kind === 'race' ? 'Race programme' : 'Support programme'}</span>
                        <strong>{seat.label}{seat.required ? ' · Required' : ''}</strong>
                      </div>
                      <em>{provisional ? 'Provisional' : seat.status}</em>
                    </header>
                    <div className="ui-team-planner-seat-name">
                      {provisional?.name ?? seat.occupant?.name ?? 'Unfilled'}
                    </div>
                    <p>
                      {provisional
                        ? `${candidateSourceLabel(provisional)} placement. No contract or morale effect.`
                        : seat.detail}
                    </p>
                    <label>
                      What-if placement
                      <select value={placements[key] ?? ''} onChange={(event) => setPlacement(seat.id, event.target.value)}>
                        <option value="">Use committed position</option>
                        {eligibleCandidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name} · {candidateSourceLabel(candidate)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </section>
                );
              })}
            </FmPaneBody>
          </FmPane>

          <FmPane className="ui-team-planner-candidates">
            <FmPaneHeader title="Planning pool" meta={`${horizon.candidates.length} academy and shortlisted options`} />
            <FmPaneBody className="overflow-auto">
              {horizon.candidates.length === 0 ? (
                <div className="ui-team-planner-empty">
                  <strong>No planning candidates</strong>
                  <p>Add external drivers to the recruitment shortlist or develop academy prospects.</p>
                  <Button variant="primary" onClick={() => navigate('/scouting?tab=senior')}>Open Scouting</Button>
                </div>
              ) : (
                horizon.candidates.map((candidate) => (
                  <FmListButton
                    key={candidate.id}
                    active={candidate.id === selectedCandidate?.id}
                    urgent={candidate.readyYear > horizon.year}
                    onClick={() => updateQuery({ candidate: candidate.id })}
                  >
                    <span>
                      <strong>{candidate.name}</strong>
                      <small>{candidateSourceLabel(candidate)} · Ready {candidate.readyYear}</small>
                    </span>
                    <span>
                      <strong>{candidate.overall}</strong>
                      <small>OVR · POT {candidate.potential}</small>
                    </span>
                  </FmListButton>
                ))
              )}
            </FmPaneBody>
            {selectedCandidate && (
              <div className="ui-team-planner-candidate-detail">
                <FmKeyValue label="Source" value={candidateSourceLabel(selectedCandidate)} />
                <FmKeyValue label="Known ability" value={`${selectedCandidate.overall} / ${selectedCandidate.potential} potential`} />
                <FmKeyValue label="Knowledge" value={`${selectedCandidate.knowledge}%`} />
                <FmKeyValue label="Estimated annual cost" value={formatMoney(selectedCandidate.annualCost)} />
                <Button
                  variant="primary"
                  disabled={selectedCandidate.readyYear > horizon.year}
                  onClick={() => candidateAction(selectedCandidate)}
                >
                  {selectedCandidate.readyYear > horizon.year
                    ? `Available from ${selectedCandidate.readyYear}`
                    : selectedCandidate.source === 'academy'
                      ? 'Review academy pathway'
                      : selectedCandidate.knowledge < 100
                        ? 'Assign scouting'
                        : horizon.id === 'current'
                          ? 'Open market profile'
                          : 'Open negotiation'}
                </Button>
              </div>
            )}
          </FmPane>

          <FmPane className="ui-team-planner-commitments">
            <FmPaneHeader title="Commitments & gaps" meta={`${horizon.gaps.length} attention item${horizon.gaps.length === 1 ? '' : 's'}`} />
            <FmPaneBody className="overflow-auto">
              <section className="ui-team-planner-gap-list">
                <h3>Attention required</h3>
                {horizon.gaps.length === 0 ? (
                  <p className="ui-team-planner-clear">No known structural gap for this horizon.</p>
                ) : horizon.gaps.map((gap) => (
                  <button key={gap.id} type="button" className={gap.severity} onClick={() => navigate(gap.actionRoute)}>
                    <strong>{gap.label}</strong>
                    <span>{gap.detail}</span>
                    <em>{gap.actionLabel} →</em>
                  </button>
                ))}
              </section>
              {commitmentGroups.map((category) => {
                const entries = horizon.commitments.filter((entry) => entry.category === category);
                return (
                  <section key={category} className="ui-team-planner-commitment-group">
                    <h3>{category}</h3>
                    {entries.length === 0 ? (
                      <p>No {category.toLocaleLowerCase()} commitment covers this horizon.</p>
                    ) : entries.map((entry) => (
                      <button key={entry.id} type="button" onClick={() => navigate(entry.actionRoute)}>
                        <span>
                          <strong>{entry.name}</strong>
                          <small>{entry.detail}</small>
                        </span>
                        <em className={entry.tone}>
                          {entry.annualAmount === 0 ? 'Carryover' : formatMoney(Math.abs(entry.annualAmount))}
                        </em>
                      </button>
                    ))}
                  </section>
                );
              })}
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
      </WorkspaceBody>

      <FmDecisionBar
        actions={(
          <>
            <Button variant="ghost" onClick={clearHorizon}>Clear what-if placements</Button>
            <Button variant="secondary" onClick={() => navigate('/finance')}>Review Finance</Button>
            {state?.seasonComplete && state.gameMode === 'Career' ? (
              <Button variant="primary" onClick={() => navigate('/offseason')}>Open Offseason</Button>
            ) : nextAction ? (
              <Button variant="primary" onClick={() => navigate(nextAction.to)}>{nextAction.label}</Button>
            ) : null}
          </>
        )}
      >
        <strong>{horizon.label} · {horizon.year}</strong>
        <span>Provisional placements remain in this browser session only. Real scouting, negotiation, and signing decisions use the existing career workflows.</span>
      </FmDecisionBar>
    </WorkspaceScreen>
  );
}
