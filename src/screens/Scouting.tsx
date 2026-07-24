import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import { fogView, scoutingCost, type FogView, type ScoutTarget } from '../sim/scoutingEngine';
import { formatMoney, ratingColor } from '../components/ui';
import type { ScoutedEntityType } from '../types/scoutingTypes';
import type { IntelligenceAction, IntelligenceReport } from '../types/phase18Types';
import { INTELLIGENCE_INVESTIGATION_COST, intelligenceConfidenceLabel } from '../sim/phase18IntelligenceEngine';
import {
  scoutingAssignments,
  scoutingComparison,
  scoutingReportFreshness,
  sortScoutingListItems,
  type ScoutingListItem,
  type ScoutingListSort,
  type ScoutingListSortKey,
} from './scoutingViewModel';
import { recruitmentDecisionDesk } from './recruitmentDecisionViewModel';

type Tab = 'intelligence' | 'senior' | 'youth';
type ScoutingTargetRow = ScoutingListItem & {
  subtitle: string;
  assigned: boolean;
  shortlisted: boolean;
  onScout: () => void;
  onToggleShortlist: () => void;
  onApproach?: () => void;
  freshness?: 'Fresh' | 'Current' | 'Stale';
};

export function Scouting() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('intelligence');
  const [intelFilter, setIntelFilter] = useState<'Active' | 'History'>('Active');
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [scoutingSort, setScoutingSort] = useState<ScoutingListSort>({ key: 'overall', direction: 'desc' });
  const requestedTab = searchParams.get('tab');
  const focusedTargetId = searchParams.get('target');

  const bundle = useMemo(
    () => (state ? careerMarketBundle(state) : undefined),
    [state],
  );

  if (!state) return null;

  const scouting = state.scouting;
  if (!scouting) {
    return (
      <WorkspaceScreen className="era-feature-screen era-scouting">
        <WorkspaceHeader eyebrow="Recruitment center" title="Intelligence" subtitle="Scouting is available in Career Mode." />
        <WorkspaceBody>
          <Panel title="Scouting">
            <p className="text-sm text-neutral-400">Scouting is available in Career Mode.</p>
          </Panel>
        </WorkspaceBody>
      </WorkspaceScreen>
    );
  }

  const networkPct = Math.round(scouting.networkAccuracy * 100);
  const budget = teamById(state, state.selectedTeamId)?.budget ?? 0;

  const view = (target: ScoutTarget, entityType: ScoutedEntityType = 'Driver'): FogView =>
    fogView(target, scouting.reports[target.id], scouting.networkAccuracy, state.randomSeed, entityType);

  const costOf = (entityId: string, entityType: ScoutedEntityType): number =>
    scoutingCost(entityType, scouting.reports[entityId]?.scoutingLevel ?? 0);
  const intelligenceReports = state.phase18?.intelligenceReports ?? [];
  const activeIntelligence = intelligenceReports.filter(
    (report) => (report.status ?? 'Active') === 'Active',
  ).length;
  const scoutingTabs: Array<{ id: Tab; label: string }> = [
    { id: 'intelligence', label: `Paddock Intelligence (${activeIntelligence})` },
    { id: 'senior', label: `Senior Targets (${bundle?.drivers.length ?? 0})` },
    { id: 'youth', label: `Youth Targets (${bundle?.youth.length ?? 0})` },
  ];
  const focus = scouting.recruitmentFocus ?? {};
  const currentRound = state.calendar[state.currentRaceIndex]?.round ?? state.currentRaceIndex + 1;
  const updateFocus = (patch: Partial<typeof focus>) => dispatch({ type: 'SET_RECRUITMENT_FOCUS', focus: { ...focus, ...patch } });
  const targetNames = Object.fromEntries([
    ...(bundle?.drivers ?? []).map((driver) => [driver.id, driver.name] as const),
    ...(bundle?.youth ?? []).map((prospect) => [prospect.id, prospect.name] as const),
  ]);
  const activeTab = requestedTab === 'senior' || requestedTab === 'youth' || requestedTab === 'intelligence'
    ? requestedTab
    : tab;
  const focusedTargetName = focusedTargetId ? targetNames[focusedTargetId] : undefined;
  const focusedDecisionDesk = focusedTargetId ? recruitmentDecisionDesk(state, focusedTargetId) : null;
  const assignments = scoutingAssignments(
    scouting.reports,
    scouting.networkAccuracy,
    targetNames,
    activeTab === 'senior' ? 'Driver' : activeTab === 'youth' ? 'YouthProspect' : undefined,
    scouting.activeAssignments,
    state.seasonYear,
    currentRound,
  );
  const shortlist = (scouting.shortlist ?? []).filter((entry) =>
    activeTab === 'senior' ? entry.entityType === 'Driver' : activeTab === 'youth' ? entry.entityType === 'YouthProspect' : false,
  );
  const shortlistTargets = shortlist.flatMap((entry) => {
    const target = entry.entityType === 'Driver'
      ? bundle?.drivers.find((driver) => driver.id === entry.entityId)
      : entry.entityType === 'YouthProspect'
        ? bundle?.youth.find((prospect) => prospect.id === entry.entityId)
      : undefined;
    if (!target) return [];
    const scoutTarget = { id: target.id, skills: (target as (NonNullable<typeof bundle>['drivers'][number])).skills, potential: (target as (NonNullable<typeof bundle>['drivers'][number])).potential };
    return [{
      entityId: target.id,
      name: target.name,
      entityType: entry.entityType,
      view: view(scoutTarget, entry.entityType),
    }];
  });
  const comparisons = scoutingComparison(
    shortlistTargets.filter((target) => comparisonIds.includes(target.entityId)),
  );

  const seniorRows: ScoutingTargetRow[] = (bundle?.drivers ?? [])
    .filter((driver) => !focus.search || driver.name.toLowerCase().includes(focus.search.toLowerCase()))
    .filter((driver) => !focus.maxAge || driver.age <= focus.maxAge)
    .filter((driver) => !focus.affordableOnly || costOf(driver.id, 'Driver') <= budget)
    .filter((driver) => !focus.contractStatus || focus.contractStatus === 'All' || driver.marketStatus.toLowerCase().includes(focus.contractStatus.toLowerCase()))
    .map((driver) => {
      const targetView = view({ id: driver.id, skills: driver.skills, potential: driver.potential }, 'Driver');
      return {
        id: driver.id,
        name: driver.name,
        subtitle: `${driver.nationality} · ${driver.age} · ${driver.context}`,
        view: targetView,
        cost: costOf(driver.id, 'Driver'),
        knowledge: Math.round(targetView.accuracy * 100),
        assigned: (scouting.activeAssignments ?? []).some((entry) => entry.entityId === driver.id && entry.entityType === 'Driver'),
        shortlisted: shortlist.some((entry) => entry.entityId === driver.id),
        onScout: () => dispatch({ type: 'SCOUT_TARGET', entityId: driver.id, entityType: 'Driver' }),
        onToggleShortlist: () => dispatch({ type: 'TOGGLE_SCOUTING_SHORTLIST', entityId: driver.id, entityType: 'Driver' }),
        onApproach: () => navigate(`/market?target=${encodeURIComponent(driver.id)}`),
        freshness: scouting.reports[driver.id] ? scoutingReportFreshness(scouting.reports[driver.id].lastUpdated, state.seasonYear, currentRound) : undefined,
      };
    });
  const youthRows: ScoutingTargetRow[] = (bundle?.youth ?? [])
    .filter((prospect) => !focus.search || prospect.name.toLowerCase().includes(focus.search.toLowerCase()))
    .filter((prospect) => !focus.maxAge || prospect.age <= focus.maxAge)
    .filter((prospect) => !focus.affordableOnly || costOf(prospect.id, 'YouthProspect') <= budget)
    .map((prospect) => {
      const targetView = view({ id: prospect.id, skills: prospect.skills, potential: prospect.potential }, 'YouthProspect');
      return {
        id: prospect.id,
        name: prospect.name,
        subtitle: `${prospect.nationality} · age ${prospect.age} · ${prospect.currentLevel}`,
        view: targetView,
        cost: costOf(prospect.id, 'YouthProspect'),
        knowledge: Math.round(targetView.accuracy * 100),
        assigned: (scouting.activeAssignments ?? []).some((entry) => entry.entityId === prospect.id && entry.entityType === 'YouthProspect'),
        shortlisted: shortlist.some((entry) => entry.entityId === prospect.id),
        onScout: () => dispatch({ type: 'SCOUT_TARGET', entityId: prospect.id, entityType: 'YouthProspect' }),
        onToggleShortlist: () => dispatch({ type: 'TOGGLE_SCOUTING_SHORTLIST', entityId: prospect.id, entityType: 'YouthProspect' }),
        freshness: scouting.reports[prospect.id] ? scoutingReportFreshness(scouting.reports[prospect.id].lastUpdated, state.seasonYear, currentRound) : undefined,
      };
    });
  function toggleComparison(entityId: string) {
    setComparisonIds((current) => current.includes(entityId)
      ? current.filter((id) => id !== entityId)
      : current.length < 3 ? [...current, entityId] : current);
  }

  return (
    <WorkspaceScreen className="era-feature-screen era-scouting">
      <WorkspaceHeader
        eyebrow="Recruitment center"
        title="Intelligence"
        subtitle="Ratings and potential remain estimates until your scouting network builds sufficient knowledge."
      />

      <MetricStrip>
        <WorkspaceMetric label="Network accuracy" value={`${networkPct}%`} detail="Baseline confidence" />
        <WorkspaceMetric label="Active intelligence" value={activeIntelligence} detail="Paddock claims under review" />
        <WorkspaceMetric label="Scouting budget" value={formatMoney(budget)} detail="Available team balance" />
        <WorkspaceMetric label="Investigation cost" value={formatMoney(INTELLIGENCE_INVESTIGATION_COST)} detail="Per paddock report" />
      </MetricStrip>

      <WorkspaceTabs items={scoutingTabs} active={activeTab} onChange={setTab} ariaLabel="Recruitment intelligence sections" />

      <WorkspaceBody>
      <div className="ui-decision-strip flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="ui-decision-strip-pulse" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-semibold text-neutral-100">Recruitment intelligence desk</div>
            <div className="truncate text-neutral-400">
              {activeIntelligence > 0
                ? `${activeIntelligence} active paddock report${activeIntelligence === 1 ? '' : 's'} require assessment.`
                : 'No active reports. Build knowledge before committing to uncertain targets.'}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          {networkPct}% network accuracy
        </span>
      </div>

      {focusedTargetId && (
        <Panel title="Recruitment decision desk">
          {focusedDecisionDesk ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-neutral-300">
                    <span className="font-semibold">{focusedDecisionDesk.name}</span> · {focusedDecisionDesk.entityType}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">{focusedDecisionDesk.recommendation}</p>
                </div>
                <span className="rounded border border-neutral-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                  {focusedDecisionDesk.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-neutral-400">Estimated knowledge <strong className="text-neutral-200">{focusedDecisionDesk.knowledgePercentage}%</strong></span>
                <Button variant="primary" className="px-2 py-1 text-xs" onClick={() => navigate(focusedDecisionDesk.nextAction.route)}>
                  {focusedDecisionDesk.nextAction.label} →
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-300">{focusedTargetName ? 'This target is not available to the current decision desk.' : 'This target is no longer available in the current scouting market.'}</p>
          )}
        </Panel>
      )}

      {activeTab === 'intelligence' && (
        <IntelligenceDashboard
          state={state}
          budget={budget}
          filter={intelFilter}
          onFilter={setIntelFilter}
          onAction={(reportId, action) => dispatch({ type: 'RESOLVE_INTELLIGENCE_ACTION', reportId, action })}
        />
      )}

      {activeTab !== 'intelligence' && <Panel title="Scouting Network">
        <div className="flex items-center gap-3">
          <div className="text-sm text-neutral-400">Network accuracy</div>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full" style={{ width: `${networkPct}%`, backgroundColor: ratingColor(networkPct) }} />
          </div>
          <span className="text-sm font-semibold tabular-nums" style={{ color: ratingColor(networkPct) }}>{networkPct}%</span>
          <span className="text-xs text-neutral-500">
            Upgrade the Scouting Network facility to raise the baseline.
          </span>
          <span className="ml-auto text-xs text-neutral-400">
            Budget: <span className="font-semibold text-neutral-200">{formatMoney(budget)}</span>
          </span>
        </div>
      </Panel>}

      {activeTab !== 'intelligence' && <Panel title="Recruitment Focus">
        <div className="grid gap-2 md:grid-cols-4">
          <label className="text-xs text-neutral-400">Name<input className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5" value={focus.search ?? ''} onChange={(event) => updateFocus({ search: event.target.value })} placeholder="Search targets" /></label>
          {(activeTab === 'senior' || activeTab === 'youth') && <label className="text-xs text-neutral-400">Maximum age<input className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5" type="number" min={16} max={60} value={focus.maxAge ?? 60} onChange={(event) => updateFocus({ maxAge: Number(event.target.value) })} /></label>}
          {activeTab === 'senior' && <label className="text-xs text-neutral-400">Contract status<select className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5" value={focus.contractStatus ?? 'All'} onChange={(event) => updateFocus({ contractStatus: event.target.value as 'All' | 'Available' | 'Expiring' })}><option>All</option><option>Available</option><option>Expiring</option></select></label>}
          <label className="mt-5 flex items-center gap-2 text-xs text-neutral-300"><input type="checkbox" checked={focus.affordableOnly ?? false} onChange={(event) => updateFocus({ affordableOnly: event.target.checked })} />Affordable scouting only</label>
        </div>
      </Panel>}

      {activeTab !== 'intelligence' && !bundle && (
        <Panel>
          <p className="text-sm text-neutral-400">
            No market data is available for the {state.seasonYear} {state.series} season.
          </p>
        </Panel>
      )}

      {activeTab !== 'intelligence' && (
        <Panel title={`Scouting Assignments (${assignments.length})`}>
          {assignments.length > 0 ? (
            <div className="divide-y divide-neutral-800/70">
              {assignments.map((assignment) => (
                <div key={assignment.entityId} className="grid gap-2 py-2 text-xs sm:grid-cols-[1fr_auto_10rem] sm:items-center">
                  <div><span className="font-semibold text-neutral-200">{assignment.name}</span><span className="ml-2 text-neutral-500">{assignment.entityType === 'YouthProspect' ? 'Youth prospect' : assignment.entityType}</span></div>
                  <div className="text-neutral-400">Coverage {assignment.scoutingLevel}% · Knowledge {assignment.knowledgePercentage}% · {assignment.freshness}</div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800"><div className="h-full bg-[var(--era-accent-strong)]" style={{ width: `${assignment.knowledgePercentage}%` }} /></div>
                  <button type="button" className="text-left text-red-300 hover:text-red-200 sm:col-span-3" onClick={() => dispatch({ type: 'CANCEL_SCOUTING_ASSIGNMENT', entityId: assignment.entityId, entityType: assignment.entityType })}>Cancel assignment</button>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-neutral-500">No outstanding assignments in this target group.</p>}
        </Panel>
      )}

      {activeTab !== 'intelligence' && (
        <Panel title={`Recruitment Shortlist (${shortlistTargets.length})`}>
          {shortlistTargets.length ? (
            <div className="space-y-2">
              {shortlistTargets.map((target) => {
                const selected = comparisonIds.includes(target.entityId);
                const limitReached = comparisonIds.length >= 3 && !selected;
                return (
                  <div key={target.entityId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-800 bg-neutral-950/35 p-2 text-xs">
                    <div><span className="font-semibold text-neutral-200">{target.name}</span><span className="ml-2 text-neutral-500">{Math.round(target.view.accuracy * 100)}% knowledge{scouting.reports[target.entityId] ? ` · ${scoutingReportFreshness(scouting.reports[target.entityId].lastUpdated, state.seasonYear, currentRound)}` : ''}</span></div>
                    <div className="flex gap-2">
                      <Button variant="ghost" className="px-2 py-1 text-xs" disabled={limitReached} title={limitReached ? 'Compare up to three targets at once' : undefined} onClick={() => toggleComparison(target.entityId)}>{selected ? 'Remove comparison' : 'Compare'}</Button>
                      {target.entityType === 'Driver' && <Button variant="primary" className="px-2 py-1 text-xs" onClick={() => navigate(`/market?target=${encodeURIComponent(target.entityId)}`)}>Approach driver →</Button>}
                      <Button variant="ghost" className="px-2 py-1 text-xs text-red-300" onClick={() => dispatch({ type: 'TOGGLE_SCOUTING_SHORTLIST', entityId: target.entityId, entityType: target.entityType })}>Remove</Button>
                    </div>
                  </div>
                );
              })}
              {comparisons.length >= 2 && (
                <div className="grid gap-2 border-t border-neutral-800 pt-3 md:grid-cols-2 xl:grid-cols-3">
                  {comparisons.map((target) => <ComparisonCard key={target.entityId} target={target} />)}
                </div>
              )}
              {comparisons.length === 1 && <p className="text-xs text-neutral-500">Select one or two more shortlisted targets to compare.</p>}
            </div>
          ) : <p className="text-sm text-neutral-500">No targets shortlisted in this group.</p>}
        </Panel>
      )}

      {bundle && activeTab === 'senior' && <ScoutingTargetList items={seniorRows} budget={budget} sort={scoutingSort} onSort={(key) => updateScoutingSort(key, setScoutingSort)} />}
      {bundle && activeTab === 'youth' && <ScoutingTargetList items={youthRows} budget={budget} sort={scoutingSort} onSort={(key) => updateScoutingSort(key, setScoutingSort)} />}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function IntelligenceDashboard({ state, budget, filter, onFilter, onAction }: {
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  budget: number;
  filter: 'Active' | 'History';
  onFilter: (filter: 'Active' | 'History') => void;
  onAction: (reportId: string, action: IntelligenceAction) => void;
}) {
  const allReports = state.phase18?.intelligenceReports ?? [];
  const reports = allReports.filter((report) => filter === 'Active'
    ? (report.status ?? 'Active') === 'Active'
    : (report.status ?? 'Active') !== 'Active').slice().reverse();
  const teamName = (id?: string) => state.teams.find((team) => team.id === id)?.name ?? id ?? 'Unknown team';
  const activeCount = allReports.filter((report) => (report.status ?? 'Active') === 'Active').length;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <IntelKpi label="Active reports" value={String(activeCount)} detail="Claims still being assessed" />
        <IntelKpi label="Resolved history" value={String(allReports.length - activeCount)} detail="Confirmed, disputed, or expired" />
        <IntelKpi label="Investigation cost" value={formatMoney(INTELLIGENCE_INVESTIGATION_COST)} detail="May expose false or misleading claims" />
      </div>
      <Panel>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-neutral-100">Paddock Intelligence</h2>
            <p className="mt-1 max-w-3xl text-xs text-neutral-400">Reports may be true, incomplete, misleading, or false. Confidence measures evidence quality, not certainty.</p>
          </div>
          <WorkspaceTabs
            items={[
              { id: 'Active' as const, label: `Active (${activeCount})` },
              { id: 'History' as const, label: `History (${allReports.length - activeCount})` },
            ]}
            active={filter}
            onChange={onFilter}
            ariaLabel="Intelligence report status"
          />
        </div>
        {reports.length === 0 ? (
          <div className="rounded border border-dashed border-neutral-700 p-5 text-center text-sm text-neutral-500">
            {filter === 'Active' ? 'No active reports yet. New intelligence arrives during paddock weeks.' : 'No resolved intelligence history yet.'}
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {reports.map((report) => <IntelligenceCard key={report.id} report={report} teamName={teamName} budget={budget} onAction={onAction} />)}
          </div>
        )}
      </Panel>
    </div>
  );
}

function IntelligenceCard({ report, teamName, budget, onAction }: {
  report: IntelligenceReport;
  teamName: (id?: string) => string;
  budget: number;
  onAction: (reportId: string, action: IntelligenceAction) => void;
}) {
  const active = (report.status ?? 'Active') === 'Active';
  const tone = report.assessment === 'Confirmed'
    ? 'text-emerald-300'
    : report.assessment === 'Disproven'
      ? 'text-red-300'
      : report.assessment === 'Likely'
        ? 'text-[var(--era-accent-strong)]'
        : 'text-amber-300';
  const latestAction = report.actionHistory?.at(-1);
  return (
    <div className={`rounded-lg border p-4 ${report.assessment === 'Disproven' ? 'border-red-500/30 bg-red-500/5' : 'border-neutral-800 bg-neutral-900/45'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{report.category ?? report.subjectType} · {report.source} · {report.visibility ?? 'Private'}</div>
          <h3 className="mt-1 font-semibold text-neutral-100">{report.title}</h3>
          <div className="mt-0.5 text-xs text-neutral-500">Target: {teamName(report.targetTeamId)}</div>
        </div>
        <div className="text-right text-[10px]"><div className={`font-semibold uppercase ${tone}`}>{report.assessment}</div><div className="mt-1 text-neutral-500">{intelligenceConfidenceLabel(report.confidence)} · {report.confidence}%</div></div>
      </div>
      <p className="mt-3 text-sm text-neutral-300">{report.summary}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
        <IntelDatum label="Source reliability" value={`${report.reliability}%`} />
        <IntelDatum label="Relevance" value={report.gameplayRelevance ?? 'Medium'} />
        <IntelDatum label="Expires" value={report.expiresRound ? `Round ${report.expiresRound}` : `${report.expiresSeasonYear ?? '-'}`} />
      </div>
      {report.revealedOutcome && <div className={`mt-3 rounded border px-2.5 py-2 text-xs ${report.assessment === 'Disproven' ? 'border-red-500/30 text-red-200' : 'border-emerald-500/25 text-emerald-200'}`}>{report.revealedOutcome}</div>}
      {(report.aiResponses ?? []).length > 0 && <div className="mt-3 rounded bg-neutral-950/60 px-2.5 py-2 text-[11px] text-neutral-400"><span className="font-semibold text-[var(--era-accent-strong)]">Observed rival activity: </span>{report.aiResponses!.map((response) => `${teamName(response.teamId)} ${response.action.toLowerCase()}`).join('; ')}.</div>}
      {latestAction && <div className="mt-2 text-[11px] text-neutral-500">Latest action: {latestAction.action} - {latestAction.outcome}</div>}
      {active && <div className="mt-3 flex flex-wrap gap-1.5 border-t border-neutral-800 pt-3">
        {(['Investigate', 'AskAdvisor', 'Monitor', 'Ignore'] as IntelligenceAction[]).map((action) => <Button key={action} variant={action === 'Investigate' ? 'primary' : 'ghost'} className="px-2 py-1 text-[11px]" disabled={action === 'Investigate' && budget < INTELLIGENCE_INVESTIGATION_COST} onClick={() => onAction(report.id, action)} title={action === 'Investigate' ? `Spend ${formatMoney(INTELLIGENCE_INVESTIGATION_COST)} to improve this report` : undefined}>{action === 'AskAdvisor' ? 'Ask advisors' : action}</Button>)}
      </div>}
    </div>
  );
}

function IntelKpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3"><div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-1 text-xl font-bold text-neutral-100">{value}</div><div className="mt-1 text-[11px] text-neutral-500">{detail}</div></div>;
}

function IntelDatum({ label, value }: { label: string; value: string }) {
  return <div className="rounded bg-neutral-800/50 px-2 py-1.5"><div className="text-neutral-500">{label}</div><div className="mt-0.5 font-semibold text-neutral-200">{value}</div></div>;
}

function potentialText(view: FogView): string {
  const [lo, hi] = view.potential.range;
  return `${lo.toFixed(1)}–${hi.toFixed(1)}`;
}

function updateScoutingSort(
  key: ScoutingListSortKey,
  setSort: React.Dispatch<React.SetStateAction<ScoutingListSort>>,
) {
  setSort((current) => current.key === key
    ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    : { key, direction: key === 'name' ? 'asc' : 'desc' });
}

function ScoutingTargetList({
  items,
  budget,
  sort,
  onSort,
}: {
  items: ScoutingTargetRow[];
  budget: number;
  sort: ScoutingListSort;
  onSort: (key: ScoutingListSortKey) => void;
}) {
  const ordered = sortScoutingListItems(items, sort) as ScoutingTargetRow[];
  return (
    <Panel title={`Scouting Targets (${items.length})`} className="overflow-hidden">
      <div className="overflow-x-auto rounded border border-neutral-800">
        <table className="w-full min-w-[1080px] border-collapse text-xs">
          <thead className="bg-neutral-900/70 text-left text-[10px] uppercase tracking-wide text-neutral-500">
            <tr>
              <ScoutingSortHeader label="Target" sortKey="name" sort={sort} onSort={onSort} />
              <ScoutingSortHeader label="OVR" sortKey="overall" sort={sort} onSort={onSort} />
              <ScoutingSortHeader label="POT" sortKey="potential" sort={sort} onSort={onSort} />
              <ScoutingSortHeader label="Knowledge" sortKey="knowledge" sort={sort} onSort={onSort} />
              <ScoutingSortHeader label="Cost" sortKey="cost" sort={sort} onSort={onSort} />
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((item) => {
              const affordable = item.cost <= budget;
              return (
                <tr key={item.id} className={`border-t border-neutral-800/70 align-middle hover:bg-neutral-900/60 ${item.shortlisted ? 'bg-sky-500/5' : ''}`}>
                  <td className="px-2 py-2">
                    <div className="font-semibold text-neutral-100">{item.name}</div>
                    <div className="text-[10px] text-neutral-500">{item.subtitle}</div>
                  </td>
                  <td className="px-2 py-2 tabular-nums text-amber-300">{overallText(item.view)}</td>
                  <td className="px-2 py-2 tabular-nums text-sky-300">{potentialText(item.view)}</td>
                  <td className="px-2 py-2 tabular-nums text-neutral-300">{item.knowledge}%</td>
                  <td className={`px-2 py-2 tabular-nums ${affordable ? 'text-neutral-300' : 'text-red-300'}`}>{formatMoney(item.cost)}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      {item.shortlisted && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] text-sky-300">Shortlist</span>}
                      {item.assigned && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-300">Assigned</span>}
                      {item.view.maxed && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-300">Report ready</span>}
                      {item.freshness && <span className={`rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] ${item.freshness === 'Stale' ? 'text-amber-300' : 'text-neutral-400'}`}>{item.freshness}</span>}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex min-w-[260px] flex-wrap gap-1">
                      {item.view.maxed ? (
                        <span className="px-2 py-1 text-[10px] text-emerald-300">Best report</span>
                      ) : item.assigned ? (
                        <span className="px-2 py-1 text-[10px] text-amber-300">Assignment active</span>
                      ) : (
                        <Button variant="primary" className="px-2 py-1 text-[10px]" disabled={!affordable} onClick={item.onScout}>
                          {affordable ? `Scout ${formatMoney(item.cost)}` : 'Over budget'}
                        </Button>
                      )}
                      <Button variant="ghost" className="px-2 py-1 text-[10px]" onClick={item.onToggleShortlist}>
                        {item.shortlisted ? 'Remove shortlist' : 'Shortlist'}
                      </Button>
                      {item.onApproach && <Button variant="ghost" className="px-2 py-1 text-[10px]" onClick={item.onApproach}>Approach →</Button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {ordered.length === 0 && <div className="px-3 py-8 text-center text-sm text-neutral-500">No targets match the current recruitment focus.</div>}
      </div>
    </Panel>
  );
}

function ScoutingSortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: ScoutingListSortKey;
  sort: ScoutingListSort;
  onSort: (key: ScoutingListSortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className="px-2 py-2">
      <button type="button" className="inline-flex items-center gap-1 hover:text-neutral-200" onClick={() => onSort(sortKey)}>
        {label}<span className="text-[9px]">{active ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

function ComparisonCard({ target }: { target: ReturnType<typeof scoutingComparison>[number] }) {
  const current = target.currentStars
    ? `${target.currentStars[0].toFixed(1)}–${target.currentStars[1].toFixed(1)}★`
    : 'Unknown';
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/40 p-3">
      <div className="font-semibold text-neutral-100">{target.name}</div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div><div className="text-neutral-500">Current ability</div><div className="font-semibold text-amber-300">{current}</div></div>
        <div><div className="text-neutral-500">Potential</div><div className="font-semibold text-amber-300">{target.potentialStars[0].toFixed(1)}–{target.potentialStars[1].toFixed(1)}★</div></div>
      </div>
      <div className="mt-2 text-[11px] text-neutral-500">Knowledge confidence: {target.knowledgePercentage}%</div>
    </div>
  );
}

function overallText(view: FogView): string {
  const values = Object.values(view.skills).filter((v): v is number | [number, number] => v !== 'Unknown');
  if (values.length === 0) return 'OVR ??';
  const mids = values.map((v) => (Array.isArray(v) ? (v[0] + v[1]) / 2 : v));
  const avg = mids.reduce((sum, v) => sum + v, 0) / mids.length;
  const uncertainty = Math.max(4, (1 - view.accuracy) * 22);
  return `${Math.max(1, avg - uncertainty).toFixed(1)}-${Math.min(100, avg + uncertainty).toFixed(1)}`;
}
