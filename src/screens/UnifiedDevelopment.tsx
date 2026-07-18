import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { isSingleSeasonMode, isDevelopmentProjectAllowedForMode } from '../game/modeRestrictions';
import { developmentProjectCatalog } from '../data/development/developmentProjects';
import { rdNodesForBranch } from '../data/rd/rdCatalog';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { TechnicalTable, TechnicalTableCell, TechnicalTableHead, TechnicalTableRow } from '../components/TechnicalTable';
import { formatMoney } from '../components/ui';
import type { DevelopmentProject, DevelopmentOutcome } from '../types/gameTypes';
import {
  developmentSlots,
  relevantFacilityLevel,
  facilityOutcomeChances,
  facilityImpactMultiplier,
} from '../sim/facilityEngine';
import {
  computeAdjustedDuration,
  OUTCOME_LABELS,
  RUSH_COST_MULTIPLIER,
} from '../sim/developmentEngine';
import {
  adjustedResearchCashCost,
  adjustedResearchDuration,
  cashCostForBand,
  createInitialTeamResearch,
  durationRoundsForBand,
  tppCostForBand,
} from '../sim/rdEngine';
import { developmentSuccessBonus } from '../sim/staffEngine';
import { facilityDevelopmentSuccessBonus } from '../sim/facilityEngine';
import { leadershipGameplayModifiers } from '../sim/phase18IdentityCultureEngine';
import { buildRDTreeRequests, evaluateRDRequestUnlock, rdBranchLabelForSeries } from '../sim/rdNodeRules';
import { RDTreePanel } from '../components/development/RDTreePanel';
import { WorkspaceBody, WorkspaceTabs } from '../components/workspace/Workspace';

type UnifiedTab = 'programs' | 'in-progress' | 'tree' | 'history';
type ProgramFilter = 'All' | 'Quick Upgrade' | 'Research';

const OUTCOME_COLORS: Record<DevelopmentOutcome, string> = {
  GreatSuccess: 'text-green-400',
  FullSuccess: 'text-[var(--era-accent-strong)]',
  PartialSuccess: 'text-amber-300',
  MinorSuccess: 'text-orange-400',
  Failed: 'text-red-400',
  RareBackfire: 'text-red-500',
};

const RISK_COLORS: Record<string, string> = {
  Safe: 'text-green-400',
  Standard: 'text-neutral-300',
  Aggressive: 'text-orange-400',
  Experimental: 'text-red-400',
};

export function UnifiedDevelopmentBody() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<UnifiedTab>('programs');
  const [horizon, setHorizon] = useState<ProgramFilter>('All');
  const [area, setArea] = useState('All');
  const [risk, setRisk] = useState('All');
  const [sort, setSort] = useState<'cost' | 'duration'>('cost');
  if (!state) return null;
  const currentState = state;

  const team = teamById(state, state.selectedTeamId);
  const budget = team?.budget ?? 0;
  const research = state.teamResearch?.[state.selectedTeamId]
    ?? createInitialTeamResearch(state.selectedTeamId, state.seasonYear);
  const singleSeason = isSingleSeasonMode(state.gameMode);
  const capacity = developmentSlots(state.facilities);
  const conventionalActive = state.activeDevelopmentProjects.length;
  const researchActive = research.activeProjects.length;
  const usedCapacity = conventionalActive + researchActive;
  const capacityFull = usedCapacity >= capacity;
  const totalSuccessBonus = developmentSuccessBonus(state.staff ?? [])
    + facilityDevelopmentSuccessBonus(state.facilities)
    + leadershipGameplayModifiers(state).developmentSuccessBonus;

  const focus = research.focus?.branchId;
  const researchNodes = focus ? rdNodesForBranch(focus) : [];
  const researchRequests = buildRDTreeRequests(researchNodes, state.series, state.seasonYear);
  const actionableResearch = researchNodes.filter((node) => {
    const request = researchRequests[node.id];
    const unlock = evaluateRDRequestUnlock(request, research);
    return request.available
      && unlock.unlocked
      && !research.activeProjects.some((project) => project.nodeId === node.id)
      && !research.completedNodes.some((nodeState) => nodeState.nodeId === node.id);
  });

  const areas = [...new Set([
    ...developmentProjectCatalog.map((project) => project.category),
    ...actionableResearch.map((node) => node.branchId),
  ])];
  const risks = [...new Set([
    ...developmentProjectCatalog.map((project) => project.riskLevel ?? 'Standard'),
    ...actionableResearch.map((node) => researchRequests[node.id].riskLevel),
  ])];
  const conventionalProjects = developmentProjectCatalog
    .filter(() => horizon !== 'Research')
    .filter((project) => area === 'All' || project.category === area)
    .filter((project) => risk === 'All' || (project.riskLevel ?? 'Standard') === risk)
    .sort((a, b) => sort === 'cost' ? a.cost - b.cost : a.durationRaces - b.durationRaces);
  const researchPrograms = actionableResearch
    .filter(() => horizon !== 'Quick Upgrade')
    .filter((node) => area === 'All' || node.branchId === area)
    .filter((node) => risk === 'All' || researchRequests[node.id].riskLevel === risk)
    .sort((a, b) => {
      const aCost = cashCostForBand(a.cashCostBand, budget, state.series, state.seasonYear);
      const bCost = cashCostForBand(b.cashCostBand, budget, state.series, state.seasonYear);
      return sort === 'cost'
        ? aCost - bCost
        : durationRoundsForBand(a.durationBand, state.calendar.length) - durationRoundsForBand(b.durationBand, state.calendar.length);
    });

  const effectSummary = (project: DevelopmentProject) => {
    const effects = Object.entries(project.currentSeasonEffects ?? {}).map(([key, value]) => `+${value} ${key}`);
    if (!singleSeason) {
      effects.push(...Object.entries(project.nextSeasonEffects ?? {}).map(([key, value]) => `+${value} ${key} (next yr)`));
    }
    return effects.join(', ') || 'Infrastructure / research';
  };
  const outcomeSummary = (project: DevelopmentProject) => {
    const chances = facilityOutcomeChances(
      relevantFacilityLevel(state.facilities, project.category),
      project.riskLevel ?? 'Standard',
      totalSuccessBonus,
    );
    const order: DevelopmentOutcome[] = ['GreatSuccess', 'FullSuccess', 'PartialSuccess', 'MinorSuccess', 'Failed', 'RareBackfire'];
    return order.filter((outcome) => chances[outcome] > 0.001)
      .map((outcome) => `${OUTCOME_LABELS[outcome]} ${Math.round(chances[outcome] * 100)}%`).join(' · ');
  };

  return (
    <WorkspaceBody className="space-y-4">
      <WorkspaceTabs
        items={[
          { id: 'programs', label: `Programs (${conventionalProjects.length + researchPrograms.length})` },
          { id: 'in-progress', label: `In Progress (${usedCapacity})` },
          { id: 'tree', label: 'Tree' },
          { id: 'history', label: `History (${state.completedDevelopmentProjects.length + research.projectHistory.length})` },
        ]}
        active={tab}
        onChange={(value) => setTab(value as UnifiedTab)}
        ariaLabel="Unified development sections"
      />
      <div className="ui-decision-strip flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
        <div className="text-xs">
          <div className="font-semibold text-neutral-100">Technical operations desk</div>
          <div className="text-neutral-400">{usedCapacity >= capacity ? 'All technical capacity is committed.' : `${usedCapacity} active technical program${usedCapacity === 1 ? '' : 's'}.`}</div>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{usedCapacity}/{capacity} technical capacity</span>
      </div>
      {singleSeason && <div className="rounded-lg border border-[var(--era-border-strong)] bg-[var(--era-accent-soft)] p-3 text-sm text-[var(--era-accent-strong)]">Single Season Mode allows in-season quick upgrades only. Multi-year research is disabled.</div>}
      {capacityFull && <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-300">All technical capacity is in use. Start actions are disabled until capacity is freed.</div>}

      {tab === 'programs' && (
        <Panel title="Technical programs" actions={<span className="text-xs text-neutral-500">Cash = operations · TPP = long-term research currency</span>}>
          <div className="mb-3 flex flex-wrap gap-2">
            <FilterSelect label="Horizon" value={horizon} options={['Quick Upgrade', 'Research']} onChange={(value) => setHorizon(value as ProgramFilter)} />
            <FilterSelect label="Branch / category" value={area} options={areas} onChange={setArea} />
            <FilterSelect label="Risk" value={risk} options={risks} onChange={setRisk} />
            <FilterSelect label="Sort" value={sort} options={['cost', 'duration']} onChange={(value) => setSort(value as 'cost' | 'duration')} />
          </div>
          <TechnicalTable>
            <TechnicalTableHead><TechnicalTableRow><TechnicalTableCell header>Program</TechnicalTableCell><TechnicalTableCell header>Horizon / area</TechnicalTableCell><TechnicalTableCell header>Cost</TechnicalTableCell><TechnicalTableCell header>Duration</TechnicalTableCell><TechnicalTableCell header>Risk</TechnicalTableCell><TechnicalTableCell header>Expected effect</TechnicalTableCell><TechnicalTableCell header>Action</TechnicalTableCell></TechnicalTableRow></TechnicalTableHead>
            <tbody>
              {conventionalProjects.map((project) => {
                const facilityLevel = relevantFacilityLevel(state.facilities, project.category);
                const size = project.projectSize ?? 'Medium';
                const riskLevel = project.riskLevel ?? 'Standard';
                const adjustedDuration = computeAdjustedDuration(project.durationRaces, facilityLevel, size);
                const rushCost = Math.round(project.cost * RUSH_COST_MULTIPLIER());
                const allowed = isDevelopmentProjectAllowedForMode(project, state.gameMode);
                const canStart = !capacityFull && allowed && budget >= project.cost;
                return (
                  <TechnicalTableRow key={`quick-${project.id}`}>
                    <TechnicalTableCell><div className="font-semibold text-neutral-100">{project.name}</div><details className="text-neutral-500"><summary className="cursor-pointer">Details</summary><div className="mt-1 space-y-1">Facility L{Math.round(facilityLevel)} · Impact ×{facilityImpactMultiplier(facilityLevel).toFixed(1)} · {Math.round(project.carryoverRate * 100)}% carryover<div>{outcomeSummary(project)}</div>{project.risk && <div className="text-orange-400/80">⚠ {project.risk}</div>}{!allowed && <div className="text-amber-400">Future-only in Single Season</div>}</div></details></TechnicalTableCell>
                    <TechnicalTableCell><span className="text-[var(--era-accent-strong)]">Quick Upgrade</span><div className="text-neutral-500">{project.category} · {project.horizon}</div></TechnicalTableCell>
                    <TechnicalTableCell className="font-semibold tabular-nums">{formatMoney(project.cost)}<div className="text-neutral-500">Rush {formatMoney(rushCost)}</div></TechnicalTableCell>
                    <TechnicalTableCell>{adjustedDuration} races<div className="text-neutral-500">Base {project.durationRaces}</div></TechnicalTableCell>
                    <TechnicalTableCell className={RISK_COLORS[riskLevel]}>{riskLevel}<div className="text-neutral-500">{size}</div></TechnicalTableCell>
                    <TechnicalTableCell className="max-w-xs text-neutral-400">{effectSummary(project)}</TechnicalTableCell>
                    <TechnicalTableCell><div className="flex flex-col gap-1"><Button className="px-2 py-1 text-xs" variant={canStart ? 'primary' : 'secondary'} disabled={!canStart} onClick={() => dispatch({ type: 'START_DEVELOPMENT', projectId: project.id })}>{!allowed ? 'Future-only' : capacityFull ? 'No capacity' : budget < project.cost ? 'No budget' : 'Start'}</Button><Button className="px-2 py-1 text-xs" variant={!capacityFull && allowed && budget >= rushCost ? 'primary' : 'secondary'} disabled={capacityFull || !allowed || budget < rushCost} onClick={() => dispatch({ type: 'START_DEVELOPMENT', projectId: project.id, rushed: true })}>{!allowed ? 'Future-only' : capacityFull ? 'No capacity' : budget < rushCost ? 'No budget' : `Rush ${formatMoney(rushCost)}`}</Button></div></TechnicalTableCell>
                  </TechnicalTableRow>
                );
              })}
              {researchPrograms.map((node) => {
                const request = researchRequests[node.id];
                const cashCost = adjustedResearchCashCost(cashCostForBand(node.cashCostBand, budget, state.series, state.seasonYear), research);
                const tppCost = tppCostForBand(node.tppCostBand);
                const duration = adjustedResearchDuration(durationRoundsForBand(node.durationBand, state.calendar.length), research);
                const effects = request.modifierTemplates.filter((modifier) => modifier.scope !== 'risk').map((modifier) => `${modifier.target} ${modifier.value >= 0 ? '+' : ''}${modifier.value}`).join(' · ');
                const canStart = !capacityFull && !singleSeason && budget >= cashCost && research.tpp.balance >= tppCost;
                return <TechnicalTableRow key={`research-${node.id}`}><TechnicalTableCell><div className="font-semibold text-neutral-100">{request.displayName}</div><details className="text-neutral-500"><summary className="cursor-pointer">Details</summary><div className="mt-1 space-y-1">Tier {node.tier} · {node.path}<div>Prerequisites: {node.unlockRequirement || 'None'}</div><div>{request.availabilityLabel}{request.availabilityReason ? ` · ${request.availabilityReason}` : ''}</div><div>{node.mainEffects}</div>{node.tradeoffsAndRisks && <div className="text-orange-400/80">⚠ {node.tradeoffsAndRisks}</div>}</div></details></TechnicalTableCell><TechnicalTableCell><span className="text-blue-300">Research</span><div className="text-neutral-500">{rdBranchLabelForSeries(node.branchId, state.series)}</div></TechnicalTableCell><TechnicalTableCell className="font-semibold tabular-nums">{formatMoney(cashCost)}<div className="text-neutral-500">{tppCost} TPP</div></TechnicalTableCell><TechnicalTableCell>{duration} rounds<div className="text-neutral-500">Tier {node.tier}</div></TechnicalTableCell><TechnicalTableCell className={RISK_COLORS[request.riskLevel]}>{request.riskLevel}</TechnicalTableCell><TechnicalTableCell className="max-w-xs text-neutral-400">{effects || 'Persistent research modifier'}<div className="text-neutral-500">{node.partsUnlocked || node.mainEffects}</div></TechnicalTableCell><TechnicalTableCell><Button className="px-2 py-1 text-xs" variant={canStart ? 'primary' : 'secondary'} disabled={!canStart} onClick={() => dispatch({ type: 'START_RD_PROJECT', request })}>{singleSeason ? 'Career only' : capacityFull ? 'No capacity' : budget < cashCost ? 'No budget' : research.tpp.balance < tppCost ? 'No TPP' : 'Start research'}</Button></TechnicalTableCell></TechnicalTableRow>;
              })}
              {conventionalProjects.length === 0 && researchPrograms.length === 0 && <TechnicalTableRow><TechnicalTableCell className="text-center text-neutral-500">No actionable programs match these filters. Open Tree to inspect locked or completed research.</TechnicalTableCell></TechnicalTableRow>}
            </tbody>
          </TechnicalTable>
        </Panel>
      )}

      {tab === 'in-progress' && <InProgressPanel />}
      {tab === 'tree' && <RDTreePanel compactTree />}
      {tab === 'history' && <HistoryPanel />}
    </WorkspaceBody>
  );

  function InProgressPanel() {
    return <Panel title="In Progress">{conventionalActive === 0 && researchActive === 0 ? <p className="text-sm text-neutral-500">No technical programs are currently in progress.</p> : <TechnicalTable><TechnicalTableHead><TechnicalTableRow><TechnicalTableCell header>Program</TechnicalTableCell><TechnicalTableCell header>Horizon</TechnicalTableCell><TechnicalTableCell header>Progress</TechnicalTableCell><TechnicalTableCell header>Risk / area</TechnicalTableCell><TechnicalTableCell header>Action</TechnicalTableCell></TechnicalTableRow></TechnicalTableHead><tbody>{currentState.activeDevelopmentProjects.map((project) => { const duration = project.adjustedDurationRaces ?? project.durationRaces; const progress = Math.min(100, project.progressRaces / duration * 100); return <TechnicalTableRow key={`active-quick-${project.id}`}><TechnicalTableCell className="font-semibold text-neutral-100">{project.name}{project.rushed && <span className="ml-2 text-red-300">Rushed</span>}</TechnicalTableCell><TechnicalTableCell className="text-[var(--era-accent-strong)]">Quick Upgrade</TechnicalTableCell><TechnicalTableCell><ProgressBar label={`${project.progressRaces}/${duration} races`} percent={progress} /></TechnicalTableCell><TechnicalTableCell>{project.riskLevel ?? 'Standard'} · {project.projectSize ?? 'Medium'}</TechnicalTableCell><TechnicalTableCell>{!project.rushed && <button className="text-orange-400 hover:text-orange-300" onClick={() => dispatch({ type: 'RUSH_DEVELOPMENT', projectId: project.id })}>Rush {formatMoney(Math.round(project.cost * 0.5))}</button>}</TechnicalTableCell></TechnicalTableRow>; })}{research.activeProjects.map((project) => <TechnicalTableRow key={`active-research-${project.id}`}><TechnicalTableCell className="font-semibold text-neutral-100">{project.nodeName ?? project.nodeId}</TechnicalTableCell><TechnicalTableCell className="text-blue-300">Research</TechnicalTableCell><TechnicalTableCell><ProgressBar label={`${project.progressRounds}/${project.durationRounds} rounds`} percent={Math.min(100, project.progressRounds / project.durationRounds * 100)} /></TechnicalTableCell><TechnicalTableCell>{project.riskLevel ?? 'Standard'} · Tier {project.tier ?? '—'}</TechnicalTableCell><TechnicalTableCell className="text-neutral-500">{Math.max(0, project.durationRounds - project.progressRounds)} rounds remaining</TechnicalTableCell></TechnicalTableRow>)}</tbody></TechnicalTable>}</Panel>;
  }

  function HistoryPanel() {
    const completedProjects = [...currentState.completedDevelopmentProjects].reverse();
    return <Panel title="Technical history">{completedProjects.length === 0 && research.projectHistory.length === 0 && research.completedNodes.length === 0 && research.tpp.ledger.length === 0 ? <p className="text-sm text-neutral-500">No completed technical work or TPP activity yet.</p> : <div className="space-y-4"><TechnicalTable><TechnicalTableHead><TechnicalTableRow><TechnicalTableCell header>Season / round</TechnicalTableCell><TechnicalTableCell header>Program</TechnicalTableCell><TechnicalTableCell header>Type</TechnicalTableCell><TechnicalTableCell header>Outcome</TechnicalTableCell><TechnicalTableCell header>Effect / description</TechnicalTableCell></TechnicalTableRow></TechnicalTableHead><tbody>{completedProjects.map((project) => { const result = project.outcomeResult; return <TechnicalTableRow key={`history-quick-${project.id}`}><TechnicalTableCell>{currentState.seasonYear}</TechnicalTableCell><TechnicalTableCell className="font-semibold text-neutral-100">{project.name}</TechnicalTableCell><TechnicalTableCell className="text-[var(--era-accent-strong)]">Quick Upgrade</TechnicalTableCell><TechnicalTableCell className={result ? OUTCOME_COLORS[result.outcome] : 'text-neutral-500'}>{result?.label ?? 'No result'}</TechnicalTableCell><TechnicalTableCell className="max-w-md text-neutral-400">{result?.description ?? effectSummary(project)}<div className="text-neutral-500">{result ? `Expected: ${Object.entries(result.expectedGain).map(([key, value]) => `+${value} ${key}`).join(', ') || 'N/A'} · Actual: ${Object.entries(result.actualGain).map(([key, value]) => `${value >= 0 ? '+' : ''}${value} ${key}`).join(', ') || 'No gain'}` : 'No outcome recorded'}</div></TechnicalTableCell></TechnicalTableRow>; })}{research.projectHistory.slice().reverse().map((entry) => <TechnicalTableRow key={`history-research-${entry.projectId}`}><TechnicalTableCell>{entry.seasonYear} · R{entry.round}</TechnicalTableCell><TechnicalTableCell className="font-semibold text-neutral-100">{entry.nodeName}</TechnicalTableCell><TechnicalTableCell className="text-blue-300">Research</TechnicalTableCell><TechnicalTableCell className={OUTCOME_COLORS[entry.outcomeResult.outcome]}>{entry.outcomeResult.label}</TechnicalTableCell><TechnicalTableCell className="max-w-md text-neutral-400">{entry.outcomeResult.description}</TechnicalTableCell></TechnicalTableRow>)}{research.completedNodes.filter((node) => !research.projectHistory.some((entry) => entry.nodeId === node.nodeId)).map((node) => <TechnicalTableRow key={`history-node-${node.nodeId}`}><TechnicalTableCell>{node.completedSeasonYear} · R{node.completedRound}</TechnicalTableCell><TechnicalTableCell className="font-semibold text-neutral-100">{node.nodeId}</TechnicalTableCell><TechnicalTableCell className="text-blue-300">Completed node</TechnicalTableCell><TechnicalTableCell className="text-emerald-300">{node.outcomeResult?.label ?? 'Completed'}</TechnicalTableCell><TechnicalTableCell className="text-neutral-400">Tier {node.tier ?? '—'} · {node.branchId ?? 'Research'}</TechnicalTableCell></TechnicalTableRow>)}</tbody></TechnicalTable>{research.tpp.ledger.length > 0 && <div><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">TPP ledger</div><TechnicalTable><TechnicalTableHead><TechnicalTableRow><TechnicalTableCell header>Season / round</TechnicalTableCell><TechnicalTableCell header>Transaction</TechnicalTableCell><TechnicalTableCell header>Reason</TechnicalTableCell><TechnicalTableCell header>Balance</TechnicalTableCell></TechnicalTableRow></TechnicalTableHead><tbody>{research.tpp.ledger.slice().reverse().map((entry) => <TechnicalTableRow key={entry.id}><TechnicalTableCell>{entry.seasonYear} · R{entry.round}</TechnicalTableCell><TechnicalTableCell>{entry.description}</TechnicalTableCell><TechnicalTableCell>{entry.reason}</TechnicalTableCell><TechnicalTableCell className={entry.amount >= 0 ? 'text-emerald-400' : 'text-amber-400'}>{entry.amount >= 0 ? '+' : ''}{entry.amount} TPP · {entry.balanceAfter} remaining</TechnicalTableCell></TechnicalTableRow>)}</tbody></TechnicalTable></div>}</div>}</Panel>;
  }
}

function ProgressBar({ label, percent }: { label: string; percent: number }) {
  return <div className="min-w-36"><div className="mb-1 flex justify-between text-neutral-500"><span>{label}</span><span>{Math.round(percent)}%</span></div><div className="h-1.5 rounded bg-neutral-800"><div className="h-full rounded bg-[var(--era-accent)]" style={{ width: `${percent}%` }} /></div></div>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="flex items-center gap-2 text-xs text-neutral-500">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"><option value="All">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
