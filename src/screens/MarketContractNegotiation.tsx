import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useGame } from '../game/GameContext';
import { careerMarketBundle } from '../sim/careerMarketEngine';
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
  if (!driver || !seat) {
    return (
      <WorkspaceScreen>
        <WorkspaceHeader eyebrow="Contract desk" title="Negotiation unavailable" subtitle="The driver or replacement seat is no longer available." />
        <WorkspaceBody><Button onClick={() => navigate('/market')}>Back to Driver Market</Button></WorkspaceBody>
      </WorkspaceScreen>
    );
  }
  const negotiation = state.marketContractNegotiation?.marketId === driver.id ? state.marketContractNegotiation : undefined;
  if (!negotiation) {
    return <WorkspaceScreen><WorkspaceHeader eyebrow="Contract desk" title={`Opening talks with ${driver.name}`} subtitle="Preparing the agent's demands and rival-market position." /></WorkspaceScreen>;
  }

  const view = marketNegotiationView(state, negotiation);
  const tone = view.tone === 'positive' ? 'is-positive' : view.tone === 'warning' ? 'is-warning' : 'is-negative';
  const budget = state.teams.find((team) => team.id === state.selectedTeamId)?.budget ?? 0;
  const update = (patch: { offeredBid?: number; offeredSalary?: number; years?: number }) => dispatch({ type: 'UPDATE_MARKET_CONTRACT_NEGOTIATION', ...patch });

  return (
    <WorkspaceScreen className="ui-recruitment-screen ui-negotiation-room">
      <WorkspaceHeader
        eyebrow="Driver recruitment"
        title={`Negotiate with ${driver.name}`}
        subtitle={`Pre-contract agreement to replace ${seat.name}. Rival interest and compensation remain deterministic.`}
        actions={<Button variant="ghost" onClick={() => { dispatch({ type: 'CANCEL_MARKET_CONTRACT_NEGOTIATION' }); navigate('/market'); }}>Walk away</Button>}
      />
      <WorkspaceBody className="overflow-hidden">
        <FmWorkspaceGrid columns="three" className="ui-negotiation-grid">
          <FmPane className="ui-negotiation-agent-pane">
            <FmPaneHeader title="Driver & Agent" meta={`${negotiation.attemptsRemaining} attempts remaining`} />
            <FmPaneBody className="overflow-auto">
              <section className="ui-negotiation-identity">
                <span>External target</span>
                <strong>{driver.name}</strong>
                <p>{driver.nationality} · age {driver.age} · {driver.marketStatus}</p>
              </section>
              <section>
                <h3>Agent demands</h3>
                <FmKeyValue label="Compensation" value={`$${negotiation.askingBid.toFixed(1)}M`} />
                <FmKeyValue label="Annual wage" value={`$${negotiation.askingSalary.toFixed(1)}M`} />
                <FmKeyValue label="Replacement seat" value={`${seat.name} · #${seat.number}`} />
                <FmKeyValue label="Attempts remaining" value={negotiation.attemptsRemaining} />
              </section>
              {negotiation.response === 'countered' && (
                <section className="ui-negotiation-response is-warning">
                  <strong>Agent counter</strong>
                  <p>The agent will continue at a compensation bid of ${negotiation.counterBid?.toFixed(1)}M.</p>
                  <Button variant="secondary" onClick={() => update({ offeredBid: negotiation.counterBid })}>Match counter</Button>
                </section>
              )}
              {negotiation.response === 'refused' && (
                <section className="ui-negotiation-response is-negative">
                  <strong>Talks ended</strong>
                  <p>The package was too far from expectations or the negotiation ran out of patience.</p>
                </section>
              )}
            </FmPaneBody>
          </FmPane>

          <FmPane className="ui-negotiation-terms-pane">
            <FmPaneHeader title="Recruitment Package" meta="Editable terms" />
            <FmPaneBody className="ui-negotiation-fields overflow-auto">
              <label>Compensation bid <strong>${negotiation.offeredBid.toFixed(1)}M</strong>
                <input type="range" min={driver.buyoutCost} max={Math.max(negotiation.askingBid * 1.5, driver.buyoutCost + 1)} step={0.1} value={negotiation.offeredBid} onChange={(event) => update({ offeredBid: Number(event.target.value) })} />
              </label>
              <label>Annual wage <strong>${negotiation.offeredSalary.toFixed(1)}M</strong>
                <input type="range" min={Math.max(0.1, driver.salary * 0.75)} max={driver.salary * 2.5} step={0.1} value={negotiation.offeredSalary} onChange={(event) => update({ offeredSalary: Number(event.target.value) })} />
              </label>
              <label>Contract length
                <select value={negotiation.years} onChange={(event) => update({ years: Number(event.target.value) })}>
                  {[1, 2, 3, 4, 5].map((years) => <option key={years} value={years}>{years} year{years === 1 ? '' : 's'}</option>)}
                </select>
              </label>
              <section className="ui-negotiation-seat-summary">
                <span>Incoming driver</span><strong>{driver.name}</strong>
                <span>Replaces</span><strong>{seat.name}</strong>
              </section>
            </FmPaneBody>
          </FmPane>

          <FmPane className="ui-negotiation-context-pane">
            <FmPaneHeader title="Agent Response" meta="Rival leverage included" />
            <FmPaneBody className="overflow-auto">
              <div className={`ui-negotiation-likelihood ${tone}`}>{view.label}</div>
              <p>The assessment combines series interest, team pull, wage, term, compensation, and the deterministic rival bid.</p>
              <section>
                <FmKeyValue label="Immediate commitment" value={formatMoney(view.immediateCost)} />
                <FmKeyValue label="Available budget" value={formatMoney(budget)} />
                <FmKeyValue label="Buyout baseline" value={`$${driver.buyoutCost.toFixed(1)}M`} />
                <FmKeyValue label="Contract maximum" value="5 years" />
              </section>
              {view.disabledReason && <div className="ui-negotiation-disabled">{view.disabledReason}</div>}
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
        <FmDecisionBar
          actions={<Button variant="primary" disabled={!view.canSubmit} title={view.disabledReason} onClick={() => dispatch({ type: 'SUBMIT_MARKET_CONTRACT_NEGOTIATION' })}>Submit formal offer</Button>}
        >
          <strong>{driver.name} → replace {seat.name}</strong>
          <span>{view.disabledReason ?? `${view.label}; immediate commitment ${formatMoney(view.immediateCost)}.`}</span>
        </FmDecisionBar>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}
