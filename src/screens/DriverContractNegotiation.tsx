import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { MetricStrip, WorkspaceBody, WorkspaceHeader, WorkspaceMetric, WorkspaceScreen } from '../components/workspace/Workspace';
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
  if (!driver) return <WorkspaceScreen><WorkspaceHeader eyebrow="Contract desk" title="Negotiation unavailable" subtitle="This driver is not under contract with your team." /><WorkspaceBody><Button onClick={() => navigate('/drivers')}>Back to Drivers</Button></WorkspaceBody></WorkspaceScreen>;
  const negotiation = state.contractNegotiation?.driverId === driver.id ? state.contractNegotiation : undefined;
  if (!negotiation) return <WorkspaceScreen><WorkspaceHeader eyebrow="Contract desk" title={`Opening talks with ${driver.name}`} subtitle="Preparing the driver's current demands." /></WorkspaceScreen>;

  const view = contractNegotiationView(state, negotiation);
  const salaryBase = driverNegotiationSalaryBase(driver, negotiation.years);
  const salaryMax = Math.max(negotiation.askingSalary, Math.round(salaryBase * 2.5 * 10) / 10);
  const toneClass = view.tone === 'positive' ? 'border-green-500/40 bg-green-500/10 text-green-300' : view.tone === 'warning' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-red-500/40 bg-red-500/10 text-red-300';
  const update = (patch: { offeredSalary?: number; years?: number; role?: DriverContractRole; clauseType?: ContractClauseType }) => dispatch({ type: 'UPDATE_DRIVER_CONTRACT_NEGOTIATION', ...patch });

  return (
    <WorkspaceScreen className="era-feature-screen">
      <WorkspaceHeader eyebrow="Contract desk" title={`Negotiate with ${driver.name}`} subtitle="Build the package, read the agent's response, and commit only when the terms work." actions={<Button variant="ghost" onClick={() => { dispatch({ type: 'CANCEL_DRIVER_CONTRACT_NEGOTIATION' }); navigate('/drivers'); }}>Cancel talks</Button>} />
      <MetricStrip>
        <WorkspaceMetric label="Current term" value={`${driver.contractYearsRemaining ?? 1} years`} detail="Maximum five total years" />
        <WorkspaceMetric label="Agent demand" value={`$${negotiation.askingSalary.toFixed(1)}M`} detail="Annual salary" />
        <WorkspaceMetric label="Signing fee" value={formatMoney(view.signingFee)} detail="Charged immediately if accepted" />
        <WorkspaceMetric label="Available budget" value={formatMoney(state.teams.find((team) => team.id === state.selectedTeamId)?.budget ?? 0)} detail="Team balance" />
      </MetricStrip>
      <WorkspaceBody className="space-y-4">
        <Panel title="Agent and driver demand">
          <p className="text-sm text-neutral-300">The opening position is <strong>${negotiation.askingSalary.toFixed(1)}M per year</strong> for {negotiation.years} added year{negotiation.years === 1 ? '' : 's'}, a {ROLES.find((role) => role.value === negotiation.role)?.label.toLowerCase()} role, and {contractClauseLabel(negotiation.clauseType)}.</p>
          {negotiation.response === 'countered' && <div className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">Counter offer: the driver is willing to continue talks at ${negotiation.counterSalary?.toFixed(1)}M per year.<Button className="ml-3 px-2 py-1 text-xs" onClick={() => update({ offeredSalary: negotiation.counterSalary })}>Match counter</Button></div>}
          {negotiation.response === 'refused' && <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">The package is too far from the driver's expectations. Improve the offer to reopen meaningful talks.</div>}
        </Panel>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel title="Your offer">
            <label className="block text-xs font-semibold text-neutral-300">Annual salary · ${negotiation.offeredSalary.toFixed(1)}M
              <input className="mt-2 w-full accent-amber-400" type="range" min={0.1} max={salaryMax} step={0.1} value={negotiation.offeredSalary} onChange={(event) => update({ offeredSalary: Number(event.target.value) })} />
            </label>
            <label className="mt-5 block text-xs font-semibold text-neutral-300">Added years
              <select className="mt-2 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2" value={negotiation.years} onChange={(event) => update({ years: Number(event.target.value) })}>{Array.from({ length: view.maxAddedYears }, (_, index) => index + 1).map((years) => <option key={years} value={years}>{years} year{years === 1 ? '' : 's'}</option>)}</select>
            </label>
            <label className="mt-5 block text-xs font-semibold text-neutral-300">Role
              <select className="mt-2 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2" value={negotiation.role} onChange={(event) => update({ role: event.target.value as DriverContractRole })}>{ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select>
            </label>
            <label className="mt-5 block text-xs font-semibold text-neutral-300">Contract clause
              <select className="mt-2 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2" value={negotiation.clauseType} onChange={(event) => update({ clauseType: event.target.value as ContractClauseType })}>{DRIVER_NEGOTIATION_CLAUSES.map((clause) => <option key={clause} value={clause}>{contractClauseLabel(clause)}</option>)}</select>
            </label>
          </Panel>
          <Panel title="Negotiation readout">
            <div className={`rounded border p-3 text-sm font-bold ${toneClass}`}>{view.likelihoodLabel}</div>
            <p className="mt-3 text-xs leading-5 text-neutral-400">This readout is derived from the driver's relationship with the team, team pull, ambition, contract security, clause, future intentions, term, and salary package.</p>
            <Button variant="primary" className="mt-5 w-full" disabled={!view.canSubmit} title={view.disabledReason} onClick={() => dispatch({ type: 'SUBMIT_DRIVER_CONTRACT_NEGOTIATION' })}>Submit formal offer</Button>
            {view.disabledReason && <p className="mt-2 text-xs text-red-300">{view.disabledReason}</p>}
          </Panel>
        </div>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}
