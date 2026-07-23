import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import {
  getOrCreatePhaseState,
  hasUnresolvedRequiredDecisions,
} from '../game/careerPhaseEngine';
import {
  activeDriversForTeam,
  carForTeam,
  currentRace,
  teamById,
  type GameState,
} from '../game/careerState';
import { developmentSlots } from '../sim/facilityEngine';
import { activeUpgradePrograms } from '../sim/technicalAdapters';
import { leadershipDecisionPreview } from '../sim/phase18IdentityCultureEngine';
import {
  ADVISOR_ROLE_LABELS,
  advisorRecommendationsForDecision,
  hasAdvisorDisagreement,
} from '../sim/phase18AdvisorEngine';
import { getGameModeLabel } from '../game/modeRestrictions';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { NewsPanel } from '../components/NewsPanel';
import { formatMoney } from '../components/ui';
import type { PaddockEvent, PaddockEventCategory } from '../types/careerPhaseTypes';
import type { AdvisorRecommendation } from '../types/phase18Types';
import { RaceWeekendPackageSelection } from './RaceWeekendPackageSelection';
import { defaultPaddockTab, type PaddockAgendaTab, type PaddockPeopleSection } from './paddockAgendaViewModel';
import { buildWeeklyStory } from './weeklyStoryViewModel';
import { CharacterDossierButton } from '../components/characterCards/CharacterDossier';
import { DriverDossierButton } from '../components/driverCards/DriverDossier';
import { internalCharacterInfluence } from '../sim/characterInfluenceEngine';
import { activeCharacterMandates } from '../sim/characterMandateEngine';
import { unstableCharacterStability } from '../sim/characterBreakingPointEngine';
import { atRiskFutureIntentions, characterFutureIntentLabel, characterFutureIntentRenewalOutlook } from '../sim/characterFutureIntentEngine';
import {
  advisorCouncilReadForOption,
  relationshipStakeholdersForDecision,
} from './paddock/relationshipDecisionViewModel';
import {
  relationshipStatusLabel,
  relationshipTargetLabel,
} from './relationships/relationshipPriorityViewModel';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';

const CATEGORY_LABELS: Record<PaddockEventCategory, string> = {
  development: 'Development / Factory',
  driver_morale: 'Driver & Morale',
  sponsor: 'Sponsor / Commercial',
  finance: 'Finance',
  staff: 'Staff',
  facility: 'Staff / Facilities',
  engine: 'Engine / Manufacturer',
  scouting: 'Youth Academy / Scouting',
  regulation: 'Regulation / Series Updates',
  ai_team: 'AI Team News',
  next_race: 'Next Race Briefing',
  general_team: 'Team Updates',
};

const CATEGORY_ORDER: PaddockEventCategory[] = [
  'next_race',
  'general_team',
  'development',
  'driver_morale',
  'sponsor',
  'finance',
  'staff',
  'facility',
  'engine',
  'scouting',
  'regulation',
  'ai_team',
];

const SEVERITY_COLORS: Record<string, string> = {
  info: 'text-neutral-400',
  minor: 'text-[var(--era-accent-strong)]',
  major: 'text-orange-400',
  critical: 'text-red-400',
};

const INFLUENCE_STANCE_COLORS = {
  Champion: 'bg-emerald-500/10 text-emerald-300',
  Supportive: 'bg-[var(--era-accent-soft)] text-[var(--era-accent-strong)]',
  Neutral: 'bg-neutral-800 text-neutral-300',
  Resistant: 'bg-amber-500/10 text-amber-300',
  Obstructive: 'bg-red-500/10 text-red-300',
} as const;

function influencePowerRead(power: number): string {
  if (power >= 80) return 'Very high leverage';
  if (power >= 60) return 'High leverage';
  if (power >= 35) return 'Moderate leverage';
  return 'Limited leverage';
}

function influenceSupportRead(support: number): string {
  if (support >= 25) return 'Strongly helping';
  if (support > 0) return 'Helping';
  if (support <= -25) return 'Strongly resisting';
  if (support < 0) return 'Resisting';
  return 'Neutral';
}

type PaddockTab = PaddockAgendaTab;
type PeopleSection = PaddockPeopleSection;

export function PaddockWeek() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<PaddockTab>('people');
  const [peopleSection, setPeopleSection] = useState<PeopleSection>('attention');
  const [updateCategory, setUpdateCategory] = useState<PaddockEventCategory>('next_race');

  // Generate paddock events on mount if not already generated.
  useEffect(() => {
    if (!state) return;
    const phaseState = getOrCreatePhaseState(state);
    if (!phaseState.generatedEventsForCurrentWeek) {
      dispatch({ type: 'GENERATE_PADDOCK_EVENTS' });
    }
  }, [state, dispatch]);

  const phaseState = useMemo(
    () => (state ? getOrCreatePhaseState(state) : null),
    [state],
  );

  // Group events by category (must be before any early return — hooks order).
  const eventsByCategory = useMemo(() => {
    if (!phaseState) return {};
    const map: Record<string, PaddockEvent[]> = {};
    for (const e of phaseState.paddockEvents) {
      if (e.narrativeStoryId || e.characterRequest || e.characterDispute || e.characterInitiative || e.characterBreakingPoint) continue;
      if (!map[e.category]) map[e.category] = [];
      map[e.category].push(e);
    }
    return map;
  }, [phaseState]);

  const focusedEventId = searchParams.get('focus');
  useEffect(() => {
    if (!focusedEventId) return;
    const element = Array.from(document.querySelectorAll<HTMLElement>('[data-paddock-event-id]'))
      .find((candidate) => candidate.dataset.paddockEventId === focusedEventId);
    element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusedEventId, searchParams]);

  if (!state || !phaseState) return null;

  const team = teamById(state, state.selectedTeamId);
  const car = carForTeam(state, state.selectedTeamId);
  const race = currentRace(state);
  const activeDrivers = activeDriversForTeam(state, state.selectedTeamId);
  const slots = developmentSlots(state.facilities);
  const packageSelected = !!race && state.raceWeekendPackage?.raceId === race.id;

  const unresolvedCount = phaseState.paddockEvents.filter(
    (e) => e.isRequiredDecision && !e.resolvedOptionId,
  ).length;
  const characterRequests = phaseState.paddockEvents.filter((event) => !!event.characterRequest);
  const unresolvedCharacterRequests = characterRequests.filter((event) => !event.resolvedOptionId);
  const resolvedCharacterRequests = characterRequests.filter((event) => !!event.resolvedOptionId);
  const characterDisputes = phaseState.paddockEvents.filter((event) => !!event.characterDispute);
  const unresolvedCharacterDisputes = characterDisputes.filter((event) => !event.resolvedOptionId);
  const resolvedCharacterDisputes = characterDisputes.filter((event) => !!event.resolvedOptionId);
  const characterInitiatives = phaseState.paddockEvents.filter((event) => !!event.characterInitiative);
  const unresolvedCharacterInitiatives = characterInitiatives.filter((event) => !event.resolvedOptionId);
  const resolvedCharacterInitiatives = characterInitiatives.filter((event) => !!event.resolvedOptionId);
  const characterBreakingPoints = phaseState.paddockEvents.filter((event) => !!event.characterBreakingPoint);
  const unresolvedCharacterBreakingPoints = characterBreakingPoints.filter((event) => !event.resolvedOptionId);
  const resolvedCharacterBreakingPoints = characterBreakingPoints.filter((event) => !!event.resolvedOptionId);
  const nonCharacterUnresolved = phaseState.paddockEvents.filter(
    (event) => event.isRequiredDecision && !event.resolvedOptionId && !event.characterRequest && !event.characterDispute && !event.characterInitiative && !event.characterBreakingPoint,
  );
  const pendingCount = unresolvedCount + (packageSelected ? 0 : 1);

  const canAdvance = !hasUnresolvedRequiredDecisions(state) && packageSelected;
  const resolvedDecisionIds = new Set(
    phaseState.paddockEvents.filter((event) => !!event.resolvedOptionId).map((event) => event.id),
  );
  const advisorDebrief = (state.phase18?.advisorRecommendations ?? []).filter(
    (recommendation) => recommendation.decisionId
      && resolvedDecisionIds.has(recommendation.decisionId)
      && (recommendation.status === 'Accepted' || recommendation.status === 'Overruled'),
  );
  const storyDecisions = phaseState.paddockEvents.filter(
    (event) => !!event.narrativeStoryId && !event.resolvedOptionId,
  );
  const resolvedDecisions = phaseState.paddockEvents.filter((event) => !!event.resolvedOptionId && !event.characterRequest && !event.characterDispute && !event.characterInitiative && !event.characterBreakingPoint);
  const populatedCategories = CATEGORY_ORDER.filter((category) => (eventsByCategory[category]?.length ?? 0) > 0);
  const visibleUpdateCategory = populatedCategories.includes(updateCategory)
    ? updateCategory
    : populatedCategories[0] ?? 'next_race';
  const updateCount = populatedCategories.reduce((total, category) => total + (eventsByCategory[category]?.length ?? 0), 0);
  const internalInfluence = internalCharacterInfluence(state).slice(0, 8);
  const activeMandates = activeCharacterMandates(state).slice(0, 6);
  const unstableCharacters = unstableCharacterStability(state).slice(0, 6);
  const atRiskIntentions = atRiskFutureIntentions(state).slice(0, 6);
  const expiringDrivers = state.gameMode === 'SingleSeason' ? [] : state.drivers.filter((driver) => driver.teamId === state.selectedTeamId && (driver.contractYearsRemaining ?? 1) <= 1);
  const expiringStaff = state.gameMode === 'SingleSeason' ? [] : (state.staff ?? []).filter((member) => (member.contractYearsRemaining ?? 2) <= 1);
  const pendingPersonnelMoves = (state.characterInteractions?.personnelMoves ?? [])
    .filter((move) => move.status === 'Pending' && move.effectiveSeason === state.seasonYear + 1);
  const peopleAttentionCount = unresolvedCharacterRequests.length
    + unresolvedCharacterDisputes.length
    + unresolvedCharacterInitiatives.length
    + unresolvedCharacterBreakingPoints.length;
  const operationsAttentionCount = nonCharacterUnresolved.length + (packageSelected ? 0 : 1) + storyDecisions.length;
  const requestedTab = searchParams.get('tab');
  const requestedPeopleSection = searchParams.get('section');
  const hasRequiredDecision = phaseState.paddockEvents.some(
    (event) => event.isRequiredDecision && !event.resolvedOptionId,
  );
  const activeTab: PaddockTab = requestedTab && ['overview', 'people', 'decisions', 'updates', 'debrief'].includes(requestedTab)
    ? requestedTab as PaddockTab
    : !searchParams.has('tab') && (hasRequiredDecision || !packageSelected)
      ? defaultPaddockTab(hasRequiredDecision, packageSelected)
      : tab;
  const activePeopleSection: PeopleSection = requestedPeopleSection && ['attention', 'support', 'resolved'].includes(requestedPeopleSection)
    ? requestedPeopleSection as PeopleSection
    : peopleSection;

  const updatePaddockQuery = (key: 'tab' | 'section', value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    next.delete('focus');
    setSearchParams(next);
  };

  const advanceToBriefing = () => {
    dispatch({ type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
    navigate('/briefing');
  };
  const weeklyStory = buildWeeklyStory(state);

  return (
    <WorkspaceScreen className="era-feature-screen era-paddock-week">
      <WorkspaceHeader
        eyebrow="Weekly management"
        title="Paddock Week"
        subtitle={`${state.seasonYear} ${state.series} · Between rounds ${phaseState.currentRound} and ${phaseState.currentRound + 1} · ${getGameModeLabel(state.gameMode)}`}
        actions={<>
          <Button variant="ghost" onClick={() => navigate('/hq')}>Manager Office</Button>
          {pendingCount > 0 && (
            <span className="text-xs font-semibold text-orange-400">
              {pendingCount} required decision{pendingCount > 1 ? 's' : ''} pending
            </span>
          )}
          <Button
            variant="primary"
            onClick={advanceToBriefing}
            disabled={!canAdvance}
            title={canAdvance ? 'Advance to Pre-Race Briefing' : 'Resolve required decisions and select a race package first'}
          >
            Advance to Briefing →
          </Button>
        </>}
      />

      <MetricStrip>
        <WorkspaceMetric label="Budget" value={team ? formatMoney(team.budget) : '—'} detail={`${activeDrivers.length}/2 active drivers`} />
        <WorkspaceMetric label="Team readiness" value={`${Math.round(team?.morale ?? 0)}% morale`} detail={`${Math.round(car?.condition ?? 0)}% car condition`} />
        <WorkspaceMetric label="Development" value={`${activeUpgradePrograms(state).length}/${slots} slots`} detail="Active technical projects" />
        <WorkspaceMetric label="Required actions" value={pendingCount} detail={packageSelected ? `${unresolvedCount} decisions unresolved` : 'Race package still required'} />
      </MetricStrip>

      <div className="ui-decision-strip flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="ui-decision-strip-pulse" aria-hidden="true" />
            <span className="font-semibold text-neutral-100">Paddock operations desk</span>
            <span className="text-neutral-400">
              {!packageSelected
                ? 'Select the race package before advancing.'
                : pendingCount > 0
                  ? `${pendingCount} decision${pendingCount === 1 ? '' : 's'} remain before briefing.`
                  : 'All required decisions are complete. Review the debrief before briefing.'}
            </span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            {operationsAttentionCount + peopleAttentionCount > 0
              ? `${operationsAttentionCount + peopleAttentionCount} attention item${operationsAttentionCount + peopleAttentionCount === 1 ? '' : 's'}`
              : 'Ready for briefing'}
          </span>
      </div>

      <WorkspaceTabs
        items={[
          { id: 'overview' as const, label: 'Overview' },
          { id: 'people' as const, label: `People (${characterRequests.length + characterDisputes.length + characterInitiatives.length + characterBreakingPoints.length + activeMandates.length + pendingPersonnelMoves.length})` },
          { id: 'decisions' as const, label: `Operations (${operationsAttentionCount})` },
          { id: 'updates' as const, label: `Team Updates (${updateCount})` },
          { id: 'debrief' as const, label: `Decision Debrief (${resolvedDecisions.length})` },
        ]}
        active={activeTab}
        onChange={(nextTab) => {
          setTab(nextTab);
          updatePaddockQuery('tab', nextTab);
        }}
        ariaLabel="Paddock Week sections"
      />

      <WorkspaceBody className="space-y-4">
      {weeklyStory && (
        <Panel title={`Returned from ${weeklyStory.raceLabel}`}>
          <p className="text-xs leading-5 text-neutral-500">{weeklyStory.summary}</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {weeklyStory.groups.filter((group) => group.owner !== 'Race review').map((group) => (
              <div key={group.owner} className="rounded border border-neutral-800 bg-neutral-950/30 p-2">
                <div className="text-[10px] font-black uppercase tracking-wide text-violet-300">{group.owner}</div>
                {group.items.map((item) => (
                  <button key={item.id} type="button" className="mt-2 block w-full text-left" onClick={() => navigate(item.route)}>
                    <div className="text-xs font-semibold text-neutral-200">{item.title}</div>
                    <div className="mt-1 text-[10px] leading-4 text-neutral-500">{item.reason}</div>
                    <div className="mt-1 text-[10px] font-semibold text-sky-300">{item.routeLabel} →</div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Panel>
      )}
      {/* Paddock News */}
      {activeTab === 'overview' && <div className="grid gap-4 lg:grid-cols-2">
        <NewsPanel
          news={state.news}
          title="Paddock Headlines"
          maxItems={5}
          categoryFilter={['paddock', 'development', 'ai_team']}
          emptyMessage="No paddock news this week."
        />
        <NewsPanel
          news={state.news}
          title="My Team & Finance"
          maxItems={4}
          teamId={state.selectedTeamId}
          categoryFilter={['financial', 'sponsor', 'career_event']}
          emptyMessage="No team news this week."
        />
      </div>}

      {activeTab === 'people' && <div className="space-y-4">
        <WorkspaceTabs
          items={[
            { id: 'attention' as const, label: `Needs Attention (${peopleAttentionCount})` },
            { id: 'support' as const, label: `Support & Mandates (${activeMandates.length + unstableCharacters.length + atRiskIntentions.length + expiringDrivers.length + expiringStaff.length + pendingPersonnelMoves.length})` },
            { id: 'resolved' as const, label: `Resolved This Week (${resolvedCharacterRequests.length + resolvedCharacterDisputes.length + resolvedCharacterInitiatives.length + resolvedCharacterBreakingPoints.length})` },
          ]}
          active={activePeopleSection}
          onChange={(nextSection) => {
            setPeopleSection(nextSection);
            updatePaddockQuery('section', nextSection);
          }}
          ariaLabel="People management sections"
        />
        {activePeopleSection === 'support' && internalInfluence.length > 0 && (
          <Panel title="Internal Support Map">
            <p className="mb-3 text-xs text-neutral-500">Power shows the rough leverage a person has. Support shows whether they are helping or resisting your leadership; that stance can nudge their driver, department, or ownership relationship over time.</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {internalInfluence.map((profile) => (
                <article key={`${profile.target.type}-${profile.target.id}`} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block truncate text-xs text-neutral-200">{profile.target.name}</strong>
                      <span className="text-[10px] text-neutral-500">{profile.target.type}</span>
                    </div>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${INFLUENCE_STANCE_COLORS[profile.stance]}`}>{profile.stance}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-center text-[10px]">
                    <div className="rounded bg-neutral-950/70 px-1.5 py-1 text-neutral-500">Power <strong className="text-neutral-200">{influencePowerRead(profile.power)}</strong></div>
                    <div className="rounded bg-neutral-950/70 px-1.5 py-1 text-neutral-500">Support <strong className="text-neutral-200">{influenceSupportRead(profile.support)}</strong></div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-neutral-400">{profile.effectLabel}</p>
                </article>
              ))}
            </div>
          </Panel>
        )}
        {activePeopleSection === 'support' && activeMandates.length > 0 && (
          <Panel title="Delegated Mandates">
            <p className="mb-3 text-xs text-neutral-500">Authority now comes with accountability. Each character contributes once per round, then succeeds or fails against the measure shown at the deadline.</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {activeMandates.map((mandate) => (
                <article key={mandate.id} className="rounded-lg border border-cyan-900/50 bg-cyan-950/10 p-3">
                  <div className="flex items-start justify-between gap-2"><div><strong className="block text-xs text-neutral-200">{mandate.target.name}</strong><span className="text-[10px] text-cyan-300">{mandate.authority} authority</span></div><span className="text-[10px] font-semibold text-amber-300">Due R{mandate.dueRound}</span></div>
                  <div className="mt-2 text-[10px] text-neutral-500">{mandate.measureLabel}</div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-800"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.min(100, Math.round((mandate.currentValue / Math.max(1, mandate.targetValue)) * 100))}%` }} /></div>
                  <div className="mt-1 text-right text-[10px] text-neutral-400">{mandate.currentValue}/{mandate.targetValue}</div>
                </article>
              ))}
            </div>
          </Panel>
        )}
        {activePeopleSection === 'support' && pendingPersonnelMoves.length > 0 && (
          <Panel title="Planned Personnel Moves">
            <p className="mb-3 text-xs text-neutral-500">These departures are agreed, not rumors. The person will finish the current contract and join the named team at season rollover.</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {pendingPersonnelMoves.map((move) => (
                <article key={move.id} className="rounded-lg border border-orange-900/50 bg-orange-950/10 p-3">
                  <div className="flex items-start justify-between gap-2"><div><strong className="block text-xs text-neutral-200">{move.targetName}</strong><span className="text-[10px] text-neutral-500">{move.targetType}</span></div><span className="text-[10px] font-bold text-orange-300">{move.effectiveSeason}</span></div>
                  <p className="mt-2 text-[10px] text-neutral-300">Joining <strong>{move.destinationTeamName}</strong></p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-neutral-500">{move.reason}</p>
                </article>
              ))}
            </div>
          </Panel>
        )}
        {activePeopleSection === 'support' && unstableCharacters.length > 0 && (
          <Panel title="Relationship Stability">
            <p className="mb-3 text-xs text-neutral-500">This combines trust, recent memories, promises, ambitions, disputes, support, and mandate results. A breaking point will become a required decision.</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {unstableCharacters.map((profile) => (
                <article key={`${profile.target.type}-${profile.target.id}`} className={`rounded-lg border p-3 ${profile.band === 'BreakingPoint' ? 'border-red-900/60 bg-red-950/15' : 'border-amber-900/50 bg-amber-950/10'}`}>
                  <div className="flex items-start justify-between gap-2"><div><strong className="block text-xs text-neutral-200">{profile.target.name}</strong><span className="text-[10px] text-neutral-500">{profile.target.type}</span></div><span className={`text-[10px] font-bold ${profile.band === 'BreakingPoint' ? 'text-red-300' : 'text-amber-300'}`}>{profile.band}</span></div>
                  <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-neutral-400">{profile.reasons.join(' · ') || 'Recent relationship pressure is accumulating.'}</p>
                </article>
              ))}
            </div>
          </Panel>
        )}
        {activePeopleSection === 'support' && atRiskIntentions.length > 0 && (
          <Panel title="Future Intentions & Retention Risk">
            <p className="mb-3 text-xs text-neutral-500">Intentions translate relationship stability into likely future behavior. Driver and staff status directly affects renewal willingness; movement still follows the existing contract and offseason rules.</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {atRiskIntentions.map((intent) => (
                <article key={`${intent.target.type}-${intent.target.id}`} className={`rounded-lg border p-3 ${intent.status === 'WantsExit' ? 'border-red-900/60 bg-red-950/15' : 'border-amber-900/50 bg-amber-950/10'}`}>
                  <div className="flex items-start justify-between gap-2"><div><strong className="block text-xs text-neutral-200">{intent.target.name}</strong><span className="text-[10px] text-neutral-500">{intent.target.type}</span></div><span className={`text-[10px] font-bold ${intent.status === 'WantsExit' ? 'text-red-300' : 'text-amber-300'}`}>{characterFutureIntentLabel(intent.target, intent.status)}</span></div>
                  <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-neutral-400">{intent.reason}</p>
                  <div className="mt-2 flex justify-between text-[10px] text-neutral-500"><span>{intent.leverage >= 70 ? 'Strong leverage' : intent.leverage >= 40 ? 'Moderate leverage' : 'Limited leverage'}</span>{(intent.target.type === 'Driver' || intent.target.type === 'Staff') && <span>{characterFutureIntentRenewalOutlook(intent.status)}</span>}</div>
                </article>
              ))}
            </div>
          </Panel>
        )}
        {activePeopleSection === 'support' && expiringDrivers.length > 0 && (
          <Panel title="Expiring Driver Contracts">
            <p className="mb-3 text-xs text-neutral-500">These deals end at season rollover. Agree an extension in the Drivers screen or prepare a replacement; otherwise the driver leaves and the reserve/rookie fallback fills any empty race seat.</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {expiringDrivers.map((driver) => {
                const intent = state.characterInteractions?.futureIntentions.find((entry) => entry.target.type === 'Driver' && entry.target.id === driver.id);
                return <article key={driver.id} className="rounded-lg border border-red-900/50 bg-red-950/10 p-3"><div className="flex items-start justify-between gap-2"><div><strong className="block text-xs text-neutral-200">{driver.name}</strong><span className="text-[10px] text-neutral-500">{driver.contractType ?? 'Race seat'}</span></div><span className="text-[10px] font-bold text-red-300">Expires this year</span></div><p className="mt-2 text-[10px] text-neutral-400">{intent ? characterFutureIntentLabel(intent.target, intent.status) : 'Future undecided'}</p></article>;
              })}
            </div>
          </Panel>
        )}
        {activePeopleSection === 'support' && expiringStaff.length > 0 && (
          <Panel title="Expiring Staff Contracts">
            <p className="mb-3 text-xs text-neutral-500">These specialists leave at season rollover unless an extension is accepted. Renew them in the Staff screen or plan to recruit from the real era and series staff pool; an expired role remains vacant.</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {expiringStaff.map((member) => {
                const intent = state.characterInteractions?.futureIntentions.find((entry) => entry.target.type === 'Staff' && entry.target.id === member.id);
                return <article key={member.id} className="rounded-lg border border-red-900/50 bg-red-950/10 p-3"><div className="flex items-start justify-between gap-2"><div><strong className="block text-xs text-neutral-200">{member.name}</strong><span className="text-[10px] text-neutral-500">{member.role}</span></div><span className="text-[10px] font-bold text-red-300">Expires this year</span></div><p className="mt-2 text-[10px] text-neutral-400">{intent ? characterFutureIntentLabel(intent.target, intent.status) : 'Future undecided'}</p></article>;
              })}
            </div>
          </Panel>
        )}
        {activePeopleSection === 'attention' && unresolvedCharacterBreakingPoints.length > 0 && (
          <Panel title="Character Breaking Point" className="border-red-700/40">
            <p className="mb-3 text-xs text-neutral-500">Repeated decisions have pushed this relationship beyond ordinary weekly pressure. Your response is required and will be remembered.</p>
            <div className="grid gap-3 xl:grid-cols-2">
              {unresolvedCharacterBreakingPoints.map((event) => (
                <div key={event.id} className="rounded-xl border border-red-900/70 bg-red-950/15 p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-red-300">Breaking point · {event.characterBreakingPoint?.target.name}</div>
                  <DecisionCard focused={focusedEventId === event.id} state={state} event={event} recommendations={advisorRecommendationsForDecision(state, event.id)} onResolve={(optionId) => dispatch({ type: 'RESOLVE_PADDOCK_EVENT', eventId: event.id, optionId })} />
                </div>
              ))}
            </div>
          </Panel>
        )}
        {activePeopleSection === 'attention' && unresolvedCharacterInitiatives.length > 0 && (
          <Panel title="Character Initiatives" className="border-fuchsia-700/30">
            <p className="mb-3 text-xs text-neutral-500">People with enough power and conviction now act on their own. The stated motive, power, and support explain why this maneuver surfaced and what is at stake.</p>
            <div className="grid gap-3 xl:grid-cols-2">
              {unresolvedCharacterInitiatives.map((event) => (
                <CharacterInitiativeCard key={event.id} focused={focusedEventId === event.id} state={state} event={event} recommendations={advisorRecommendationsForDecision(state, event.id)} onResolve={(optionId) => dispatch({ type: 'RESOLVE_PADDOCK_EVENT', eventId: event.id, optionId })} />
              ))}
            </div>
          </Panel>
        )}
        {activePeopleSection === 'attention' && unresolvedCharacterDisputes.length > 0 && (
          <Panel title="Conflicts Requiring Management" className="border-red-700/30">
            <p className="mb-3 text-xs text-neutral-500">Persistent tensions can become active disputes. Your intervention affects both people, their connection, and the camps around them.</p>
            <div className="grid gap-3 xl:grid-cols-2">
              {unresolvedCharacterDisputes.map((event) => (
                <div key={event.id} className="rounded-xl border border-red-900/60 bg-red-950/10 p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-red-300">Character dispute · {event.characterDispute?.characterA.name} vs {event.characterDispute?.characterB.name}</div>
                  <DecisionCard focused={focusedEventId === event.id} state={state} event={event} recommendations={advisorRecommendationsForDecision(state, event.id)} onResolve={(optionId) => dispatch({ type: 'RESOLVE_PADDOCK_EVENT', eventId: event.id, optionId })} />
                </div>
              ))}
            </div>
          </Panel>
        )}
        {activePeopleSection === 'attention' && unresolvedCharacterRequests.length > 0 && (
          <Panel title="Conversations & Market Decisions" className="border-violet-600/30">
            <p className="mb-3 text-xs text-neutral-500">Characters can bring concerns, requests, political approaches, and concrete rival offers to you. Required conversations must be answered before the week can advance.</p>
            <div className="grid gap-3 xl:grid-cols-2">
              {unresolvedCharacterRequests.map((event) => (
                <CharacterDecisionCard
                  key={event.id}
                  state={state}
                  event={event}
                  focused={focusedEventId === event.id}
                  recommendations={advisorRecommendationsForDecision(state, event.id)}
                  onResolve={(optionId) => dispatch({ type: 'RESOLVE_PADDOCK_EVENT', eventId: event.id, optionId })}
                />
              ))}
            </div>
          </Panel>
        )}
        {activePeopleSection === 'resolved' && resolvedCharacterRequests.length > 0 && (
          <Panel title="This Week's People Decisions">
            <div className="grid gap-3 xl:grid-cols-2">
              {resolvedCharacterRequests.map((event) => {
                const record = state.characterInteractions?.requestHistory.find((entry) => entry.eventId === event.id);
                return <article key={event.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3"><div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold text-neutral-200">{event.characterRequest?.targetName}</div><span className="rounded bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-300">Resolved</span></div><div className="mt-1 text-xs font-semibold text-amber-300">{record?.optionLabel ?? event.options?.find((option) => option.id === event.resolvedOptionId)?.label}</div><p className="mt-1 text-xs leading-relaxed text-neutral-400">{record?.outcome ?? event.description}</p>{record?.effects.length ? <div className="mt-2 flex flex-wrap gap-1">{record.effects.map((effect) => <span key={effect} className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-300">{effect}</span>)}</div> : null}</article>;
              })}
            </div>
          </Panel>
        )}
        {activePeopleSection === 'resolved' && resolvedCharacterDisputes.length > 0 && <Panel title="Disputes Addressed This Week"><div className="grid gap-3 xl:grid-cols-2">{resolvedCharacterDisputes.map((event) => <article key={event.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-neutral-200">{event.characterDispute?.characterA.name} / {event.characterDispute?.characterB.name}</strong><span className="rounded bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-300">Addressed</span></div><div className="mt-1 text-xs font-semibold text-amber-300">{event.options?.find((option) => option.id === event.resolvedOptionId)?.label}</div><p className="mt-1 text-xs text-neutral-400">The decision is now part of both characters' persistent history.</p></article>)}</div></Panel>}
        {activePeopleSection === 'resolved' && resolvedCharacterInitiatives.length > 0 && <Panel title="Initiatives Answered This Week"><div className="grid gap-3 xl:grid-cols-2">{resolvedCharacterInitiatives.map((event) => { const initiative = state.characterInteractions?.initiatives.find((entry) => entry.id === event.characterInitiative?.initiativeId); return <article key={event.id} className="rounded-lg border border-fuchsia-900/40 bg-fuchsia-950/10 p-3"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-neutral-200">{event.characterInitiative?.target.name}</strong><span className="rounded bg-fuchsia-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-fuchsia-300">{initiative?.status ?? 'Resolved'}</span></div><div className="mt-1 text-xs font-semibold text-amber-300">{initiative?.optionLabel}</div><p className="mt-1 text-xs text-neutral-400">{initiative?.outcome}</p></article>; })}</div></Panel>}
        {activePeopleSection === 'resolved' && resolvedCharacterBreakingPoints.length > 0 && <Panel title="Breaking Points Addressed"><div className="grid gap-3 xl:grid-cols-2">{resolvedCharacterBreakingPoints.map((event) => { const entry = state.characterInteractions?.breakingPoints.find((item) => item.id === event.characterBreakingPoint?.breakingPointId); return <article key={event.id} className="rounded-lg border border-red-900/40 bg-red-950/10 p-3"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-neutral-200">{event.characterBreakingPoint?.target.name}</strong><span className="rounded bg-red-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-red-300">{entry?.status ?? 'Addressed'}</span></div><div className="mt-1 text-xs font-semibold text-amber-300">{entry?.optionLabel}</div><p className="mt-1 text-xs text-neutral-400">{entry?.outcome}</p></article>; })}</div></Panel>}
        {activePeopleSection === 'attention' && unresolvedCharacterRequests.length === 0 && unresolvedCharacterDisputes.length === 0 && unresolvedCharacterInitiatives.length === 0 && unresolvedCharacterBreakingPoints.length === 0 && <Panel title="Needs Attention"><p className="text-sm text-neutral-500">No character requires a decision this week.</p></Panel>}
        {activePeopleSection === 'support' && internalInfluence.length === 0 && activeMandates.length === 0 && unstableCharacters.length === 0 && atRiskIntentions.length === 0 && expiringDrivers.length === 0 && expiringStaff.length === 0 && pendingPersonnelMoves.length === 0 && <Panel title="Support & Mandates"><p className="text-sm text-neutral-500">No internal support, delegated mandates, unstable relationships, retention risks, planned moves, or expiring contracts are currently recorded.</p></Panel>}
        {activePeopleSection === 'resolved' && resolvedCharacterRequests.length === 0 && resolvedCharacterDisputes.length === 0 && resolvedCharacterInitiatives.length === 0 && resolvedCharacterBreakingPoints.length === 0 && <Panel title="Resolved This Week"><p className="text-sm text-neutral-500">No people decisions have been resolved this week.</p></Panel>}
      </div>}

      {/* Required Decisions */}
      {activeTab === 'decisions' && <>
      {(nonCharacterUnresolved.length > 0 || !packageSelected) && (
        <Panel title="Required Decisions" className="border-amber-600/30">
          <div className="space-y-4">
            {!packageSelected && (
              <div>
                <div className="mb-2 text-sm font-semibold text-amber-300">Select race operations package</div>
                <p className="mb-3 text-sm text-neutral-300">
                  Choose the package the team will bring to {race?.gpName ?? 'the next race'} before the pre-race briefing.
                </p>
                <RaceWeekendPackageSelection onConfirm={() => undefined} />
              </div>
            )}
            {phaseState.paddockEvents
              .filter((e) => e.isRequiredDecision && !e.resolvedOptionId && !e.characterRequest && !e.characterDispute && !e.characterInitiative && !e.characterBreakingPoint)
              .map((event) => (
                <DecisionCard
                  focused={focusedEventId === event.id}
                  key={event.id}
                  state={state}
                  event={event}
                  recommendations={advisorRecommendationsForDecision(state, event.id)}
                  onResolve={(optionId) =>
                    dispatch({ type: 'RESOLVE_PADDOCK_EVENT', eventId: event.id, optionId })
                  }
                />
              ))}
          </div>
        </Panel>
      )}

      {storyDecisions.length > 0 && (
        <Panel title="Paddock Story Decisions" className="border-violet-700/30">
          <p className="mb-3 text-xs text-neutral-500">
            These responses are optional. Unanswered stories remain active and the paddock may continue applying pressure.
          </p>
          <div className="grid gap-3 xl:grid-cols-2">
            {storyDecisions.map((event) => (
              <DecisionCard
                key={event.id}
                focused={focusedEventId === event.id}
                state={state}
                event={event}
                recommendations={advisorRecommendationsForDecision(state, event.id)}
                onResolve={(optionId) => dispatch({ type: 'RESOLVE_PADDOCK_EVENT', eventId: event.id, optionId })}
              />
            ))}
          </div>
        </Panel>
      )}
      {nonCharacterUnresolved.length === 0 && packageSelected && storyDecisions.length === 0 && (
        <Panel title="Decisions Complete">
          <p className="text-sm text-emerald-300">All required decisions are complete. Review updates or advance to the pre-race briefing.</p>
        </Panel>
      )}
      </>}

      {/* Resolved Decisions */}
      {activeTab === 'debrief' && <div className="grid gap-4 xl:grid-cols-2">
      {phaseState.paddockEvents.some((e) => e.isRequiredDecision && e.resolvedOptionId && !e.characterRequest && !e.characterDispute && !e.characterInitiative && !e.characterBreakingPoint) && (
        <Panel title="Resolved Decisions">
          <ul className="space-y-2">
            {phaseState.paddockEvents
              .filter((e) => e.isRequiredDecision && e.resolvedOptionId && !e.characterRequest && !e.characterDispute && !e.characterInitiative && !e.characterBreakingPoint)
              .map((event) => {
                const option = event.options?.find((o) => o.id === event.resolvedOptionId);
                return (
                  <li key={event.id} className="flex items-center gap-2 text-sm text-neutral-400">
                    <span className="text-green-400">✓</span>
                    <span className="text-neutral-200">{event.title}</span>
                    <span className="text-neutral-500">— {option?.label}</span>
                  </li>
                );
              })}
          </ul>
        </Panel>
      )}

      {advisorDebrief.length > 0 && (
        <Panel title="Advisor Debrief">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {advisorDebrief.map((recommendation) => (
              <div key={recommendation.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-neutral-100">
                    {recommendation.advisorName ?? ADVISOR_ROLE_LABELS[recommendation.advisorRole]}
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    recommendation.status === 'Accepted'
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'bg-orange-500/10 text-orange-300'
                  }`}>
                    {recommendation.status}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-neutral-400">{recommendation.resolutionNote}</div>
                <div className={`mt-2 text-[10px] font-semibold ${advisorDebriefToneClass(recommendation)}`}>
                  {advisorDebriefRead(recommendation)}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {resolvedDecisions.length === 0 && advisorDebrief.length === 0 && (
        <Panel title="Decision Debrief"><p className="text-sm text-neutral-500">Decision outcomes and advisor reactions will appear here.</p></Panel>
      )}
      </div>}

      {/* Hub Sections */}
      {activeTab === 'updates' && <div className="space-y-4">
        {populatedCategories.length > 0 ? <>
          <div className="flex flex-wrap gap-1">
            {populatedCategories.map((category) => (
              <button key={category} type="button" onClick={() => setUpdateCategory(category)} className={`rounded px-2.5 py-1.5 text-[11px] font-semibold ${visibleUpdateCategory === category ? 'bg-[var(--era-accent)] text-neutral-950' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'}`}>
                {CATEGORY_LABELS[category]} ({eventsByCategory[category]?.length ?? 0})
              </button>
            ))}
          </div>
          <HubSection title={CATEGORY_LABELS[visibleUpdateCategory]} events={eventsByCategory[visibleUpdateCategory] ?? []} />
        </> : <Panel title="Team Updates"><p className="text-sm text-neutral-500">No major updates this week.</p></Panel>}
      </div>}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function HubSection({ title, events }: { title: string; events: PaddockEvent[] }) {
  return (
    <Panel title={title}>
      {events.length === 0 ? (
        <p className="text-sm text-neutral-500">No major updates this week.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="border-l-2 border-neutral-700 pl-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold uppercase ${SEVERITY_COLORS[event.severity]}`}>
                  {event.severity}
                </span>
                {event.isRequiredDecision && !event.resolvedOptionId && (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-semibold text-amber-400">
                    Decision Required
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-neutral-200">{event.title}</div>
              <div className="mt-0.5 text-sm text-neutral-400">{event.description}</div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function CharacterDecisionCard({
  state,
  event,
  focused,
  recommendations,
  onResolve,
}: {
  state: GameState;
  event: PaddockEvent;
  focused: boolean;
  recommendations: AdvisorRecommendation[];
  onResolve: (optionId: string) => void;
}) {
  const character = event.characterRequest;
  if (!character) return null;
  const driver = character.targetType === 'Driver'
    ? state.drivers.find((candidate) => candidate.id === character.targetId)
    : undefined;
  const staff = character.targetType === 'Staff'
    ? (state.staff ?? []).find((candidate) => candidate.id === character.targetId)
    : undefined;
  return (
    <div data-paddock-event-id={event.id} className={`rounded-xl border border-violet-800/60 bg-violet-950/10 p-3 ${focused ? 'ring-2 ring-[var(--era-accent-strong)]' : ''}`}>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-violet-900/50 pb-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300">{character.requestKind.replace(/([a-z])([A-Z])/g, '$1 $2')}</div>
          <div className="text-sm font-semibold text-neutral-100">{character.targetName}</div>
        </div>
        {driver && <DriverDossierButton state={state} subject={{ type: 'driver', driver }} context="Paddock Week request">Open Driver Card</DriverDossierButton>}
        {staff && <CharacterDossierButton state={state} subject={{ type: 'staff', staff }}>Open Character Card</CharacterDossierButton>}
        {character.targetType === 'Owner' && character.teamId && <CharacterDossierButton state={state} subject={{ type: 'owner', teamId: character.teamId }}>Open Character Card</CharacterDossierButton>}
        {character.targetType === 'RivalPrincipal' && character.teamId && <CharacterDossierButton state={state} subject={{ type: 'aiPrincipal', teamId: character.teamId }}>Open Character Card</CharacterDossierButton>}
      </div>
      <DecisionCard focused={focused} state={state} event={event} recommendations={recommendations} onResolve={onResolve} />
    </div>
  );
}

function CharacterInitiativeCard({
  state,
  event,
  focused,
  recommendations,
  onResolve,
}: {
  state: GameState;
  event: PaddockEvent;
  focused: boolean;
  recommendations: AdvisorRecommendation[];
  onResolve: (optionId: string) => void;
}) {
  const target = event.characterInitiative?.target;
  if (!target) return null;
  const driver = target.type === 'Driver' ? state.drivers.find((candidate) => candidate.id === target.id) : undefined;
  const staff = target.type === 'Staff' ? (state.staff ?? []).find((candidate) => candidate.id === target.id) : undefined;
  return (
    <div data-paddock-event-id={event.id} className={`rounded-xl border border-fuchsia-900/60 bg-fuchsia-950/10 p-3 ${focused ? 'ring-2 ring-[var(--era-accent-strong)]' : ''}`}>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-fuchsia-900/50 pb-2">
        <div><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fuchsia-300">Autonomous initiative</div><div className="text-sm font-semibold text-neutral-100">{target.name}</div></div>
        {driver && <DriverDossierButton state={state} subject={{ type: 'driver', driver }} context="Paddock Week initiative">Open Driver Card</DriverDossierButton>}
        {staff && <CharacterDossierButton state={state} subject={{ type: 'staff', staff }}>Open Character Card</CharacterDossierButton>}
        {target.type === 'Owner' && target.teamId && <CharacterDossierButton state={state} subject={{ type: 'owner', teamId: target.teamId }}>Open Character Card</CharacterDossierButton>}
        {target.type === 'RivalPrincipal' && target.teamId && <CharacterDossierButton state={state} subject={{ type: 'aiPrincipal', teamId: target.teamId }}>Open Character Card</CharacterDossierButton>}
      </div>
      <DecisionCard focused={focused} state={state} event={event} recommendations={recommendations} onResolve={onResolve} />
    </div>
  );
}

function DecisionCard({
  state,
  event,
  focused,
  recommendations,
  onResolve,
}: {
  state: GameState;
  event: PaddockEvent;
  focused: boolean;
  recommendations: AdvisorRecommendation[];
  onResolve: (optionId: string) => void;
}) {
  const disagreement = hasAdvisorDisagreement(recommendations);
  const stakeholders = relationshipStakeholdersForDecision(state, event);
  return (
    <div data-paddock-event-id={event.id} className={`rounded-lg border border-amber-600/30 bg-amber-500/5 p-4 ${focused ? 'ring-2 ring-[var(--era-accent-strong)]' : ''}`}>
      <div className="text-sm font-semibold text-amber-300">{event.title}</div>
      <p className="mt-1 text-sm text-neutral-300">{event.description}</p>
      {stakeholders.length > 0 && (
        <div className="mt-3 rounded-lg border border-violet-800/50 bg-violet-950/15 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-violet-300">Relationship stakes</div>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {stakeholders.map((profile) => (
              <div key={`${profile.target.type}:${profile.target.id}`} className="rounded border border-neutral-800 bg-neutral-950/35 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-neutral-100">{profile.target.name}</div>
                    <div className="text-[10px] text-neutral-500">
                      {relationshipTargetLabel(profile.target.type)} · Authority #{profile.authorityRank} · Influence {profile.influence}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    profile.status === 'MustActNow'
                      ? 'bg-red-500/15 text-red-300'
                      : profile.status === 'WatchClosely'
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-emerald-500/10 text-emerald-300'
                  }`}>
                    {relationshipStatusLabel(profile.status)}
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-neutral-400">{profile.reasons[0]}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-neutral-500">
            Authority is permanent; the attention status explains why this decision can temporarily move the relationship up your queue.
          </p>
        </div>
      )}
      {recommendations.length > 0 && (
        <div className="mt-3 rounded-lg border border-sky-800/60 bg-sky-950/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-300">Advisor Council</div>
            {disagreement && (
              <span className="rounded bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-300">
                Internal disagreement
              </span>
            )}
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-3">
            {recommendations.map((recommendation) => (
              <AdvisorCard key={recommendation.id} recommendation={recommendation} />
            ))}
          </div>
          <p className="mt-2 text-[10px] text-neutral-500">
            Advisor recommendations are directional reads. The room's reaction can shape confidence and alignment after the decision settles.
          </p>
        </div>
      )}
      {event.options && event.options.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {event.options.map((option) => (
            <DecisionOptionButton
              key={option.id}
              event={event}
              option={option}
              recommendations={recommendations}
              onResolve={onResolve}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdvisorCard({ recommendation }: { recommendation: AdvisorRecommendation }) {
  const confidenceTone = recommendation.confidence >= 75
    ? 'text-emerald-300'
    : recommendation.confidence >= 55 ? 'text-[var(--era-accent-strong)]' : 'text-neutral-400';
  return (
    <div className="rounded border border-[var(--era-accent)]/35 bg-neutral-950/40 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-neutral-100">
            {recommendation.advisorName ?? ADVISOR_ROLE_LABELS[recommendation.advisorRole]}
          </div>
          <div className="text-[10px] text-neutral-500">{ADVISOR_ROLE_LABELS[recommendation.advisorRole]}</div>
        </div>
        <div className={`text-[10px] font-semibold ${confidenceTone}`}>{recommendation.confidence}%</div>
      </div>
      <div className="mt-2 text-xs font-semibold text-[var(--era-accent-strong)]">Recommends: {recommendation.recommendation}</div>
      <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{recommendation.rationale}</p>
    </div>
  );
}

function advisorDebriefRead(recommendation: AdvisorRecommendation): string {
  if (recommendation.status === 'Accepted') return 'Department confidence may steady after being heard.';
  if ((recommendation.trustChange ?? 0) < 0) return 'Some internal trust may need rebuilding after this call.';
  return 'Advisor reaction looks contained, but worth watching.';
}

function advisorDebriefToneClass(recommendation: AdvisorRecommendation): string {
  if (recommendation.status === 'Accepted') return 'text-emerald-400';
  if ((recommendation.trustChange ?? 0) < 0) return 'text-orange-300';
  return 'text-neutral-400';
}

function DecisionOptionButton({
  event,
  option,
  recommendations,
  onResolve,
}: {
  event: PaddockEvent;
  option: NonNullable<PaddockEvent['options']>[number];
  recommendations: AdvisorRecommendation[];
  onResolve: (optionId: string) => void;
}) {
  const preview = leadershipDecisionPreview(event, option);
  const councilRead = advisorCouncilReadForOption(recommendations, option.id);
  const councilToneClass = councilRead.tone === 'positive'
    ? 'text-emerald-400'
    : councilRead.tone === 'warning' ? 'text-red-400' : 'text-amber-300';
  return (
    <button
      onClick={() => onResolve(option.id)}
      className="rounded-lg border border-neutral-700 bg-neutral-900/60 p-3 text-left transition-colors hover:border-amber-500 hover:bg-amber-500/10"
    >
      <div className="text-sm font-semibold text-neutral-100">{option.label}</div>
      <div className="mt-0.5 text-xs text-neutral-400">{option.description}</div>
      <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
        +{preview.xp} {preview.identityLabel}
      </div>
      {preview.cultureChanges.length > 0 && (
        <div className="mt-0.5 text-[10px] text-neutral-500">{preview.cultureChanges.join(' · ')}</div>
      )}
      {recommendations.length > 0 && (
        <div className="mt-2 border-t border-neutral-800 pt-2 text-[10px] text-neutral-400">
          <div className={`font-semibold ${councilToneClass}`}>{councilRead.label}</div>
          <div className="mt-0.5 leading-relaxed">{councilRead.read}</div>
          <div className="mt-0.5 leading-relaxed text-neutral-500">{councilRead.watch}</div>
        </div>
      )}
    </button>
  );
}
