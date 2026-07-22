import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { MetricStrip, WorkspaceBody, WorkspaceHeader, WorkspaceMetric, WorkspaceScreen } from '../components/workspace/Workspace';
import { formatMoney } from '../components/ui';
import { marketNegotiationView } from './personnelNegotiationViewModel';

export function MarketContractNegotiation() {
  const { state, dispatch } = useGame();
  const { marketId, seatDriverId } = useParams();
  const navigate = useNavigate();
  const driver = state ? careerMarketBundle(state).drivers.find((entry) => entry.id === marketId) : undefined;
  const seat = state?.drivers.find((entry) => entry.id === seatDriverId && entry.teamId === state.selectedTeamId);

  useEffect(() => {
    if (state && driver && seat && state.marketContractNegotiation?.marketId !== driver.id) {
      dispatch({ type: 'START_MARKET_CONTRACT_NEGOTIATION', marketId: driver.id, seatDriverId: seat.id });
    }
  }, [dispatch, driver, seat, state]);

  if (!state) return null;
  if (!driver || !seat) return <WorkspaceScreen><WorkspaceHeader eyebrow="Contract desk" title="Negotiation unavailable" subtitle="The driver or replacement seat is no longer available." /><WorkspaceBody><Button onClick={() => navigate('/market')}>Back to Driver Market</Button></WorkspaceBody></WorkspaceScreen>;
  const negotiation = state.marketContractNegotiation?.marketId === driver.id ? state.marketContractNegotiation : undefined;
  if (!negotiation) return <WorkspaceScreen><WorkspaceHeader eyebrow="Contract desk" title={`Opening talks with ${driver.name}`} subtitle="Preparing the agent's demands and rival-market position." /></WorkspaceScreen>;
  const view = marketNegotiationView(state, negotiation);
  const tone = view.tone === 'positive' ? 'border-green-500/40 bg-green-500/10 text-green-300' : view.tone === 'warning' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-red-500/40 bg-red-500/10 text-red-300';
  const update = (patch: { offeredBid?: number; offeredSalary?: number; years?: number }) => dispatch({ type: 'UPDATE_MARKET_CONTRACT_NEGOTIATION', ...patch });
  return (
    <WorkspaceScreen>
      <WorkspaceHeader eyebrow="Driver recruitment" title={`Negotiate with ${driver.name}`} subtitle={`Pre-contract agreement to replace ${seat.name}. Rival interest and compensation remain deterministic.`} actions={<Button variant="ghost" onClick={() => { dispatch({ type: 'CANCEL_MARKET_CONTRACT_NEGOTIATION' }); navigate('/market'); }}>Cancel talks</Button>} />
      <MetricStrip>
        <WorkspaceMetric label="Agent compensation demand" value={`$${negotiation.askingBid.toFixed(1)}M`} detail="Includes rival leverage" />
        <WorkspaceMetric label="Salary demand" value={`$${negotiation.askingSalary.toFixed(1)}M`} detail="Annual wage" />
        <WorkspaceMetric label="Attempts remaining" value={negotiation.attemptsRemaining} detail="A refusal consumes one attempt" />
        <WorkspaceMetric label="Immediate commitment" value={formatMoney(view.immediateCost)} detail="Charged if the rollover signing succeeds" />
      </MetricStrip>
      <WorkspaceBody className="space-y-4">
        {negotiation.response === 'countered' && <Panel title="Agent counter"><p className="text-sm text-amber-200">The agent will continue at a compensation bid of ${negotiation.counterBid?.toFixed(1)}M.</p><Button className="mt-2 px-2 py-1 text-xs" onClick={() => update({ offeredBid: negotiation.counterBid })}>Match counter</Button></Panel>}
        {negotiation.response === 'refused' && <Panel title="Talks ended"><p className="text-sm text-red-300">The package was too far from expectations or the negotiation ran out of patience.</p></Panel>}
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel title="Your package">
            <label className="block text-xs font-semibold text-neutral-300">Compensation bid · ${negotiation.offeredBid.toFixed(1)}M<input className="mt-2 w-full accent-amber-400" type="range" min={driver.buyoutCost} max={Math.max(negotiation.askingBid * 1.5, driver.buyoutCost + 1)} step={0.1} value={negotiation.offeredBid} onChange={(event) => update({ offeredBid: Number(event.target.value) })} /></label>
            <label className="mt-5 block text-xs font-semibold text-neutral-300">Annual wage · ${negotiation.offeredSalary.toFixed(1)}M<input className="mt-2 w-full accent-amber-400" type="range" min={Math.max(0.1, driver.salary * 0.75)} max={driver.salary * 2.5} step={0.1} value={negotiation.offeredSalary} onChange={(event) => update({ offeredSalary: Number(event.target.value) })} /></label>
            <label className="mt-5 block text-xs font-semibold text-neutral-300">Contract length<select className="mt-2 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2" value={negotiation.years} onChange={(event) => update({ years: Number(event.target.value) })}>{[1,2,3,4,5].map((years) => <option key={years} value={years}>{years} year{years === 1 ? '' : 's'}</option>)}</select></label>
          </Panel>
          <Panel title="Agent response"><div className={`rounded border p-3 text-sm font-bold ${tone}`}>{view.label}</div><p className="mt-3 text-xs leading-5 text-neutral-400">The readout combines series interest, team pull, wage, term, compensation, and the deterministic rival bid.</p><Button variant="primary" className="mt-5 w-full" disabled={!view.canSubmit} title={view.disabledReason} onClick={() => dispatch({ type: 'SUBMIT_MARKET_CONTRACT_NEGOTIATION' })}>Submit formal offer</Button>{view.disabledReason && <p className="mt-2 text-xs text-red-300">{view.disabledReason}</p>}</Panel>
        </div>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}
