import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { getStaffPool } from '../data';
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
import { fogView, scoutingCost, staffScoutTarget, type FogView, type ScoutTarget } from '../sim/scoutingEngine';
import { formatMoney, ratingColor } from '../components/ui';
import type { ScoutedEntityType, VisibleRating } from '../types/scoutingTypes';
import type { IntelligenceAction, IntelligenceReport } from '../types/phase18Types';
import { INTELLIGENCE_INVESTIGATION_COST, intelligenceConfidenceLabel } from '../sim/phase18IntelligenceEngine';
import { scoutingAbilitySummary, scoutingAssignments, scoutingComparison, scoutingReportFreshness } from './scoutingViewModel';

type Tab = 'intelligence' | 'senior' | 'youth' | 'staff';

const SKILL_LABELS: { key: string; label: string }[] = [
  { key: 'cornering', label: 'Cornering' },
  { key: 'braking', label: 'Braking' },
  { key: 'overtakingRacecraft', label: 'Overtaking' },
  { key: 'enduranceConsistency', label: 'Consistency' },
];

export function Scouting() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('intelligence');
  const [intelFilter, setIntelFilter] = useState<'Active' | 'History'>('Active');
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
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
    { id: 'staff', label: `Staff Targets (${getStaffPool(state.seasonYear, state.series).length})` },
  ];
  const staffTargets = getStaffPool(state.seasonYear, state.series);
  const focus = scouting.recruitmentFocus ?? {};
  const currentRound = state.calendar[state.currentRaceIndex]?.round ?? state.currentRaceIndex + 1;
  const updateFocus = (patch: Partial<typeof focus>) => dispatch({ type: 'SET_RECRUITMENT_FOCUS', focus: { ...focus, ...patch } });
  const targetNames = Object.fromEntries([
    ...(bundle?.drivers ?? []).map((driver) => [driver.id, driver.name] as const),
    ...(bundle?.youth ?? []).map((prospect) => [prospect.id, prospect.name] as const),
    ...staffTargets.map((staff) => [staff.id, staff.name] as const),
  ]);
  const activeTab = requestedTab === 'senior' || requestedTab === 'youth' || requestedTab === 'intelligence' || requestedTab === 'staff'
    ? requestedTab
    : tab;
  const focusedTargetName = focusedTargetId ? targetNames[focusedTargetId] : undefined;
  const assignments = scoutingAssignments(
    scouting.reports,
    scouting.networkAccuracy,
    targetNames,
    activeTab === 'senior' ? 'Driver' : activeTab === 'youth' ? 'YouthProspect' : activeTab === 'staff' ? 'Staff' : undefined,
    scouting.activeAssignments,
    state.seasonYear,
    currentRound,
  );
  const shortlist = (scouting.shortlist ?? []).filter((entry) =>
    activeTab === 'senior' ? entry.entityType === 'Driver' : activeTab === 'youth' ? entry.entityType === 'YouthProspect' : activeTab === 'staff' ? entry.entityType === 'Staff' : false,
  );
  const shortlistTargets = shortlist.flatMap((entry) => {
    const target = entry.entityType === 'Driver'
      ? bundle?.drivers.find((driver) => driver.id === entry.entityId)
      : entry.entityType === 'YouthProspect'
        ? bundle?.youth.find((prospect) => prospect.id === entry.entityId)
        : staffTargets.find((staff) => staff.id === entry.entityId);
    if (!target) return [];
    const scoutTarget = entry.entityType === 'Staff'
      ? staffScoutTarget(target as (typeof staffTargets)[number])
      : { id: target.id, skills: (target as (NonNullable<typeof bundle>['drivers'][number])).skills, potential: (target as (NonNullable<typeof bundle>['drivers'][number])).potential };
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
        <Panel title="Scouting handoff">
          {focusedTargetName ? (
            <p className="text-sm text-neutral-300">
              <span className="font-semibold">{focusedTargetName}</span> is the focused recruitment target.
              Review the current report, knowledge level, and next scouting action below.
            </p>
          ) : (
            <p className="text-sm text-amber-300">This target is no longer available in the current scouting market.</p>
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
          {activeTab === 'staff' && <label className="text-xs text-neutral-400">Staff role<select className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5" value={focus.staffRole ?? 'All'} onChange={(event) => updateFocus({ staffRole: event.target.value })}><option>All</option>{[...new Set(staffTargets.map((staff) => staff.role))].map((role) => <option key={role}>{role}</option>)}</select></label>}
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
                      {target.entityType === 'Staff' && <Button variant="primary" className="px-2 py-1 text-xs" onClick={() => navigate(`/staff/${encodeURIComponent(target.entityId)}/negotiate`)}>Approach staff →</Button>}
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

      {bundle && activeTab === 'senior' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...bundle.drivers]
            .filter((driver) => !focus.search || driver.name.toLowerCase().includes(focus.search.toLowerCase()))
            .filter((driver) => !focus.maxAge || driver.age <= focus.maxAge)
            .filter((driver) => !focus.affordableOnly || costOf(driver.id, 'Driver') <= budget)
            .filter((driver) => !focus.contractStatus || focus.contractStatus === 'All' || driver.marketStatus.toLowerCase().includes(focus.contractStatus.toLowerCase()))
            .sort(
              (a, b) =>
                viewMidpoint(view({ id: b.id, skills: b.skills, potential: b.potential }, 'Driver')) -
                viewMidpoint(view({ id: a.id, skills: a.skills, potential: a.potential }, 'Driver')),
            )
            .map((d) => (
              <ScoutCard
                key={d.id}
                title={d.name}
                subtitle={`${d.nationality} · ${d.age} · ${d.context}`}
                view={view({ id: d.id, skills: d.skills, potential: d.potential }, 'Driver')}
                cost={costOf(d.id, 'Driver')}
                budget={budget}
                assigned={(scouting.activeAssignments ?? []).some((entry) => entry.entityId === d.id && entry.entityType === 'Driver')}
                shortlisted={shortlist.some((entry) => entry.entityId === d.id)}
                onScout={() => dispatch({ type: 'SCOUT_TARGET', entityId: d.id, entityType: 'Driver' as ScoutedEntityType })}
                onToggleShortlist={() => dispatch({ type: 'TOGGLE_SCOUTING_SHORTLIST', entityId: d.id, entityType: 'Driver' })}
                onApproach={() => navigate(`/market?target=${encodeURIComponent(d.id)}`)}
                freshness={scouting.reports[d.id] ? scoutingReportFreshness(scouting.reports[d.id].lastUpdated, state.seasonYear, currentRound) : undefined}
              />
            ))}
        </div>
      )}

      {bundle && activeTab === 'youth' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...bundle.youth]
            .filter((prospect) => !focus.search || prospect.name.toLowerCase().includes(focus.search.toLowerCase()))
            .filter((prospect) => !focus.maxAge || prospect.age <= focus.maxAge)
            .filter((prospect) => !focus.affordableOnly || costOf(prospect.id, 'YouthProspect') <= budget)
            .sort(
              (a, b) =>
                viewMidpoint(view({ id: b.id, skills: b.skills, potential: b.potential }, 'YouthProspect')) -
                viewMidpoint(view({ id: a.id, skills: a.skills, potential: a.potential }, 'YouthProspect')),
            )
            .map((y) => (
              <ScoutCard
                key={y.id}
                title={y.name}
                subtitle={`${y.nationality} · age ${y.age} · ${y.currentLevel}`}
                view={view({ id: y.id, skills: y.skills, potential: y.potential }, 'YouthProspect')}
                cost={costOf(y.id, 'YouthProspect')}
                budget={budget}
                assigned={(scouting.activeAssignments ?? []).some((entry) => entry.entityId === y.id && entry.entityType === 'YouthProspect')}
                shortlisted={shortlist.some((entry) => entry.entityId === y.id)}
                onScout={() => dispatch({ type: 'SCOUT_TARGET', entityId: y.id, entityType: 'YouthProspect' as ScoutedEntityType })}
                onToggleShortlist={() => dispatch({ type: 'TOGGLE_SCOUTING_SHORTLIST', entityId: y.id, entityType: 'YouthProspect' })}
                onApproach={() => navigate('/market')}
                freshness={scouting.reports[y.id] ? scoutingReportFreshness(scouting.reports[y.id].lastUpdated, state.seasonYear, currentRound) : undefined}
              />
            ))}
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {staffTargets
            .filter((staff) => !focus.search || staff.name.toLowerCase().includes(focus.search.toLowerCase()))
            .filter((staff) => !focus.staffRole || focus.staffRole === 'All' || staff.role === focus.staffRole)
            .filter((staff) => !focus.affordableOnly || costOf(staff.id, 'Staff') <= budget)
            .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))
            .map((staff) => {
              const target = staffScoutTarget(staff);
              return <ScoutCard key={staff.id} title={staff.name} subtitle={`${staff.nationality} · ${staff.role} · ${staff.contractYearsRemaining ?? 2} contract yrs`} view={view(target, 'Staff')} cost={costOf(staff.id, 'Staff')} budget={budget} assigned={(scouting.activeAssignments ?? []).some((entry) => entry.entityId === staff.id && entry.entityType === 'Staff')} shortlisted={shortlist.some((entry) => entry.entityId === staff.id)} onScout={() => dispatch({ type: 'SCOUT_TARGET', entityId: staff.id, entityType: 'Staff' })} onToggleShortlist={() => dispatch({ type: 'TOGGLE_SCOUTING_SHORTLIST', entityId: staff.id, entityType: 'Staff' })} onApproach={() => navigate(`/staff/${encodeURIComponent(staff.id)}/negotiate`)} skillLabels={[{ key: 'technical', label: 'Expertise' }]} freshness={scouting.reports[staff.id] ? scoutingReportFreshness(scouting.reports[staff.id].lastUpdated, state.seasonYear, currentRound) : undefined} />;
            })}
        </div>
      )}
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

function ScoutCard({
  title,
  subtitle,
  view,
  cost,
  budget,
  assigned,
  shortlisted,
  onScout,
  onToggleShortlist,
  onApproach,
  skillLabels = SKILL_LABELS,
  freshness,
}: {
  title: string;
  subtitle: string;
  view: FogView;
  cost: number;
  budget: number;
  assigned: boolean;
  shortlisted: boolean;
  onScout: () => void;
  onToggleShortlist: () => void;
  onApproach?: () => void;
  skillLabels?: { key: string; label: string }[];
  freshness?: 'Fresh' | 'Current' | 'Stale';
}) {
  const ability = scoutingAbilitySummary(view);
  const accPct = ability.knowledgePercentage;
  const affordable = cost <= budget;
  return (
    <Panel>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-neutral-100">{title}</div>
          <div className="text-xs text-neutral-500">{subtitle}</div>
        </div>
        <div className="text-right">
          <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-[var(--era-accent-strong)]">
            {overallText(view)}
          </span>
          <div className="mt-0.5 text-[10px] text-neutral-500">
            POT <span className="text-[var(--era-accent-strong)]">{potentialText(view)}</span>
          </div>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2 rounded border border-neutral-800 bg-neutral-950/35 p-2 text-xs">
        <AbilityReadout label="Current ability" stars={ability.currentStars} range={ability.currentRange} />
        <AbilityReadout label="Potential ability" stars={ability.potentialStars} range={ability.potentialRange} />
      </div>

      <div className="mb-2">
        <div className="mb-0.5 flex items-center justify-between text-[11px]">
          <span className="text-neutral-500">Scouting accuracy</span>
          <span className="tabular-nums text-neutral-400">{accPct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full"
            style={{ width: `${accPct}%`, backgroundColor: ratingColor(accPct) }}
          />
        </div>
      </div>
      {freshness && <div className={`mb-2 text-[10px] font-semibold uppercase tracking-wide ${freshness === 'Stale' ? 'text-amber-300' : 'text-neutral-500'}`}>Report freshness: {freshness}{freshness === 'Stale' ? ' · knowledge may be outdated' : ''}</div>}

      <div className="grid grid-cols-1 gap-1">
        {skillLabels.map((s) => (
          <SkillRow key={s.key} label={s.label} value={view.skills[s.key]} />
        ))}
      </div>

      <p className="mt-2 text-[11px] italic text-neutral-500">
        {view.maxed ? 'Best available report - ratings remain projected ranges.' : view.notes[0]}
      </p>

      <div className="mt-3 border-t border-neutral-800 pt-2">
        {view.maxed ? (
          <span className="text-xs text-green-400">Best available report. Track performance still matters.</span>
        ) : assigned ? (
          <Button variant="primary" className="w-full px-2 py-1 text-xs" disabled title="This assignment advances automatically after each race">Assignment active · advances each round</Button>
        ) : (
          <>
            <Button
              variant="primary"
              className="w-full px-2 py-1 text-xs"
              disabled={!affordable}
              onClick={onScout}
            >
              Scout this target — {formatMoney(cost)}
            </Button>
            {!affordable && (
              <p className="mt-1 text-center text-[11px] text-red-400">Insufficient budget</p>
            )}
          </>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onToggleShortlist}>{shortlisted ? 'Remove shortlist' : 'Add to shortlist'}</Button>
          {onApproach ? <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onApproach}>Approach →</Button> : <Button variant="ghost" className="px-2 py-1 text-xs" disabled title="Youth prospects are signed through the Driver Market academy section">Academy route</Button>}
        </div>
      </div>
    </Panel>
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

function AbilityReadout({ label, stars, range }: { label: string; stars?: [number, number]; range?: [number, number] }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-0.5 font-semibold text-amber-300">{stars ? `${stars[0].toFixed(1)}–${stars[1].toFixed(1)}★` : 'Unknown'}</div>
      <div className="text-[10px] text-neutral-500">{range ? `${range[0].toFixed(1)}–${range[1].toFixed(1)}` : 'Insufficient knowledge'}</div>
    </div>
  );
}

function SkillRow({ label, value }: { label: string; value: VisibleRating }) {
  const known = value !== 'Unknown';
  const [lo, hi] = Array.isArray(value) ? value : typeof value === 'number' ? [value, value] : [0, 0];
  const mid = known ? (lo + hi) / 2 : 0;
  const pct = known ? mid : 0;
  const color = known ? ratingColor(mid) : '#52525b';
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-neutral-400">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
        {known && <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />}
      </div>
      <span className={`w-20 text-right tabular-nums ${known ? 'text-neutral-200' : 'text-neutral-600'}`}>
        {known ? `${lo.toFixed(1)}-${hi.toFixed(1)}` : '??'}
      </span>
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

function viewMidpoint(view: FogView): number {
  const values = Object.values(view.skills).filter((v): v is number | [number, number] => v !== 'Unknown');
  if (values.length > 0) {
    const mids = values.map((v) => (Array.isArray(v) ? (v[0] + v[1]) / 2 : v));
    return mids.reduce((sum, v) => sum + v, 0) / mids.length;
  }
  const [lo, hi] = view.potential.range;
  return (lo + hi) / 2;
}
