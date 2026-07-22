import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getStaffPool } from '../data';
import { useGame } from '../game/GameContext';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { MetricStrip, WorkspaceBody, WorkspaceHeader, WorkspaceMetric, WorkspaceScreen } from '../components/workspace/Workspace';
import { formatMoney } from '../components/ui';
import { staffNegotiationView } from './personnelNegotiationViewModel';

export function StaffContractNegotiation() {
  const { state, dispatch } = useGame();
  const { staffId } = useParams();
  const navigate = useNavigate();
  const member = state ? [...(state.staff ?? []), ...getStaffPool(state.seasonYear, state.series)].find((entry) => entry.id === staffId) : undefined;
  useEffect(() => {
    if (state && member && state.staffContractNegotiation?.staffId !== member.id) dispatch({ type: 'START_STAFF_CONTRACT_NEGOTIATION', staffId: member.id });
  }, [dispatch, member, state]);
  if (!state) return null;
  if (!member) return <WorkspaceScreen><WorkspaceHeader eyebrow="Contract desk" title="Negotiation unavailable" subtitle="This specialist is no longer available." /><WorkspaceBody><Button onClick={() => navigate('/staff')}>Back to Staff</Button></WorkspaceBody></WorkspaceScreen>;
  const negotiation = state.staffContractNegotiation?.staffId === member.id ? state.staffContractNegotiation : undefined;
  if (!negotiation) return <WorkspaceScreen><WorkspaceHeader eyebrow="Contract desk" title={`Opening talks with ${member.name}`} subtitle="Preparing the representative's demands." /></WorkspaceScreen>;
  const view = staffNegotiationView(state, negotiation);
  const tone = view.tone === 'positive' ? 'border-green-500/40 bg-green-500/10 text-green-300' : view.tone === 'warning' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-red-500/40 bg-red-500/10 text-red-300';
  const update = (patch: { offerMultiplier?: number; years?: number }) => dispatch({ type: 'UPDATE_STAFF_CONTRACT_NEGOTIATION', ...patch });
  return (
    <WorkspaceScreen>
      <WorkspaceHeader eyebrow="Staff contracts" title={`${negotiation.mode === 'hire' ? 'Recruit' : 'Renew'} ${member.name}`} subtitle={`${member.role} · deterministic demand, offer, and counter negotiation`} actions={<Button variant="ghost" onClick={() => { dispatch({ type: 'CANCEL_STAFF_CONTRACT_NEGOTIATION' }); navigate('/staff'); }}>Cancel talks</Button>} />
      <MetricStrip><WorkspaceMetric label="Representative demand" value={`${negotiation.askingMultiplier.toFixed(1)}×`} detail="Salary and signing package" /><WorkspaceMetric label="Current salary" value={`$${member.salary.toFixed(1)}M`} detail="Annual wage" /><WorkspaceMetric label="Attempts remaining" value={negotiation.attemptsRemaining} detail="Patience before walkaway" /><WorkspaceMetric label="Immediate cost" value={formatMoney(view.immediateCost)} detail="Fee, compensation, and replacement cost" /></MetricStrip>
      <WorkspaceBody className="space-y-4">
        {negotiation.response === 'countered' && <Panel title="Representative counter"><p className="text-sm text-amber-200">Talks can continue at {negotiation.counterMultiplier?.toFixed(1)}× the base package.</p><Button className="mt-2 px-2 py-1 text-xs" onClick={() => update({ offerMultiplier: negotiation.counterMultiplier })}>Match counter</Button></Panel>}
        {negotiation.response === 'refused' && <Panel title="Talks ended"><p className="text-sm text-red-300">The representative has rejected the package and ended this negotiation.</p></Panel>}
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel title="Your package"><label className="block text-xs font-semibold text-neutral-300">Package strength · {negotiation.offerMultiplier.toFixed(1)}×<input className="mt-2 w-full accent-amber-400" type="range" min={1} max={2.5} step={0.1} value={negotiation.offerMultiplier} onChange={(event) => update({ offerMultiplier: Number(event.target.value) })} /></label><label className="mt-5 block text-xs font-semibold text-neutral-300">Contract length<select className="mt-2 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2" value={negotiation.years} onChange={(event) => update({ years: Number(event.target.value) })}>{[1,2,3,4,5].map((years) => <option key={years} value={years}>{years} year{years === 1 ? '' : 's'}</option>)}</select></label></Panel>
          <Panel title="Representative response"><div className={`rounded border p-3 text-sm font-bold ${tone}`}>{view.label}</div><p className="mt-3 text-xs leading-5 text-neutral-400">The readout includes relationship, future intent, role quality, employment status, prior recruitment approach, salary, and security.</p><Button variant="primary" className="mt-5 w-full" disabled={!view.canSubmit} title={view.disabledReason} onClick={() => dispatch({ type: 'SUBMIT_STAFF_CONTRACT_NEGOTIATION' })}>Submit formal offer</Button>{view.disabledReason && <p className="mt-2 text-xs text-red-300">{view.disabledReason}</p>}</Panel>
        </div>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}
