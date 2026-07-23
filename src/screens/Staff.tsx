import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { getStaffPool } from '../data';
import { toMoney } from '../sim/financeEngine';
import {
  developmentSuccessBonus,
  pitCrewBonus,
  staffRatingOutOfTen,
  staffReleaseCost,
  setupConfidenceBonus,
  staffByRole,
  strategyBonus,
  totalStaffSalary,
} from '../sim/staffEngine';
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
import { StatBar } from '../components/StatBar';
import { formatMoney } from '../components/ui';
import { ROLE_EFFECT, STAFF_ROLES, type StaffMember, type StaffRole } from '../types/staffTypes';
import { ADVISOR_ROLE_LABELS } from '../sim/phase18AdvisorEngine';
import { contractClauseLabel } from '../sim/phase18ContractClauseEngine';
import { CharacterDossierButton } from '../components/characterCards/CharacterDossier';
import type { GameState } from '../game/careerState';
import { characterFutureIntentLabel } from '../sim/characterFutureIntentEngine';
import { staffEmployer, staffPoachingCompensation } from '../sim/aiStaffRosterEngine';
import {
  STAFF_PAGE_SIZE,
  STAFF_WORKSPACE_TABS,
  staffPage,
  staffPageCount,
  staffRoleFromQuery,
  staffVacancyCount,
  staffTabFromQuery,
  type StaffWorkspaceTab,
} from './staffViewModel';
import {
  DEFAULT_STAFF_RECRUITMENT_FILTERS,
  filterStaffRecruitmentCandidates,
  sortStaffRecruitmentCandidates,
  type StaffRecruitmentFilters,
  type StaffRecruitmentSort,
  type StaffRecruitmentSortKey,
} from './staffRecruitmentListViewModel';

type StaffMarketView = 'available' | 'rivals';

export function Staff() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = staffTabFromQuery(searchParams.get('tab'));
  const selectedStaffId = searchParams.get('staffId');
  const activeRole = staffRoleFromQuery(searchParams.get('role'));
  const [marketView, setMarketView] = useState<StaffMarketView>('available');
  const [recruitmentFilters, setRecruitmentFilters] = useState<StaffRecruitmentFilters>(DEFAULT_STAFF_RECRUITMENT_FILTERS);
  const [recruitmentSort, setRecruitmentSort] = useState<StaffRecruitmentSort>({ key: 'rating', direction: 'desc' });
  const [councilPage, setCouncilPage] = useState(0);
  const [contractPage, setContractPage] = useState(0);
  if (!state) return null;

  const budget = teamById(state, state.selectedTeamId)?.budget ?? 0;
  const roster = state.staff ?? [];
  const hiredById = new Set(roster.map((s) => s.id));
  const byRole = staffByRole(roster);
  const pool = getStaffPool(state.seasonYear, state.series);
  const employerByStaffId = new Map(
    Object.entries(state.aiStaff ?? {}).flatMap(([teamId, staff]) => staff.map((member) => [member.id, teamId] as const)),
  );
  const contractOfferNews = state.news.filter((item) => item.id.startsWith('news-staff-contract-offer-'));

  const devBonus = developmentSuccessBonus(roster);
  const setupBonus = setupConfidenceBonus(roster);
  const pitBonus = pitCrewBonus(roster);
  const strategyExecutionBonus = strategyBonus(roster);
  const payroll = totalStaffSalary(roster);
  const vacancies = staffVacancyCount(roster);
  const councilActivity = (state.phase18?.advisorRecommendations ?? [])
    .filter((recommendation) => recommendation.teamId === state.selectedTeamId)
    .slice(-6)
    .reverse();
  const staffClauses = (state.phase18?.contractClauses ?? []).filter((clause) =>
    clause.teamId === state.selectedTeamId && clause.partyType === 'Staff' && clause.status === 'Active',
  );

  const current = byRole[activeRole];
  const roleCandidates = pool
    .filter((s) => !hiredById.has(s.id) && s.role === activeRole && (marketView === 'rivals' ? employerByStaffId.has(s.id) : !employerByStaffId.has(s.id)));
  const candidates = [...roleCandidates].sort((a, b) => b.rating - a.rating);
  const recruitmentCandidates = candidates.map((staff) => {
    const employerTeamId = employerByStaffId.get(staff.id) ?? staffEmployer(state.aiStaff, staff.id);
    const employer = state.teams.find((team) => team.id === employerTeamId);
    const poachingCost = employerTeamId ? staffPoachingCompensation(staff) : 0;
    const totalCost = toMoney(staff.signingFee) + poachingCost + (current ? staffReleaseCost(current) : 0);
    return {
      ...staff,
      employerName: employer?.name,
      poachingCost,
      totalCost,
      affordable: totalCost <= budget,
    };
  });
  const filteredRecruitmentCandidates = filterStaffRecruitmentCandidates(recruitmentCandidates, recruitmentFilters, budget);
  const orderedRecruitmentCandidates = sortStaffRecruitmentCandidates(filteredRecruitmentCandidates, recruitmentSort);
  const councilPageCount = staffPageCount(councilActivity.length);
  const safeCouncilPage = Math.min(councilPage, councilPageCount - 1);
  const visibleCouncilActivity = staffPage(councilActivity, safeCouncilPage);
  const contractPageCount = staffPageCount(roster.length);
  const safeContractPage = Math.min(contractPage, contractPageCount - 1);
  const visibleContractStaff = staffPage(roster, safeContractPage);
  const selectedContractStaff = roster.find((member) => member.id === selectedStaffId);
  const contractStaff = selectedContractStaff && !visibleContractStaff.some((member) => member.id === selectedContractStaff.id)
    ? [selectedContractStaff, ...visibleContractStaff]
    : visibleContractStaff;
  const staffTabs = STAFF_WORKSPACE_TABS.map((item) => {
    const count = item.id === 'roster'
      ? roster.length
      : item.id === 'contracts'
        ? roster.length
        : item.id === 'council'
          ? councilActivity.length
          : undefined;
    return { ...item, label: count === undefined ? item.label : `${item.label} (${count})` };
  });
  const setTab = (nextTab: StaffWorkspaceTab) => {
    const next = new URLSearchParams(searchParams);
    if (nextTab === 'roster') next.delete('tab');
    else next.set('tab', nextTab);
    setSearchParams(next);
  };
  const setActiveRole = (nextRole: StaffRole) => {
    const next = new URLSearchParams(searchParams);
    next.set('role', nextRole);
    setSearchParams(next);
  };
  const updateRecruitmentFilter = <K extends keyof StaffRecruitmentFilters>(key: K, value: StaffRecruitmentFilters[K]) => {
    setRecruitmentFilters((currentFilters) => ({ ...currentFilters, [key]: value }));
  };
  const updateRecruitmentSort = (key: StaffRecruitmentSortKey) => {
    setRecruitmentSort((currentSort) => currentSort.key === key
      ? { key, direction: currentSort.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: key === 'name' ? 'asc' : 'desc' });
  };

  return (
    <WorkspaceScreen className="era-feature-screen era-staff">
      <WorkspaceHeader
        eyebrow="Operations center"
        title="Staff"
        subtitle="Specialists, contracts, advice, and recruitment."
        actions={
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Available budget</div>
          <div className="text-base font-bold text-neutral-100">{formatMoney(budget)}</div>
        </div>
        }
      />

      <MetricStrip>
        <WorkspaceMetric label="Positions" value={`${roster.length} / ${STAFF_ROLES.length}`} detail={vacancies === 0 ? 'Fully staffed' : `${vacancies} vacant`} />
        <WorkspaceMetric label="Annual payroll" value={formatMoney(payroll)} detail="Paid at season rollover" />
        <WorkspaceMetric label="Development / setup" value={`${devBonus >= 0 ? '+' : ''}${Math.round(devBonus * 100)}% · ${setupBonus >= 0 ? '+' : ''}${setupBonus.toFixed(1)}`} detail="Project success · confidence" />
        <WorkspaceMetric label="Race execution" value={`Pit ${pitBonus >= 0 ? '+' : ''}${Math.round(pitBonus * 100)}%`} detail={`Strategy ${strategyExecutionBonus >= 0 ? '+' : ''}${Math.round(strategyExecutionBonus * 100)}%`} />
      </MetricStrip>

      <WorkspaceTabs items={staffTabs} active={tab} onChange={setTab} ariaLabel="Staff workspaces" />

      <WorkspaceBody>
      <div className="ui-decision-strip flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="ui-decision-strip-pulse" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-semibold text-neutral-100">People operations desk</div>
            <div className="truncate text-neutral-400">
              {vacancies > 0
                ? `${vacancies} staff position${vacancies === 1 ? '' : 's'} remain vacant. Review the market before the next race phase.`
                : councilActivity.length > 0
                  ? `${councilActivity.length} advisor recommendation${councilActivity.length === 1 ? '' : 's'} are available for review.`
                  : 'Staffing is complete and no advisor action is currently queued.'}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          {formatMoney(budget)} available
        </span>
      </div>
      {tab === 'council' && (
        <Panel title="Advisor Council Activity">
          {councilActivity.length === 0 ? (
            <p className="text-sm text-neutral-500">
              The council will issue recommendations when management decisions reach the paddock agenda.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleCouncilActivity.map((recommendation) => (
                <div key={recommendation.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-neutral-100">
                        {recommendation.advisorName ?? ADVISOR_ROLE_LABELS[recommendation.advisorRole]}
                      </div>
                      <div className="text-[10px] text-neutral-500">{ADVISOR_ROLE_LABELS[recommendation.advisorRole]}</div>
                    </div>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${advisorStatusTone(recommendation.status)}`}>
                      {recommendation.status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-semibold text-[var(--era-accent-strong)]">{recommendation.recommendation}</div>
                  <p className="mt-1 text-[11px] text-neutral-400">{recommendation.rationale}</p>
                  <div className="mt-2 flex justify-between text-[10px] text-neutral-500">
                    <span>Confidence {recommendation.confidence}%</span>
                    {recommendation.trustChange != null && (
                      <span className={recommendation.trustChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        Trust {recommendation.trustChange > 0 ? '+' : ''}{recommendation.trustChange}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {councilActivity.length > 0 && (
            <StaffPagination label="Council items" total={councilActivity.length} page={safeCouncilPage} pageCount={councilPageCount} onPage={setCouncilPage} />
          )}
        </Panel>
      )}

      {tab === 'contracts' && (
        <Panel title="Staff Contracts & Commitments">
          {roster.length === 0 ? <p className="text-sm text-neutral-500">No staff contracts are currently active.</p> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {contractStaff.map((member) => {
                const clause = staffClauses.find((entry) => entry.partyId === member.id);
                const futureIntent = state.characterInteractions?.futureIntentions.find((entry) => entry.target.type === 'Staff' && entry.target.id === member.id);
                const selected = member.id === selectedStaffId;
                return <div key={member.id} className={`rounded-lg border p-3 ${selected ? 'border-amber-400/80 bg-amber-400/10' : 'border-[var(--era-accent)]/35 bg-neutral-900/40'}`}>
                  <div className="flex justify-between gap-2">
                    <div><span className="font-semibold text-neutral-100">{member.name}</span><div className="text-[10px] text-neutral-500">{member.role}</div>{selected && <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">Inbox action</div>}</div>
                    <span className="text-[10px] uppercase text-[var(--era-accent-strong)]">{member.contractYearsRemaining ?? 2} yr{(member.contractYearsRemaining ?? 2) === 1 ? '' : 's'} left</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <Stat label="Salary/yr">{formatMoney(toMoney(member.salary))}</Stat>
                    <Stat label="Release">{formatMoney(staffReleaseCost(member))}</Stat>
                  </div>
                  {clause ? <>
                    <div className="mt-2 text-xs font-semibold text-[var(--era-accent-strong)]">{contractClauseLabel(clause.clauseType)}</div>
                    <p className="mt-1 text-[11px] text-neutral-400">{clause.description}</p>
                    <div className="mt-1 text-[10px] text-red-300">Risk: {clause.breachConsequence}</div>
                  </> : <div className="mt-2 text-[11px] text-neutral-500">Standard employment terms · no special clause.</div>}
                  {futureIntent && <div className="mt-2 text-[10px] text-amber-300">{characterFutureIntentLabel(futureIntent.target, futureIntent.status)} · renewal modifier {futureIntent.negotiationModifier > 0 ? '+' : ''}{futureIntent.negotiationModifier}</div>}
                  <CharacterDossierButton state={state} subject={{ type: 'staff', staff: member }} className="mt-2 w-full">Open Personnel File</CharacterDossierButton>
                </div>;
              })}
            </div>
          )}
          {roster.length > 0 && (
            <StaffPagination label="Staff contracts" total={roster.length} page={safeContractPage} pageCount={contractPageCount} onPage={setContractPage} />
          )}
        </Panel>
      )}

      {(tab === 'roster' || tab === 'market') && <div className="flex flex-wrap gap-1 border-b border-neutral-800" aria-label="Staff roles">
        {STAFF_ROLES.map((role) => {
          const filled = !!byRole[role];
          const isActive = role === activeRole;
          return (
            <button
              key={role}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveRole(role)}
              className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-amber-500 text-neutral-100'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {role}
              <span
                className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                  filled ? 'bg-emerald-500' : 'bg-neutral-600'
                }`}
                title={filled ? 'Position filled' : 'Vacant'}
              />
            </button>
          );
        })}
      </div>}

      {tab === 'roster' && (
        <Panel title={`${activeRole} · Current Appointment`}>
          <p className="mb-3 text-xs text-neutral-500">{ROLE_EFFECT[activeRole]}</p>
          {current ? (
            <div className="grid gap-3 xl:grid-cols-3">
              <StaffCard
                state={state}
                s={current}
                hired
                current
                highlighted={false}
                affordable
                replacementCost={0}
                poachingCost={0}
                latestOffer={contractOfferNews.find((item) => item.id.includes(`-${current.id}-`))}
                futureIntent={state.characterInteractions?.futureIntentions.find((entry) => entry.target.type === 'Staff' && entry.target.id === current.id)}
                onHire={() => undefined}
                onFire={() => dispatch({ type: 'FIRE_STAFF', staffId: current.id })}
                onExtend={() => navigate(`/staff/${encodeURIComponent(current.id)}/negotiate`)}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-950/30 p-5 text-sm text-neutral-500">
              This position is vacant. Open Recruitment to hire a {activeRole.toLowerCase()}.
            </div>
          )}
        </Panel>
      )}

      {tab === 'market' && <div className="flex gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-1" aria-label="Staff market sections">
        <button type="button" onClick={() => setMarketView('available')} className={`flex-1 rounded px-3 py-2 text-xs font-semibold ${marketView === 'available' ? 'bg-emerald-500/15 text-emerald-300' : 'text-neutral-500 hover:text-neutral-200'}`}>Available Market</button>
        <button type="button" onClick={() => setMarketView('rivals')} className={`flex-1 rounded px-3 py-2 text-xs font-semibold ${marketView === 'rivals' ? 'bg-orange-500/15 text-orange-300' : 'text-neutral-500 hover:text-neutral-200'}`}>Rival Team Staff</button>
      </div>}

      {tab === 'market' && <Panel title={`${activeRole} · ${marketView === 'available' ? 'Available' : 'Employed by Rivals'}`}>
        <p className="mb-3 text-xs text-neutral-500">{marketView === 'available' ? ROLE_EFFECT[activeRole] : 'These specialists are under contract. Hiring one pays their employer compensation and will affect the relationship between the teams.'}</p>
        <StaffRecruitmentList
          state={state}
          candidates={orderedRecruitmentCandidates}
          current={current}
          budget={budget}
          filters={recruitmentFilters}
          sort={recruitmentSort}
          selectedStaffId={selectedStaffId}
          marketView={marketView}
          onFilterChange={updateRecruitmentFilter}
          onSort={updateRecruitmentSort}
          onOpenNegotiation={(staffId) => navigate(`/staff/${encodeURIComponent(staffId)}/negotiate`)}
        />
      </Panel>}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function StaffRecruitmentList({
  state,
  candidates,
  current,
  budget,
  filters,
  sort,
  selectedStaffId,
  marketView,
  onFilterChange,
  onSort,
  onOpenNegotiation,
}: {
  state: GameState;
  candidates: ReturnType<typeof filterStaffRecruitmentCandidates>;
  current?: StaffMember;
  budget: number;
  filters: StaffRecruitmentFilters;
  sort: StaffRecruitmentSort;
  selectedStaffId: string | null;
  marketView: StaffMarketView;
  onFilterChange: <K extends keyof StaffRecruitmentFilters>(key: K, value: StaffRecruitmentFilters[K]) => void;
  onSort: (key: StaffRecruitmentSortKey) => void;
  onOpenNegotiation: (staffId: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded border border-neutral-800">
      <div className="border-b border-neutral-800 bg-neutral-950/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-neutral-400">
            {candidates.length} candidates · click a column to sort · select a name for the personnel file
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-neutral-400">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={filters.affordableOnly} onChange={(event) => onFilterChange('affordableOnly', event.target.checked)} />
              Affordable
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={filters.underContractOnly} onChange={(event) => onFilterChange('underContractOnly', event.target.checked)} />
              Under contract
            </label>
            <span className="text-[10px] text-neutral-600">Budget {formatMoney(budget)}</span>
          </div>
        </div>
        <input
          value={filters.query}
          onChange={(event) => onFilterChange('query', event.target.value)}
          placeholder="Search name, nationality, role, employer"
          aria-label="Search staff recruitment"
          className="mt-2 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600"
        />
      </div>
      <table className="w-full min-w-[920px] border-collapse text-xs">
        <thead className="bg-neutral-900/70 text-left text-[10px] uppercase tracking-wide text-neutral-500">
          <tr>
            <StaffSortableHeader label="Staff" sortKey="name" sort={sort} onSort={onSort} />
            <th className="px-2 py-2">Role</th>
            <StaffSortableHeader label="Rating" sortKey="rating" sort={sort} onSort={onSort} />
            <th className="px-2 py-2">Employer</th>
            <StaffSortableHeader label="Salary" sortKey="salary" sort={sort} onSort={onSort} />
            <StaffSortableHeader label="Fee" sortKey="signingFee" sort={sort} onSort={onSort} />
            {marketView === 'rivals' && <StaffSortableHeader label="Poaching" sortKey="poachingCost" sort={sort} onSort={onSort} />}
            <StaffSortableHeader label="Total cost" sortKey="totalCost" sort={sort} onSort={onSort} />
            <th className="px-2 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <StaffRecruitmentRow
              key={candidate.id}
              state={state}
              candidate={candidate}
              current={current}
              selected={candidate.id === selectedStaffId}
              onOpenNegotiation={onOpenNegotiation}
            />
          ))}
        </tbody>
      </table>
      {candidates.length === 0 && <div className="px-3 py-8 text-center text-sm text-neutral-500">No candidates match these filters.</div>}
    </div>
  );
}

function StaffSortableHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: StaffRecruitmentSortKey;
  sort: StaffRecruitmentSort;
  onSort: (key: StaffRecruitmentSortKey) => void;
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

function StaffRecruitmentRow({
  state,
  candidate,
  current,
  selected,
  onOpenNegotiation,
}: {
  state: GameState;
  candidate: ReturnType<typeof filterStaffRecruitmentCandidates>[number];
  current?: StaffMember;
  selected: boolean;
  onOpenNegotiation: (staffId: string) => void;
}) {
  return (
    <tr className={`border-t border-neutral-800/70 align-middle hover:bg-neutral-900/60 ${selected ? 'bg-amber-500/10' : ''}`}>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2">
          <CharacterDossierButton state={state} subject={{ type: 'staff', staff: candidate }} className="shrink-0">
            File
          </CharacterDossierButton>
          <div className="min-w-0">
            <div className="font-semibold text-neutral-100">{candidate.name}</div>
            <div className="truncate text-[10px] text-neutral-500">{candidate.nationality}</div>
          </div>
        </div>
      </td>
      <td className="px-2 py-2 text-neutral-400">{candidate.role}</td>
      <td className="px-2 py-2 tabular-nums text-amber-300">{staffRatingOutOfTen(candidate.rating).toFixed(1)}</td>
      <td className="px-2 py-2 text-neutral-400">{candidate.employerName ?? 'Free agent'}</td>
      <td className="px-2 py-2 tabular-nums text-neutral-300">{formatMoney(toMoney(candidate.salary))}</td>
      <td className="px-2 py-2 tabular-nums text-neutral-300">{formatMoney(toMoney(candidate.signingFee))}</td>
      {candidate.employerName && <td className="px-2 py-2 tabular-nums text-neutral-300">{formatMoney(candidate.poachingCost)}</td>}
      <td className={`px-2 py-2 tabular-nums ${candidate.affordable ? 'text-emerald-300' : 'text-red-300'}`}>{formatMoney(candidate.totalCost)}</td>
      <td className="px-2 py-2">
        <Button
          variant="primary"
          className="px-2 py-1 text-[10px]"
          disabled={!candidate.affordable}
          onClick={() => onOpenNegotiation(candidate.id)}
        >
          {candidate.affordable
            ? `${candidate.employerName ? 'Poach' : 'Hire'}${current ? ' / replace' : ''}`
            : 'Insufficient budget'}
        </Button>
      </td>
    </tr>
  );
}

function StaffPagination({
  label,
  total,
  page,
  pageCount,
  onPage,
}: {
  label: string;
  total: number;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2">
      <Button variant="secondary" disabled={page === 0} onClick={() => onPage(Math.max(0, page - 1))}>
        Previous
      </Button>
      <span className="text-xs text-neutral-500">
        {label} {page * STAFF_PAGE_SIZE + 1}–{Math.min(total, (page + 1) * STAFF_PAGE_SIZE)} of {total} · Page {page + 1} of {pageCount}
      </span>
      <Button variant="secondary" disabled={page >= pageCount - 1} onClick={() => onPage(Math.min(pageCount - 1, page + 1))}>
        Next
      </Button>
    </div>
  );
}

function StaffCard({
  state,
  s,
  hired,
  current,
  highlighted,
  affordable,
  replacementCost,
  employerName,
  poachingCost,
  latestOffer,
  futureIntent,
  onHire,
  onFire,
  onExtend,
}: {
  state: GameState;
  s: StaffMember;
  hired: boolean;
  current: boolean;
  highlighted: boolean;
  affordable: boolean;
  replacementCost: number;
  employerName?: string;
  poachingCost: number;
  latestOffer?: GameState['news'][number];
  futureIntent?: NonNullable<GameState['characterInteractions']>['futureIntentions'][number];
  onHire: () => void;
  onFire: () => void;
  onExtend: () => void;
}) {
  const yearsLeft = s.contractYearsRemaining ?? 2;
  const accepted = latestOffer?.id.includes('-accepted-') ?? false;
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlighted ? 'border-amber-400/80 bg-amber-400/10' : current ? 'border-amber-500/60 bg-amber-500/5' : 'border-neutral-800 bg-neutral-900/40'
      }`}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-neutral-100">{s.name}</div>
          <div className="text-xs text-neutral-500">{s.nationality}</div>
        </div>
        {current && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
            on staff
          </span>
        )}
        {!current && employerName && <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300">{employerName}</span>}
        {highlighted && <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">Inbox recommendation</span>}
      </div>
      <div className="mb-2">
        <StatBar label="Rating" value={staffRatingOutOfTen(s.rating)} max={10} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Stat label="Salary/yr">{formatMoney(toMoney(s.salary))}</Stat>
        <Stat label={current ? 'Contract' : employerName ? 'Poaching total' : 'Signing'}>{current ? `${yearsLeft} yr${yearsLeft === 1 ? '' : 's'} left` : formatMoney(toMoney(s.signingFee) + poachingCost)}</Stat>
      </div>
      <p className="mt-2 text-[11px] italic text-neutral-500">{s.bio}</p>
      <CharacterDossierButton state={state} subject={{ type: 'staff', staff: s }} className="mt-2 w-full">
        Open Personnel File
      </CharacterDossierButton>
      <div className="mt-3 border-t border-neutral-800 pt-2">
        {hired ? (
          <div className="space-y-2">
            {futureIntent && <div className={`rounded border px-2 py-1.5 text-[10px] ${futureIntent.status === 'WantsExit' ? 'border-red-500/35 bg-red-500/10' : futureIntent.status === 'TestingMarket' ? 'border-amber-500/35 bg-amber-500/10' : 'border-emerald-500/25 bg-emerald-500/5'}`}><div className="flex justify-between gap-2"><strong className="text-neutral-200">{characterFutureIntentLabel(futureIntent.target, futureIntent.status)}</strong><span className="text-neutral-500">Renewal {futureIntent.negotiationModifier > 0 ? '+' : ''}{futureIntent.negotiationModifier}</span></div><p className="mt-1 text-neutral-400">{futureIntent.reason}</p></div>}
            {state.gameMode !== 'SingleSeason' && !state.seasonComplete && yearsLeft < 5 && <Button variant="ghost" className="w-full px-2 py-1 text-xs" onClick={onExtend}>Open contract negotiation</Button>}
            {latestOffer && <div className={`rounded border px-2 py-1 text-[10px] ${accepted ? 'border-green-500/35 bg-green-500/10 text-green-300' : 'border-red-500/35 bg-red-500/10 text-red-300'}`}><strong>{accepted ? 'Accepted' : 'Refused'}:</strong> {latestOffer.headline}<p className="mt-0.5 text-neutral-400">{latestOffer.body}</p></div>}
            <Button variant="danger" className="w-full px-2 py-1 text-xs" disabled={staffReleaseCost(s) > teamById(state, state.selectedTeamId)!.budget} onClick={onFire}>
              Release ({formatMoney(staffReleaseCost(s))} compensation)
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            className="w-full px-2 py-1 text-xs"
            disabled={!affordable}
            onClick={onHire}
          >
            {affordable ? `${employerName ? `Poach from ${employerName}` : 'Hire'}${replacementCost > 0 ? ` + ${formatMoney(replacementCost)} replacement cost` : ''}` : 'Insufficient budget'}
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded bg-neutral-800/50 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="font-semibold tabular-nums text-neutral-200">{children}</div>
    </div>
  );
}

function advisorStatusTone(status: string): string {
  if (status === 'Accepted') return 'bg-emerald-500/10 text-emerald-300';
  if (status === 'Overruled' || status === 'Rejected') return 'bg-orange-500/10 text-orange-300';
  if (status === 'Expired') return 'bg-neutral-800 text-neutral-500';
  return 'bg-[var(--era-accent-soft)] text-[var(--era-accent-strong)]';
}
