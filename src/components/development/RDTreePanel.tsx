import { useState } from 'react';
import { Button } from '../Button';
import { Panel } from '../Panel';
import { TechnicalTable, TechnicalTableCell, TechnicalTableHead, TechnicalTableRow } from '../TechnicalTable';
import { formatMoney } from '../ui';
import { rdBranchMetadata } from '../../data/rd/rdFoundationCatalog';
import { rdNodesForBranch } from '../../data/rd/rdCatalog';
import { teamById } from '../../game/careerState';
import { useGame } from '../../game/GameContext';
import { isSingleSeasonMode } from '../../game/modeRestrictions';
import { developmentSlots } from '../../sim/facilityEngine';
import {
  adjustedResearchCashCost,
  adjustedResearchDuration,
  cashCostForBand,
  createInitialTeamResearch,
  durationRoundsForBand,
  tppCostForBand,
} from '../../sim/rdEngine';
import {
  buildRDTreeRequests,
  evaluateRDRequestUnlock,
  rdBranchLabelForSeries,
} from '../../sim/rdNodeRules';
import type { DevelopmentOutcome } from '../../types/gameTypes';
import type { RDBranchId, RDNodeDefinition } from '../../types/rdTypes';
import { researchStateForTeam, technicalStateForTeam } from '../../sim/technicalAdapters';

const OUTCOME_COLORS: Record<DevelopmentOutcome, string> = {
  GreatSuccess: 'text-emerald-300', FullSuccess: 'text-blue-300', PartialSuccess: 'text-yellow-300',
  MinorSuccess: 'text-orange-300', Failed: 'text-red-300', RareBackfire: 'text-red-400',
};

export function RDTreePanel({ compactTree = false }: { compactTree?: boolean }) {
  const { state, dispatch } = useGame();
  const [selectedTier, setSelectedTier] = useState(1);
  const [view, setView] = useState<'tree' | 'activity'>('tree');
  if (!state) return null;

  const team = teamById(state, state.selectedTeamId);
  const budget = team?.budget ?? 0;
  const singleSeason = isSingleSeasonMode(state.gameMode);
  const research = researchStateForTeam(state, state.selectedTeamId)
    ?? createInitialTeamResearch(state.selectedTeamId, state.seasonYear);
  const focus = research.focus?.branchId;
  const focusMetadata = focus ? rdBranchMetadata.find((branch) => branch.id === focus) : undefined;
  const focusLabel = focus ? rdBranchLabelForSeries(focus, state.series) : undefined;
  const nodes = focus ? rdNodesForBranch(focus) : [];
  const requests = buildRDTreeRequests(nodes, state.series, state.seasonYear);
  const tierNodes = nodes.filter((node) => node.tier === selectedTier);
  const completedInBranch = research.completedNodes.filter((node) => node.branchId === focus).length;
  const conventionalActive = technicalStateForTeam(state, state.selectedTeamId)?.activeProjects
    .filter((project) => project.kind === 'upgrade').length ?? 0;
  const maxRDProjects = Math.max(0, developmentSlots(state.facilities) - conventionalActive);
  const canChangeFocus = !!research.focus && state.seasonYear > research.focus.lockedThroughSeasonYear;

  return (
    <Panel title="Research & Development Tree">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span>{focusLabel ?? 'No research program selected'} · {completedInBranch}/{nodes.length || 43} nodes complete</span>
        {!compactTree && <span>{research.activeProjects.length}/{maxRDProjects} research capacity</span>}
      </div>

      {!compactTree && <nav className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-neutral-800 bg-neutral-950/60 p-1" aria-label="Research sections">
        <button
          type="button"
          onClick={() => setView('tree')}
          aria-current={view === 'tree' ? 'page' : undefined}
          className={`rounded px-3 py-2 text-xs font-semibold ${view === 'tree' ? 'bg-amber-600 text-black' : 'text-neutral-400 hover:bg-neutral-800'}`}
        >
          Research Tree
        </button>
        <button
          type="button"
          onClick={() => setView('activity')}
          aria-current={view === 'activity' ? 'page' : undefined}
          className={`rounded px-3 py-2 text-xs font-semibold ${view === 'activity' ? 'bg-amber-600 text-black' : 'text-neutral-400 hover:bg-neutral-800'}`}
        >
          Activity ({research.projectHistory.length + research.tpp.ledger.length})
        </button>
      </nav>}

      {(compactTree || view === 'tree') && singleSeason && (
        <div className="mt-4 rounded-lg border border-blue-800 bg-blue-950/30 p-3 text-sm text-blue-300">
          The multi-year R&D tree is available in Career and Sandbox modes. Rapid in-season development remains available below.
        </div>
      )}

      {(compactTree || view === 'tree') && (!focus || canChangeFocus) && (
        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold text-neutral-200">
            {focus ? 'Change three-season research focus' : 'Choose a three-season research focus'}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {rdBranchMetadata.map((branch) => (
              <button
                key={branch.id}
                type="button"
                disabled={singleSeason || focus === branch.id}
                onClick={() => { setSelectedTier(1); dispatch({ type: 'SET_RESEARCH_FOCUS', branchId: branch.id as RDBranchId }); }}
                className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3 text-left transition hover:border-amber-600 hover:bg-neutral-800/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="text-sm font-semibold text-neutral-100">{rdBranchLabelForSeries(branch.id, state.series)}</div>
                <div className="mt-1 text-[11px] leading-4 text-neutral-500">{branch.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {(compactTree || view === 'tree') && focus && focusMetadata && (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
            <div>
              <div className="text-sm font-semibold text-neutral-100">{focusLabel}</div>
              <div className="text-xs text-neutral-500">
                {focusMetadata.description} Focus locked through {research.focus?.lockedThroughSeasonYear}.
              </div>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((tier) => {
                const completed = research.completedNodes.filter((node) => node.branchId === focus && node.tier === tier).length;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setSelectedTier(tier)}
                    className={`rounded px-3 py-1.5 text-xs font-semibold ${selectedTier === tier ? 'bg-amber-600 text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
                  >
                    Tier {tier} · {completed}
                  </button>
                );
              })}
            </div>
          </div>

          <TechnicalTable className="mt-4">
            <TechnicalTableHead><TechnicalTableRow><TechnicalTableCell header>Node</TechnicalTableCell><TechnicalTableCell header>Effects</TechnicalTableCell><TechnicalTableCell header>Availability</TechnicalTableCell><TechnicalTableCell header>Cost</TechnicalTableCell><TechnicalTableCell header>Duration</TechnicalTableCell><TechnicalTableCell header>Status / action</TechnicalTableCell></TechnicalTableRow></TechnicalTableHead>
            <tbody>{tierNodes.map((node) => <RDNodeRow key={node.id} node={node} request={requests[node.id]} budget={budget} maxActiveProjects={maxRDProjects} />)}</tbody>
          </TechnicalTable>
        </>
      )}

      {!compactTree && view === 'activity' && research.projectHistory.length > 0 && (
        <div className="mt-4 border-t border-neutral-800 pt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Recent R&D outcomes</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {research.projectHistory.slice(-6).reverse().map((entry) => (
              <div key={entry.projectId} className="rounded border border-neutral-800 bg-neutral-900/40 p-2 text-xs">
                <div className="font-semibold text-neutral-200">{entry.nodeName}</div>
                <div className={OUTCOME_COLORS[entry.outcomeResult.outcome]}>{entry.outcomeResult.label}</div>
                <div className="text-neutral-500">{entry.seasonYear} · Round {entry.round}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!compactTree && view === 'activity' && research.tpp.ledger.length > 0 && (
        <div className="mt-4 border-t border-neutral-800 pt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Recent TPP activity</div>
          <div className="space-y-1">
            {research.tpp.ledger.slice(-3).reverse().map((entry) => (
              <div key={entry.id} className="flex justify-between gap-3 text-xs text-neutral-400">
                <span>{entry.seasonYear} · {entry.description}</span>
                <span className={entry.amount >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                  {entry.amount >= 0 ? '+' : ''}{entry.amount} TPP · {entry.balanceAfter} remaining
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!compactTree && view === 'activity' && research.projectHistory.length === 0 && research.tpp.ledger.length === 0 && (
        <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-500">
          No completed research or TPP activity yet.
        </div>
      )}
    </Panel>
  );
}

function RDNodeRow({ node, request, budget, maxActiveProjects }: { node: RDNodeDefinition; request: ReturnType<typeof buildRDTreeRequests>[string]; budget: number; maxActiveProjects: number }) {
  const { state, dispatch } = useGame();
  if (!state) return null;
  const research = researchStateForTeam(state, state.selectedTeamId) ?? createInitialTeamResearch(state.selectedTeamId, state.seasonYear);
  const unlock = evaluateRDRequestUnlock(request, research);
  const cashCost = adjustedResearchCashCost(cashCostForBand(node.cashCostBand, budget, state.series, state.seasonYear), research);
  const tppCost = tppCostForBand(node.tppCostBand);
  const duration = adjustedResearchDuration(durationRoundsForBand(node.durationBand, state.calendar.length), research);
  const active = research.activeProjects.find((project) => project.nodeId === node.id);
  const completed = research.completedNodes.find((project) => project.nodeId === node.id);
  const canStart = !isSingleSeasonMode(state.gameMode) && unlock.unlocked && !active && !completed && research.activeProjects.length < maxActiveProjects && budget >= cashCost && research.tpp.balance >= tppCost;
  const effectSummary = request.modifierTemplates.filter((modifier) => modifier.scope !== 'risk').map((modifier) => `${modifier.target} ${modifier.value >= 0 ? '+' : ''}${modifier.value}`).join(' · ');
  return <TechnicalTableRow className={completed ? 'bg-emerald-950/10' : active ? 'bg-amber-950/10' : ''}>
    <TechnicalTableCell><div className="font-semibold text-neutral-100">{request.displayName}</div><div className="text-neutral-500">{node.sourceId} · {node.path}</div></TechnicalTableCell>
    <TechnicalTableCell className="max-w-xs"><div className="text-neutral-300">{effectSummary || 'Persistent team modifier'}</div><div className="text-neutral-500">{node.mainEffects.split('\n').slice(0, 2).join(' ')}</div></TechnicalTableCell>
    <TechnicalTableCell className={request.available ? 'text-blue-300' : 'text-red-300'}>{request.availabilityLabel}<div className="text-neutral-500">{request.availabilityReason}</div></TechnicalTableCell>
    <TechnicalTableCell>{formatMoney(cashCost)}<div className="text-neutral-500">{tppCost} TPP</div></TechnicalTableCell>
    <TechnicalTableCell>{duration} rounds</TechnicalTableCell>
    <TechnicalTableCell>{active ? <div className="min-w-36"><div className="mb-1 flex justify-between text-amber-300"><span>In progress</span><span>{active.progressRounds}/{active.durationRounds}</span></div><div className="h-1.5 rounded bg-neutral-800"><div className="h-full rounded bg-amber-500" style={{ width: `${Math.min(100, active.progressRounds / active.durationRounds * 100)}%` }} /></div></div> : completed ? <span className="text-emerald-300">Completed · {completed.outcomeResult?.label ?? 'Foundation result'}</span> : <Button className="px-2 py-1 text-xs" variant={canStart ? 'primary' : 'secondary'} disabled={!canStart} onClick={() => dispatch({ type: 'START_RD_PROJECT', request })}>{!unlock.unlocked ? 'Locked' : budget < cashCost ? 'No budget' : research.tpp.balance < tppCost ? 'No TPP' : research.activeProjects.length >= maxActiveProjects ? 'No bay' : 'Start research'}</Button>}</TechnicalTableCell>
  </TechnicalTableRow>;
}
