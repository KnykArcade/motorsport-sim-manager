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
import { activeUpgradePrograms, completedUpgradePrograms, researchStateFromTechnical, technicalStateForTeam } from '../sim/technicalAdapters';
import { RDTreePanel } from '../components/development/RDTreePanel';
import { TppExplainer } from '../components/development/TppExplainer';
import { WorkspaceBody, WorkspaceTabs } from '../components/workspace/Workspace';
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
  selectedTechnicalRecord,
  technicalActionDisabledReason,
} from './technicalCommercialViewModel';

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

export function UnifiedDevelopmentBody() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<UnifiedTab>('programs');
  const [horizon, setHorizon] = useState<ProgramFilter>('All');
  const [area, setArea] = useState('All');
  const [risk, setRisk] = useState('All');
  const [sort, setSort] = useState<'cost' | 'duration'>('cost');
  const [selectedProgramId, setSelectedProgramId] = useState<string>();
  if (!state) return null;
  const currentState = state;

  const team = teamById(state, state.selectedTeamId);
  const budget = team?.budget ?? 0;
  const currentTechnical = technicalStateForTeam(state, state.selectedTeamId);
  const research = researchStateFromTechnical(currentTechnical)
    ?? createInitialTeamResearch(state.selectedTeamId, state.seasonYear);
  const singleSeason = isSingleSeasonMode(state.gameMode);
  const capacity = developmentSlots(state.facilities);
  const activeUpgrades = activeUpgradePrograms(state);
  const completedUpgrades = completedUpgradePrograms(state);
  const conventionalActive = currentTechnical?.activeProjects.filter((project) => project.kind === 'upgrade').length
    ?? activeUpgrades.length;
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
  const programRecords = [
    ...conventionalProjects.map((project) => ({
      id: `quick:${project.id}`,
      kind: 'quick' as const,
      title: project.name,
      subtitle: `${project.category} · ${project.riskLevel ?? 'Standard'}`,
      project,
    })),
    ...researchPrograms.map((node) => ({
      id: `research:${node.id}`,
      kind: 'research' as const,
      title: researchRequests[node.id].displayName,
      subtitle: `${rdBranchLabelForSeries(node.branchId, state.series)} · Tier ${node.tier}`,
      node,
    })),
  ];
  const selectedProgram = selectedTechnicalRecord(programRecords, selectedProgramId);

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
          { id: 'history', label: `History (${completedUpgrades.length + research.projectHistory.length})` },
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
        <div className="ui-development-program-workspace">
          <FmWorkspaceGrid columns="three" className="ui-development-program-grid">
            <FmPane className="ui-development-program-list">
              <FmPaneHeader title="Available programs" meta={`${programRecords.length} matching`} actions={<TppExplainer />} />
              <FmPaneBody className="overflow-auto">
                <div className="ui-development-filters">
                  <FilterSelect label="Horizon" value={horizon} options={['Quick Upgrade', 'Research']} onChange={(value) => setHorizon(value as ProgramFilter)} />
                  <FilterSelect label="Area" value={area} options={areas} onChange={setArea} />
                  <FilterSelect label="Risk" value={risk} options={risks} onChange={setRisk} />
                  <FilterSelect label="Sort" value={sort} options={['cost', 'duration']} onChange={(value) => setSort(value as 'cost' | 'duration')} />
                </div>
                {programRecords.map((program) => (
                  <FmListButton
                    key={program.id}
                    active={selectedProgram?.id === program.id}
                    onClick={() => setSelectedProgramId(program.id)}
                  >
                    <span>{program.kind === 'quick' ? 'Quick upgrade' : 'Research'}</span>
                    <strong>{program.title}</strong>
                    <small>{program.subtitle}</small>
                  </FmListButton>
                ))}
                {programRecords.length === 0 && <p className="ui-technical-empty">No actionable programs match these filters. Open Tree to inspect locked or completed research.</p>}
              </FmPaneBody>
            </FmPane>

            <FmPane className="ui-development-program-detail">
              <FmPaneHeader title={selectedProgram?.title ?? 'Program dossier'} meta={selectedProgram?.subtitle} />
              <FmPaneBody className="overflow-auto">
                {selectedProgram?.kind === 'quick' && (() => {
                  const project = selectedProgram.project;
                  const facilityLevel = relevantFacilityLevel(state.facilities, project.category);
                  const size = project.projectSize ?? 'Medium';
                  const riskLevel = project.riskLevel ?? 'Standard';
                  const adjustedDuration = computeAdjustedDuration(project.durationRaces, facilityLevel, size);
                  return (
                    <div className="ui-technical-dossier">
                      <section>
                        <h3>Expected outcome</h3>
                        <p>{effectSummary(project)}</p>
                        <p className="ui-technical-muted">{outcomeSummary(project)}</p>
                      </section>
                      <section>
                        <FmKeyValue label="Programme" value="Quick Upgrade" />
                        <FmKeyValue label="Category" value={project.category} />
                        <FmKeyValue label="Cost" value={formatMoney(project.cost)} />
                        <FmKeyValue label="Duration" value={`${adjustedDuration} races · base ${project.durationRaces}`} />
                        <FmKeyValue label="Risk / size" value={`${riskLevel} · ${size}`} />
                        <FmKeyValue label="Carryover" value={`${Math.round(project.carryoverRate * 100)}%`} />
                      </section>
                      <section>
                        <h3>Facility effect</h3>
                        <p>Relevant facility level {Math.round(facilityLevel)} · impact ×{facilityImpactMultiplier(facilityLevel).toFixed(1)}.</p>
                        {project.risk && <p className="ui-technical-warning">{project.risk}</p>}
                      </section>
                    </div>
                  );
                })()}
                {selectedProgram?.kind === 'research' && (() => {
                  const node = selectedProgram.node;
                  const request = researchRequests[node.id];
                  const cashCost = adjustedResearchCashCost(cashCostForBand(node.cashCostBand, budget, state.series, state.seasonYear), research);
                  const tppCost = tppCostForBand(node.tppCostBand);
                  const duration = adjustedResearchDuration(durationRoundsForBand(node.durationBand, state.calendar.length), research);
                  const effects = request.modifierTemplates.filter((modifier) => modifier.scope !== 'risk').map((modifier) => `${modifier.target} ${modifier.value >= 0 ? '+' : ''}${modifier.value}`).join(' · ');
                  return (
                    <div className="ui-technical-dossier">
                      <section>
                        <h3>Research outcome</h3>
                        <p>{effects || 'Persistent research modifier'}</p>
                        <p className="ui-technical-muted">{node.partsUnlocked || node.mainEffects}</p>
                      </section>
                      <section>
                        <FmKeyValue label="Programme" value="Multi-year research" />
                        <FmKeyValue label="Branch" value={rdBranchLabelForSeries(node.branchId, state.series)} />
                        <FmKeyValue label="Cost" value={`${formatMoney(cashCost)} · ${tppCost} TPP`} />
                        <FmKeyValue label="Duration" value={`${duration} rounds`} />
                        <FmKeyValue label="Tier / risk" value={`${node.tier} · ${request.riskLevel}`} />
                        <FmKeyValue label="Prerequisites" value={node.unlockRequirement || 'None'} />
                      </section>
                      <section>
                        <h3>Availability</h3>
                        <p>{request.availabilityLabel}{request.availabilityReason ? ` · ${request.availabilityReason}` : ''}</p>
                        {node.tradeoffsAndRisks && <p className="ui-technical-warning">{node.tradeoffsAndRisks}</p>}
                      </section>
                    </div>
                  );
                })()}
              </FmPaneBody>
            </FmPane>

            <FmPane className="ui-development-program-context">
              <FmPaneHeader title="Technical Director" meta="Programme context" />
              <FmPaneBody className="overflow-auto">
                <div className="ui-technical-dossier">
                  <section>
                    <FmKeyValue label="Available cash" value={formatMoney(budget)} />
                    <FmKeyValue label="Research points" value={`${research.tpp.balance} TPP`} />
                    <FmKeyValue label="Capacity" value={`${usedCapacity}/${capacity} in use`} />
                    <FmKeyValue label="Success support" value={`+${Math.round(totalSuccessBonus * 100)}%`} />
                  </section>
                  <section>
                    <h3>Advisor readout</h3>
                    <p>{capacityFull ? 'Complete an active programme before committing another technical slot.' : 'Capacity is available for a new technical programme.'}</p>
                    <p className="ui-technical-muted">Every cost, duration, outcome range, prerequisite, and mode restriction is taken from the live technical state.</p>
                  </section>
                </div>
              </FmPaneBody>
            </FmPane>
          </FmWorkspaceGrid>

          <FmDecisionBar actions={selectedProgram && (() => {
            if (selectedProgram.kind === 'quick') {
              const project = selectedProgram.project;
              const rushCost = Math.round(project.cost * RUSH_COST_MULTIPLIER());
              const allowed = isDevelopmentProjectAllowedForMode(project, state.gameMode);
              const startReason = technicalActionDisabledReason({ modeAllowed: allowed, capacityFull, cashAvailable: budget, cashCost: project.cost });
              const rushReason = technicalActionDisabledReason({ modeAllowed: allowed, capacityFull, cashAvailable: budget, cashCost: rushCost });
              return (
                <>
                  <Button variant="secondary" disabled={!!startReason} title={startReason} onClick={() => dispatch({ type: 'START_DEVELOPMENT', projectId: project.id })}>Start · {formatMoney(project.cost)}</Button>
                  <Button variant="primary" disabled={!!rushReason} title={rushReason} onClick={() => dispatch({ type: 'START_DEVELOPMENT', projectId: project.id, rushed: true })}>Rush · {formatMoney(rushCost)}</Button>
                </>
              );
            }
            const node = selectedProgram.node;
            const request = researchRequests[node.id];
            const cashCost = adjustedResearchCashCost(cashCostForBand(node.cashCostBand, budget, state.series, state.seasonYear), research);
            const tppCost = tppCostForBand(node.tppCostBand);
            const disabledReason = technicalActionDisabledReason({ modeAllowed: !singleSeason, capacityFull, cashAvailable: budget, cashCost, tppAvailable: research.tpp.balance, tppCost });
            return <Button variant="primary" disabled={!!disabledReason} title={disabledReason} onClick={() => dispatch({ type: 'START_RD_PROJECT', request })}>Start research · {formatMoney(cashCost)} · {tppCost} TPP</Button>;
          })()}>
            <strong>{selectedProgram?.title ?? 'Select a technical programme'}</strong>
            <span>{selectedProgram ? 'Review the complete dossier and commit the selected programme.' : 'No programme matches the current filters.'}</span>
          </FmDecisionBar>
        </div>
      )}

      {tab === 'in-progress' && <InProgressPanel />}
      {tab === 'tree' && <RDTreePanel compactTree />}
      {tab === 'history' && <HistoryPanel />}
    </WorkspaceBody>
  );

  function InProgressPanel() {
    return <Panel title="In Progress">{conventionalActive === 0 && researchActive === 0 ? <p className="text-sm text-neutral-500">No technical programs are currently in progress.</p> : <TechnicalTable><TechnicalTableHead><TechnicalTableRow><TechnicalTableCell header>Program</TechnicalTableCell><TechnicalTableCell header>Horizon</TechnicalTableCell><TechnicalTableCell header>Progress</TechnicalTableCell><TechnicalTableCell header>Risk / area</TechnicalTableCell><TechnicalTableCell header>Action</TechnicalTableCell></TechnicalTableRow></TechnicalTableHead><tbody>{activeUpgrades.map((project) => { const duration = project.adjustedDurationRaces ?? project.durationRaces; const progress = Math.min(100, project.progressRaces / duration * 100); return <TechnicalTableRow key={`active-quick-${project.id}`}><TechnicalTableCell className="font-semibold text-neutral-100">{project.name}{project.rushed && <span className="ml-2 text-red-300">Rushed</span>}</TechnicalTableCell><TechnicalTableCell className="text-[var(--era-accent-strong)]">Quick Upgrade</TechnicalTableCell><TechnicalTableCell><ProgressBar label={`${project.progressRaces}/${duration} races`} percent={progress} /></TechnicalTableCell><TechnicalTableCell>{project.riskLevel ?? 'Standard'} · {project.projectSize ?? 'Medium'}</TechnicalTableCell><TechnicalTableCell>{!project.rushed && <button className="text-orange-400 hover:text-orange-300" onClick={() => dispatch({ type: 'RUSH_DEVELOPMENT', projectId: project.id })}>Rush {formatMoney(Math.round(project.cost * 0.5))}</button>}</TechnicalTableCell></TechnicalTableRow>; })}{research.activeProjects.map((project) => <TechnicalTableRow key={`active-research-${project.id}`}><TechnicalTableCell className="font-semibold text-neutral-100">{project.nodeName ?? project.nodeId}</TechnicalTableCell><TechnicalTableCell className="text-blue-300">Research</TechnicalTableCell><TechnicalTableCell><ProgressBar label={`${project.progressRounds}/${project.durationRounds} rounds`} percent={Math.min(100, project.progressRounds / project.durationRounds * 100)} /></TechnicalTableCell><TechnicalTableCell>{project.riskLevel ?? 'Standard'} · Tier {project.tier ?? '—'}</TechnicalTableCell><TechnicalTableCell className="text-neutral-500">{Math.max(0, project.durationRounds - project.progressRounds)} rounds remaining</TechnicalTableCell></TechnicalTableRow>)}</tbody></TechnicalTable>}</Panel>;
  }

  function HistoryPanel() {
    const completedProjects = [...completedUpgrades].reverse();
    return <Panel title="Technical history">{completedProjects.length === 0 && research.projectHistory.length === 0 && research.completedNodes.length === 0 && research.tpp.ledger.length === 0 ? <p className="text-sm text-neutral-500">No completed technical work or TPP activity yet.</p> : <div className="space-y-4"><TechnicalTable><TechnicalTableHead><TechnicalTableRow><TechnicalTableCell header>Season / round</TechnicalTableCell><TechnicalTableCell header>Program</TechnicalTableCell><TechnicalTableCell header>Type</TechnicalTableCell><TechnicalTableCell header>Outcome</TechnicalTableCell><TechnicalTableCell header>Effect / description</TechnicalTableCell></TechnicalTableRow></TechnicalTableHead><tbody>{completedProjects.map((project) => { const result = project.outcomeResult; return <TechnicalTableRow key={`history-quick-${project.id}`}><TechnicalTableCell>{currentState.seasonYear}</TechnicalTableCell><TechnicalTableCell className="font-semibold text-neutral-100">{project.name}</TechnicalTableCell><TechnicalTableCell className="text-[var(--era-accent-strong)]">Quick Upgrade</TechnicalTableCell><TechnicalTableCell className={result ? OUTCOME_COLORS[result.outcome] : 'text-neutral-500'}>{result?.label ?? 'No result'}</TechnicalTableCell><TechnicalTableCell className="max-w-md text-neutral-400">{result?.description ?? effectSummary(project)}<div className="text-neutral-500">{result ? `Expected: ${Object.entries(result.expectedGain).map(([key, value]) => `+${value} ${key}`).join(', ') || 'N/A'} · Actual: ${Object.entries(result.actualGain).map(([key, value]) => `${value >= 0 ? '+' : ''}${value} ${key}`).join(', ') || 'No gain'}` : 'No outcome recorded'}</div></TechnicalTableCell></TechnicalTableRow>; })}{research.projectHistory.slice().reverse().map((entry) => <TechnicalTableRow key={`history-research-${entry.projectId}`}><TechnicalTableCell>{entry.seasonYear} · R{entry.round}</TechnicalTableCell><TechnicalTableCell className="font-semibold text-neutral-100">{entry.nodeName}</TechnicalTableCell><TechnicalTableCell className="text-blue-300">Research</TechnicalTableCell><TechnicalTableCell className={OUTCOME_COLORS[entry.outcomeResult.outcome]}>{entry.outcomeResult.label}</TechnicalTableCell><TechnicalTableCell className="max-w-md text-neutral-400">{entry.outcomeResult.description}</TechnicalTableCell></TechnicalTableRow>)}{research.completedNodes.filter((node) => !research.projectHistory.some((entry) => entry.nodeId === node.nodeId)).map((node) => <TechnicalTableRow key={`history-node-${node.nodeId}`}><TechnicalTableCell>{node.completedSeasonYear} · R{node.completedRound}</TechnicalTableCell><TechnicalTableCell className="font-semibold text-neutral-100">{node.nodeId}</TechnicalTableCell><TechnicalTableCell className="text-blue-300">Completed node</TechnicalTableCell><TechnicalTableCell className="text-emerald-300">{node.outcomeResult?.label ?? 'Completed'}</TechnicalTableCell><TechnicalTableCell className="text-neutral-400">Tier {node.tier ?? '—'} · {node.branchId ?? 'Research'}</TechnicalTableCell></TechnicalTableRow>)}</tbody></TechnicalTable>{research.tpp.ledger.length > 0 && <div><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">TPP ledger</div><TechnicalTable><TechnicalTableHead><TechnicalTableRow><TechnicalTableCell header>Season / round</TechnicalTableCell><TechnicalTableCell header>Transaction</TechnicalTableCell><TechnicalTableCell header>Reason</TechnicalTableCell><TechnicalTableCell header>Balance</TechnicalTableCell></TechnicalTableRow></TechnicalTableHead><tbody>{research.tpp.ledger.slice().reverse().map((entry) => <TechnicalTableRow key={entry.id}><TechnicalTableCell>{entry.seasonYear} · R{entry.round}</TechnicalTableCell><TechnicalTableCell>{entry.description}</TechnicalTableCell><TechnicalTableCell>{entry.reason}</TechnicalTableCell><TechnicalTableCell className={entry.amount >= 0 ? 'text-emerald-400' : 'text-amber-400'}>{entry.amount >= 0 ? '+' : ''}{entry.amount} TPP · {entry.balanceAfter} remaining</TechnicalTableCell></TechnicalTableRow>)}</tbody></TechnicalTable></div>}</div>}</Panel>;
  }
}

function ProgressBar({ label, percent }: { label: string; percent: number }) {
  return <div className="min-w-36"><div className="mb-1 flex justify-between text-neutral-500"><span>{label}</span><span>{Math.round(percent)}%</span></div><div className="h-1.5 rounded bg-neutral-800"><div className="h-full rounded bg-[var(--era-accent)]" style={{ width: `${percent}%` }} /></div></div>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="flex items-center gap-2 text-xs text-neutral-500">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"><option value="All">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
