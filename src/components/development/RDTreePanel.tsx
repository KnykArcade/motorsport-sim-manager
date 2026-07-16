import { useState } from 'react';
import { Button } from '../Button';
import { Panel } from '../Panel';
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

const OUTCOME_COLORS: Record<DevelopmentOutcome, string> = {
  GreatSuccess: 'text-emerald-300', FullSuccess: 'text-blue-300', PartialSuccess: 'text-yellow-300',
  MinorSuccess: 'text-orange-300', Failed: 'text-red-300', RareBackfire: 'text-red-400',
};

const RISK_COLORS = {
  Safe: 'text-emerald-300', Standard: 'text-neutral-300', Aggressive: 'text-orange-300', Experimental: 'text-red-300',
} as const;

export function RDTreePanel() {
  const { state, dispatch } = useGame();
  const [selectedTier, setSelectedTier] = useState(1);
  const [view, setView] = useState<'tree' | 'activity'>('tree');
  const [nodePage, setNodePage] = useState(0);
  if (!state) return null;

  const team = teamById(state, state.selectedTeamId);
  const budget = team?.budget ?? 0;
  const singleSeason = isSingleSeasonMode(state.gameMode);
  const research = state.teamResearch?.[state.selectedTeamId]
    ?? createInitialTeamResearch(state.selectedTeamId, state.seasonYear);
  const focus = research.focus?.branchId;
  const focusMetadata = focus ? rdBranchMetadata.find((branch) => branch.id === focus) : undefined;
  const focusLabel = focus ? rdBranchLabelForSeries(focus, state.series) : undefined;
  const nodes = focus ? rdNodesForBranch(focus) : [];
  const requests = buildRDTreeRequests(nodes, state.series, state.seasonYear);
  const tierNodes = nodes.filter((node) => node.tier === selectedTier);
  const nodePageCount = Math.max(1, Math.ceil(tierNodes.length / 2));
  const safeNodePage = Math.min(nodePage, nodePageCount - 1);
  const visibleTierNodes = tierNodes.slice(safeNodePage * 2, safeNodePage * 2 + 2);
  const completedInBranch = research.completedNodes.filter((node) => node.branchId === focus).length;
  const maxRDProjects = Math.max(0, developmentSlots(state.facilities) - state.activeDevelopmentProjects.length);
  const canChangeFocus = !!research.focus && state.seasonYear > research.focus.lockedThroughSeasonYear;

  return (
    <Panel title="Research & Development Tree">
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Team Principal Points" value={`${research.tpp.balance} TPP`} tone="amber" />
        <Metric label="Series Program" value={focusLabel ?? 'Not selected'} />
        <Metric label="Tree Progress" value={`${completedInBranch}/${nodes.length || 43}`} />
        <Metric label="Research Bays" value={`${research.activeProjects.length}/${maxRDProjects}`} />
      </div>

      <nav className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-neutral-800 bg-neutral-950/60 p-1" aria-label="Research sections">
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
      </nav>

      {view === 'tree' && singleSeason && (
        <div className="mt-4 rounded-lg border border-blue-800 bg-blue-950/30 p-3 text-sm text-blue-300">
          The multi-year R&D tree is available in Career and Sandbox modes. Rapid in-season development remains available below.
        </div>
      )}

      {view === 'tree' && (!focus || canChangeFocus) && (
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
                onClick={() => { setSelectedTier(1); setNodePage(0); dispatch({ type: 'SET_RESEARCH_FOCUS', branchId: branch.id as RDBranchId }); }}
                className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3 text-left transition hover:border-amber-600 hover:bg-neutral-800/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="text-sm font-semibold text-neutral-100">{rdBranchLabelForSeries(branch.id, state.series)}</div>
                <div className="mt-1 text-[11px] leading-4 text-neutral-500">{branch.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === 'tree' && focus && focusMetadata && (
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
                    onClick={() => { setSelectedTier(tier); setNodePage(0); }}
                    className={`rounded px-3 py-1.5 text-xs font-semibold ${selectedTier === tier ? 'bg-amber-600 text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
                  >
                    Tier {tier} · {completed}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {visibleTierNodes.map((node) => (
              <RDNodeCard
                key={node.id}
                node={node}
                request={requests[node.id]}
                budget={budget}
                maxActiveProjects={maxRDProjects}
              />
            ))}
          </div>
          {tierNodes.length > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/50 px-3 py-2">
              <Button variant="secondary" disabled={safeNodePage === 0} onClick={() => setNodePage(Math.max(0, safeNodePage - 1))}>
                Previous
              </Button>
              <span className="text-xs text-neutral-500">
                Tier projects {safeNodePage * 2 + 1}–{Math.min(tierNodes.length, safeNodePage * 2 + 2)} of {tierNodes.length} · Page {safeNodePage + 1} of {nodePageCount}
              </span>
              <Button variant="secondary" disabled={safeNodePage >= nodePageCount - 1} onClick={() => setNodePage(Math.min(nodePageCount - 1, safeNodePage + 1))}>
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {view === 'activity' && research.projectHistory.length > 0 && (
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

      {view === 'activity' && research.tpp.ledger.length > 0 && (
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

      {view === 'activity' && research.projectHistory.length === 0 && research.tpp.ledger.length === 0 && (
        <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-500">
          No completed research or TPP activity yet.
        </div>
      )}
    </Panel>
  );
}

function RDNodeCard({ node, request, budget, maxActiveProjects }: { node: RDNodeDefinition; request: ReturnType<typeof buildRDTreeRequests>[string]; budget: number; maxActiveProjects: number }) {
  const { state, dispatch } = useGame();
  if (!state) return null;
  const research = state.teamResearch?.[state.selectedTeamId]
    ?? createInitialTeamResearch(state.selectedTeamId, state.seasonYear);
  const unlock = evaluateRDRequestUnlock(request, research);
  const baseCashCost = cashCostForBand(node.cashCostBand, budget, state.series, state.seasonYear);
  const cashCost = adjustedResearchCashCost(baseCashCost, research);
  const tppCost = tppCostForBand(node.tppCostBand);
  const duration = adjustedResearchDuration(durationRoundsForBand(node.durationBand, state.calendar.length), research);
  const active = research.activeProjects.find((project) => project.nodeId === node.id);
  const completed = research.completedNodes.find((project) => project.nodeId === node.id);
  const singleSeason = isSingleSeasonMode(state.gameMode);
  const canStart = !singleSeason
    && unlock.unlocked
    && !active
    && !completed
    && research.activeProjects.length < maxActiveProjects
    && budget >= cashCost
    && research.tpp.balance >= tppCost;
  const effectSummary = request.modifierTemplates
    .filter((modifier) => modifier.scope !== 'risk')
    .map((modifier) => `${modifier.target} ${modifier.value >= 0 ? '+' : ''}${modifier.value}`)
    .join(' · ');

  return (
    <div className={`rounded-lg border p-4 ${completed ? 'border-emerald-800 bg-emerald-950/10' : active ? 'border-amber-700 bg-amber-950/10' : 'border-neutral-800 bg-neutral-900/40'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">{node.sourceId} · {node.path}</div>
          <div className="mt-0.5 font-semibold text-neutral-100">{request.displayName}</div>
          {request.displayName !== node.name && <div className="text-[10px] text-neutral-500">Workbook concept: {node.name}</div>}
        </div>
        <div className={`text-[10px] font-semibold ${RISK_COLORS[request.riskLevel]}`}>{request.riskLevel}</div>
      </div>

      <div className="mt-2 text-xs leading-5 text-neutral-400">{node.mainEffects.split('\n').slice(0, 2).join(' ')}</div>
      <div className="mt-2 text-[11px] text-emerald-400">Planned effect: {effectSummary || 'Persistent team modifier'}</div>
      <div className={`mt-1 text-[11px] ${request.available ? 'text-blue-300' : 'text-red-300'}`}>
        {request.availabilityLabel}{request.availabilityReason ? ` · ${request.availabilityReason}` : ''}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-neutral-400">
        <span className="rounded bg-neutral-800 px-2 py-1">{formatMoney(cashCost)}</span>
        <span className="rounded bg-neutral-800 px-2 py-1">{tppCost} TPP</span>
        <span className="rounded bg-neutral-800 px-2 py-1">{duration} rounds</span>
      </div>

      {active ? (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-amber-300"><span>In progress</span><span>{active.progressRounds}/{active.durationRounds}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded bg-neutral-800">
            <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, active.progressRounds / active.durationRounds * 100)}%` }} />
          </div>
        </div>
      ) : completed ? (
        <div className="mt-3 text-xs font-semibold text-emerald-300">
          Completed · {completed.outcomeResult?.label ?? 'Foundation result'}
        </div>
      ) : (
        <div className="mt-3">
          {!unlock.unlocked && <div className="mb-2 text-[11px] text-neutral-500">{unlock.reasons.slice(0, 2).join(' ')}</div>}
          <Button
            className="w-full"
            variant={canStart ? 'primary' : 'secondary'}
            disabled={!canStart}
            onClick={() => dispatch({ type: 'START_RD_PROJECT', request })}
          >
            {!unlock.unlocked ? 'Locked' : budget < cashCost ? 'Insufficient Budget' : research.tpp.balance < tppCost ? 'Insufficient TPP' : research.activeProjects.length >= maxActiveProjects ? 'No Research Bay' : 'Start Research'}
          </Button>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'amber' }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${tone === 'amber' ? 'text-amber-300' : 'text-neutral-100'}`}>{value}</div>
    </div>
  );
}
