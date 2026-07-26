import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Button } from '../components/Button';
import { WorkspaceBody, WorkspaceHeader, WorkspaceScreen } from '../components/workspace/Workspace';
import {
  FmDecisionBar,
  FmKeyValue,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
import { formatMoney } from '../components/ui';
import { contractClauseLabel, DRIVER_NEGOTIATION_CLAUSES } from '../sim/phase18ContractClauseEngine';
import { driverNegotiationSalaryBase } from '../sim/driverContractNegotiationEngine';
import type { DriverContractRole } from '../game/careerState';
import type { ContractClauseType } from '../types/phase18Types';
import { contractNegotiationView } from './contractNegotiationViewModel';

const ROLES: Array<{ value: DriverContractRole; label: string }> = [
  { value: 'seat', label: 'Race seat' },
  { value: 'third', label: 'Third driver' },
  { value: 'reserve', label: 'Reserve' },
  { value: 'test', label: 'Test driver' },
];

export function DriverContractNegotiation() {
  const { state, dispatch } = useGame();
  const { driverId } = useParams();
  const navigate = useNavigate();
  const driver = state?.drivers.find((entry) => entry.id === driverId && entry.teamId === state.selectedTeamId);

  useEffect(() => {
    if (state && driver && state.contractNegotiation?.driverId !== driver.id) {
      dispatch({ type: 'START_DRIVER_CONTRACT_NEGOTIATION', driverId: driver.id });
    }
  }, [dispatch, driver, state]);

  if (!state) return null;
  if (!driver) {
    return (
      <WorkspaceScreen>
        <WorkspaceHeader eyebrow="Contract desk" title="Negotiation unavailable" subtitle="This driver is not under contract with your team." />
        <WorkspaceBody><Button onClick={() => navigate('/drivers')}>Back to Drivers</Button></WorkspaceBody>
      </WorkspaceScreen>
    );
  }
  const negotiation = state.contractNegotiation?.driverId === driver.id ? state.contractNegotiation : undefined;
  if (!negotiation) {
    return <WorkspaceScreen><WorkspaceHeader eyebrow="Contract desk" title={`Opening talks with ${driver.name}`} subtitle="Preparing the driver's current demands." /></WorkspaceScreen>;
  }

  const view = contractNegotiationView(state, negotiation);
  const salaryBase = driverNegotiationSalaryBase(driver, negotiation.years);
  const salaryMax = Math.max(negotiation.askingSalary, Math.round(salaryBase * 2.5 * 10) / 10);
  const toneClass = view.tone === 'positive' ? 'is-positive' : view.tone === 'warning' ? 'is-warning' : 'is-negative';
  const availableBudget = state.teams.find((team) => team.id === state.selectedTeamId)?.budget ?? 0;
  const roleLabel = ROLES.find((role) => role.value === negotiation.role)?.label ?? negotiation.role;
  const update = (patch: {
    offeredSalary?: number;
    years?: number;
    role?: DriverContractRole;
    clauseType?: ContractClauseType;
  }) => dispatch({ type: 'UPDATE_DRIVER_CONTRACT_NEGOTIATION', ...patch });

  return (
    <WorkspaceScreen className="era-feature-screen ui-recruitment-screen ui-negotiation-room">
      <WorkspaceHeader
        eyebrow="Contract desk"
        title={`Negotiate with ${driver.name}`}
        subtitle="Build the package, read the agent's response, and commit only when the terms work."
        actions={<Button variant="ghost" onClick={() => { dispatch({ type: 'CANCEL_DRIVER_CONTRACT_NEGOTIATION' }); navigate('/drivers'); }}>Cancel talks</Button>}
      />
      <WorkspaceBody className="overflow-hidden">
        <FmWorkspaceGrid columns="three" className="ui-negotiation-grid">
          <FmPane className="ui-negotiation-agent-pane">
            <FmPaneHeader title="Driver & Agent" meta="Opening position" />
            <FmPaneBody className="overflow-auto">
              <section className="ui-negotiation-identity">
                <span>Current driver</span>
                <strong>{driver.name}</strong>
                <p>{driver.number ? `Car #${driver.number} · ` : ''}{roleLabel} · {driver.contractYearsRemaining ?? 1} year contract</p>
              </section>
              <section>
                <h3>Agent demands</h3>
                <FmKeyValue label="Annual salary" value={`$${negotiation.askingSalary.toFixed(1)}M`} />
                <FmKeyValue label="Added term" value={`${negotiation.years} year${negotiation.years === 1 ? '' : 's'}`} />
                <FmKeyValue label="Role" value={roleLabel} />
                <FmKeyValue label="Clause" value={contractClauseLabel(negotiation.clauseType)} />
              </section>
              {negotiation.response === 'countered' && (
                <section className="ui-negotiation-response is-warning">
                  <strong>Agent counter</strong>
                  <p>The driver will continue talks at ${negotiation.counterSalary?.toFixed(1)}M per year.</p>
                  <Button variant="secondary" onClick={() => update({ offeredSalary: negotiation.counterSalary })}>Match counter</Button>
                </section>
              )}
              {negotiation.response === 'refused' && (
                <section className="ui-negotiation-response is-negative">
                  <strong>Offer refused</strong>
                  <p>The package is too far from the driver’s expectations. Improve it to reopen meaningful talks.</p>
                </section>
              )}
            </FmPaneBody>
          </FmPane>

          <FmPane className="ui-negotiation-terms-pane">
            <FmPaneHeader title="Contract Proposal" meta="Editable terms" />
            <FmPaneBody className="ui-negotiation-fields overflow-auto">
              <label>Annual salary <strong>${negotiation.offeredSalary.toFixed(1)}M</strong>
                <input type="range" min={0.1} max={salaryMax} step={0.1} value={negotiation.offeredSalary} onChange={(event) => update({ offeredSalary: Number(event.target.value) })} />
              </label>
              <label>Added years
                <select value={negotiation.years} onChange={(event) => update({ years: Number(event.target.value) })}>
                  {Array.from({ length: view.maxAddedYears }, (_, index) => index + 1).map((years) => <option key={years} value={years}>{years} year{years === 1 ? '' : 's'}</option>)}
                </select>
              </label>
              <label>Squad role
                <select value={negotiation.role} onChange={(event) => update({ role: event.target.value as DriverContractRole })}>
                  {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                </select>
              </label>
              <label>Contract clause
                <select value={negotiation.clauseType} onChange={(event) => update({ clauseType: event.target.value as ContractClauseType })}>
                  {DRIVER_NEGOTIATION_CLAUSES.map((clause) => <option key={clause} value={clause}>{contractClauseLabel(clause)}</option>)}
                </select>
              </label>
            </FmPaneBody>
          </FmPane>

          <FmPane className="ui-negotiation-context-pane">
            <FmPaneHeader title="Negotiation Context" meta="Deterministic assessment" />
            <FmPaneBody className="overflow-auto">
              <div className={`ui-negotiation-likelihood ${toneClass}`}>{view.likelihoodLabel}</div>
              <p>The readout combines relationship, team pull, ambition, contract security, clause, future intention, term, and salary.</p>
              <section>
                <FmKeyValue label="Signing fee" value={formatMoney(view.signingFee)} />
                <FmKeyValue label="Available budget" value={formatMoney(availableBudget)} />
                <FmKeyValue label="Current total term" value={`${driver.contractYearsRemaining ?? 1} years`} />
                <FmKeyValue label="Maximum contract" value="5 total years" />
              </section>
              {view.disabledReason && <div className="ui-negotiation-disabled">{view.disabledReason}</div>}
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
        <FmDecisionBar
          actions={<Button variant="primary" disabled={!view.canSubmit} title={view.disabledReason} onClick={() => dispatch({ type: 'SUBMIT_DRIVER_CONTRACT_NEGOTIATION' })}>Submit formal offer</Button>}
        >
          <strong>{driver.name} · ${negotiation.offeredSalary.toFixed(1)}M · {negotiation.years} year{negotiation.years === 1 ? '' : 's'}</strong>
          <span>{view.disabledReason ?? `${view.likelihoodLabel}; signing fee ${formatMoney(view.signingFee)}.`}</span>
        </FmDecisionBar>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}
