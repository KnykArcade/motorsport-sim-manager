import { useMemo, useState } from 'react';
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
import type { ScoutedEntityType, VisibleRating } from '../types/scoutingTypes';
import type { IntelligenceAction, IntelligenceReport } from '../types/phase18Types';
import { INTELLIGENCE_INVESTIGATION_COST, intelligenceConfidenceLabel } from '../sim/phase18IntelligenceEngine';

type Tab = 'intelligence' | 'senior' | 'youth';

const SKILL_LABELS: { key: string; label: string }[] = [
  { key: 'cornering', label: 'Cornering' },
  { key: 'braking', label: 'Braking' },
  { key: 'overtakingRacecraft', label: 'Overtaking' },
  { key: 'enduranceConsistency', label: 'Consistency' },
];

export function Scouting() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<Tab>('intelligence');
  const [intelFilter, setIntelFilter] = useState<'Active' | 'History'>('Active');

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

      <WorkspaceTabs items={scoutingTabs} active={tab} onChange={setTab} ariaLabel="Recruitment intelligence sections" />

      <WorkspaceBody>

      {tab === 'intelligence' && (
        <IntelligenceDashboard
          state={state}
          budget={budget}
          filter={intelFilter}
          onFilter={setIntelFilter}
          onAction={(reportId, action) => dispatch({ type: 'RESOLVE_INTELLIGENCE_ACTION', reportId, action })}
        />
      )}

      {tab !== 'intelligence' && <Panel title="Scouting Network">
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

      {tab !== 'intelligence' && !bundle && (
        <Panel>
          <p className="text-sm text-neutral-400">
            No market data is available for the {state.seasonYear} {state.series} season.
          </p>
        </Panel>
      )}

      {bundle && tab === 'senior' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...bundle.drivers]
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
                onScout={() => dispatch({ type: 'SCOUT_TARGET', entityId: d.id, entityType: 'Driver' as ScoutedEntityType })}
              />
            ))}
        </div>
      )}

      {bundle && tab === 'youth' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...bundle.youth]
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
                onScout={() => dispatch({ type: 'SCOUT_TARGET', entityId: y.id, entityType: 'YouthProspect' as ScoutedEntityType })}
              />
            ))}
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
          <div className="flex gap-1">
            {(['Active', 'History'] as const).map((value) => <TabButton key={value} active={filter === value} onClick={() => onFilter(value)}>{value}</TabButton>)}
          </div>
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
  const tone = report.assessment === 'Confirmed' ? 'text-emerald-300' : report.assessment === 'Disproven' ? 'text-red-300' : report.assessment === 'Likely' ? 'text-sky-300' : 'text-amber-300';
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
      {(report.aiResponses ?? []).length > 0 && <div className="mt-3 rounded bg-neutral-950/60 px-2.5 py-2 text-[11px] text-neutral-400"><span className="font-semibold text-violet-300">Observed rival activity: </span>{report.aiResponses!.map((response) => `${teamName(response.teamId)} ${response.action.toLowerCase()}`).join('; ')}.</div>}
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
  onScout,
}: {
  title: string;
  subtitle: string;
  view: FogView;
  cost: number;
  budget: number;
  onScout: () => void;
}) {
  const accPct = Math.round(view.accuracy * 100);
  const affordable = cost <= budget;
  return (
    <Panel>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-neutral-100">{title}</div>
          <div className="text-xs text-neutral-500">{subtitle}</div>
        </div>
        <div className="text-right">
          <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-amber-300">
            {overallText(view)}
          </span>
          <div className="mt-0.5 text-[10px] text-neutral-500">
            POT <span className="text-sky-300">{potentialText(view)}</span>
          </div>
        </div>
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

      <div className="grid grid-cols-1 gap-1">
        {SKILL_LABELS.map((s) => (
          <SkillRow key={s.key} label={s.label} value={view.skills[s.key]} />
        ))}
      </div>

      <p className="mt-2 text-[11px] italic text-neutral-500">
        {view.maxed ? 'Best available report - ratings remain projected ranges.' : view.notes[0]}
      </p>

      <div className="mt-3 border-t border-neutral-800 pt-2">
        {view.maxed ? (
          <span className="text-xs text-green-400">Best available report. Track performance still matters.</span>
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
      </div>
    </Panel>
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm ${
        active
          ? 'bg-amber-500 font-semibold text-neutral-950'
          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
      }`}
    >
      {children}
    </button>
  );
}
