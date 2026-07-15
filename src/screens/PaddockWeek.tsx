import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { CharacterDossierButton } from '../components/characterCards/CharacterDossier';
import { DriverDossierButton } from '../components/driverCards/DriverDossier';
import { internalCharacterInfluence } from '../sim/characterInfluenceEngine';

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
  minor: 'text-blue-400',
  major: 'text-orange-400',
  critical: 'text-red-400',
};

const INFLUENCE_STANCE_COLORS = {
  Champion: 'bg-emerald-500/10 text-emerald-300',
  Supportive: 'bg-sky-500/10 text-sky-300',
  Neutral: 'bg-neutral-800 text-neutral-300',
  Resistant: 'bg-amber-500/10 text-amber-300',
  Obstructive: 'bg-red-500/10 text-red-300',
} as const;

type PaddockTab = 'overview' | 'people' | 'decisions' | 'updates' | 'debrief';

export function PaddockWeek() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [tab, setTab] = useState<PaddockTab>('people');
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
      if (e.narrativeStoryId || e.characterRequest || e.characterDispute) continue;
      if (!map[e.category]) map[e.category] = [];
      map[e.category].push(e);
    }
    return map;
  }, [phaseState]);

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
  const nonCharacterUnresolved = phaseState.paddockEvents.filter(
    (event) => event.isRequiredDecision && !event.resolvedOptionId && !event.characterRequest && !event.characterDispute,
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
  const resolvedDecisions = phaseState.paddockEvents.filter((event) => !!event.resolvedOptionId && !event.characterRequest && !event.characterDispute);
  const populatedCategories = CATEGORY_ORDER.filter((category) => (eventsByCategory[category]?.length ?? 0) > 0);
  const visibleUpdateCategory = populatedCategories.includes(updateCategory)
    ? updateCategory
    : populatedCategories[0] ?? 'next_race';
  const updateCount = populatedCategories.reduce((total, category) => total + (eventsByCategory[category]?.length ?? 0), 0);
  const internalInfluence = internalCharacterInfluence(state).slice(0, 8);

  const advanceToBriefing = () => {
    dispatch({ type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
    navigate('/briefing');
  };

  return (
    <div className="era-feature-screen era-paddock-week space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Paddock Week</h1>
          <p className="text-sm text-neutral-400">
            {state.seasonYear} {state.series} · Between Rounds {phaseState.currentRound} & {phaseState.currentRound + 1}
            {' · ' + getGameModeLabel(state.gameMode)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="text-sm text-orange-400">
              {pendingCount} required decision{pendingCount > 1 ? 's' : ''} pending
            </span>
          )}
          <Button
            variant="primary"
            onClick={advanceToBriefing}
            disabled={!canAdvance}
            title={canAdvance ? 'Advance to Pre-Race Briefing' : 'Resolve required decisions and select a race package first'}
          >
            Advance to Pre-Race Briefing →
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Budget" value={team ? formatMoney(team.budget) : '—'} />
        <KpiCard label="Team Morale" value={`${Math.round(team?.morale ?? 0)}%`} />
        <KpiCard label="Car Condition" value={`${Math.round(car?.condition ?? 0)}%`} />
        <KpiCard label="Dev Slots" value={`${state.activeDevelopmentProjects.length}/${slots}`} />
        <KpiCard label="Active Drivers" value={`${activeDrivers.length}/2`} />
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-1" aria-label="Paddock Week sections">
        <PaddockTabButton active={tab === 'overview'} onClick={() => setTab('overview')} label="Overview" />
        <PaddockTabButton active={tab === 'people'} onClick={() => setTab('people')} label="People" count={characterRequests.length + characterDisputes.length} attention={[...unresolvedCharacterRequests, ...unresolvedCharacterDisputes].some((event) => event.isRequiredDecision)} />
        <PaddockTabButton active={tab === 'decisions'} onClick={() => setTab('decisions')} label="Operations" count={nonCharacterUnresolved.length + (packageSelected ? 0 : 1) + storyDecisions.length} attention={nonCharacterUnresolved.length > 0 || !packageSelected} />
        <PaddockTabButton active={tab === 'updates'} onClick={() => setTab('updates')} label="Team Updates" count={updateCount} />
        <PaddockTabButton active={tab === 'debrief'} onClick={() => setTab('debrief')} label="Decision Debrief" count={resolvedDecisions.length} />
      </div>

      {/* Paddock News */}
      {tab === 'overview' && <div className="grid gap-4 lg:grid-cols-2">
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

      {tab === 'people' && <div className="space-y-4">
        {internalInfluence.length > 0 && (
          <Panel title="Internal Support Map">
            <p className="mb-3 text-xs text-neutral-500">Power shows how much leverage a person has. Support shows whether they are helping or resisting your leadership; that stance now applies a small weekly effect to their driver, department, or ownership relationship.</p>
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
                    <div className="rounded bg-neutral-950/70 px-1.5 py-1 text-neutral-500">Power <strong className="text-neutral-200">{profile.power}</strong></div>
                    <div className="rounded bg-neutral-950/70 px-1.5 py-1 text-neutral-500">Support <strong className="text-neutral-200">{profile.support > 0 ? '+' : ''}{profile.support}</strong></div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-neutral-400">{profile.effectLabel}</p>
                </article>
              ))}
            </div>
          </Panel>
        )}
        {unresolvedCharacterDisputes.length > 0 && (
          <Panel title="Conflicts Requiring Management" className="border-red-700/30">
            <p className="mb-3 text-xs text-neutral-500">Persistent tensions can become active disputes. Your intervention affects both people, their connection, and the camps around them.</p>
            <div className="grid gap-3 xl:grid-cols-2">
              {unresolvedCharacterDisputes.map((event) => (
                <div key={event.id} className="rounded-xl border border-red-900/60 bg-red-950/10 p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-red-300">Character dispute · {event.characterDispute?.characterA.name} vs {event.characterDispute?.characterB.name}</div>
                  <DecisionCard event={event} recommendations={advisorRecommendationsForDecision(state, event.id)} onResolve={(optionId) => dispatch({ type: 'RESOLVE_PADDOCK_EVENT', eventId: event.id, optionId })} />
                </div>
              ))}
            </div>
          </Panel>
        )}
        {unresolvedCharacterRequests.length > 0 && (
          <Panel title="Conversations Waiting for You" className="border-violet-600/30">
            <p className="mb-3 text-xs text-neutral-500">Characters can now bring their own concerns, requests, and political approaches to you. Required conversations must be answered before the week can advance.</p>
            <div className="grid gap-3 xl:grid-cols-2">
              {unresolvedCharacterRequests.map((event) => (
                <CharacterDecisionCard
                  key={event.id}
                  state={state}
                  event={event}
                  recommendations={advisorRecommendationsForDecision(state, event.id)}
                  onResolve={(optionId) => dispatch({ type: 'RESOLVE_PADDOCK_EVENT', eventId: event.id, optionId })}
                />
              ))}
            </div>
          </Panel>
        )}
        {resolvedCharacterRequests.length > 0 && (
          <Panel title="This Week's People Decisions">
            <div className="grid gap-3 xl:grid-cols-2">
              {resolvedCharacterRequests.map((event) => {
                const record = state.characterInteractions?.requestHistory.find((entry) => entry.eventId === event.id);
                return <article key={event.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3"><div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold text-neutral-200">{event.characterRequest?.targetName}</div><span className="rounded bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-300">Resolved</span></div><div className="mt-1 text-xs font-semibold text-amber-300">{record?.optionLabel ?? event.options?.find((option) => option.id === event.resolvedOptionId)?.label}</div><p className="mt-1 text-xs leading-relaxed text-neutral-400">{record?.outcome ?? event.description}</p>{record?.effects.length ? <div className="mt-2 flex flex-wrap gap-1">{record.effects.map((effect) => <span key={effect} className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-300">{effect}</span>)}</div> : null}</article>;
              })}
            </div>
          </Panel>
        )}
        {resolvedCharacterDisputes.length > 0 && <Panel title="Disputes Addressed This Week"><div className="grid gap-3 xl:grid-cols-2">{resolvedCharacterDisputes.map((event) => <article key={event.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-neutral-200">{event.characterDispute?.characterA.name} / {event.characterDispute?.characterB.name}</strong><span className="rounded bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-300">Addressed</span></div><div className="mt-1 text-xs font-semibold text-amber-300">{event.options?.find((option) => option.id === event.resolvedOptionId)?.label}</div><p className="mt-1 text-xs text-neutral-400">The decision is now part of both characters' persistent history.</p></article>)}</div></Panel>}
        {characterRequests.length === 0 && characterDisputes.length === 0 && internalInfluence.length === 0 && <Panel title="People"><p className="text-sm text-neutral-500">No character needs your attention this week.</p></Panel>}
      </div>}

      {/* Required Decisions */}
      {tab === 'decisions' && <>
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
              .filter((e) => e.isRequiredDecision && !e.resolvedOptionId && !e.characterRequest && !e.characterDispute)
              .map((event) => (
                <DecisionCard
                  key={event.id}
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
      {tab === 'debrief' && <div className="grid gap-4 xl:grid-cols-2">
      {phaseState.paddockEvents.some((e) => e.isRequiredDecision && e.resolvedOptionId && !e.characterRequest && !e.characterDispute) && (
        <Panel title="Resolved Decisions">
          <ul className="space-y-2">
            {phaseState.paddockEvents
              .filter((e) => e.isRequiredDecision && e.resolvedOptionId && !e.characterRequest && !e.characterDispute)
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
                <div className={`mt-2 text-[10px] font-semibold ${
                  (recommendation.trustChange ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  Department trust {(recommendation.trustChange ?? 0) > 0 ? '+' : ''}{recommendation.trustChange ?? 0}
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
      {tab === 'updates' && <div className="space-y-4">
        {populatedCategories.length > 0 ? <>
          <div className="flex flex-wrap gap-1">
            {populatedCategories.map((category) => (
              <button key={category} type="button" onClick={() => setUpdateCategory(category)} className={`rounded px-2.5 py-1.5 text-[11px] font-semibold ${visibleUpdateCategory === category ? 'bg-sky-500 text-neutral-950' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'}`}>
                {CATEGORY_LABELS[category]} ({eventsByCategory[category]?.length ?? 0})
              </button>
            ))}
          </div>
          <HubSection title={CATEGORY_LABELS[visibleUpdateCategory]} events={eventsByCategory[visibleUpdateCategory] ?? []} />
        </> : <Panel title="Team Updates"><p className="text-sm text-neutral-500">No major updates this week.</p></Panel>}
      </div>}
    </div>
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
  recommendations,
  onResolve,
}: {
  state: GameState;
  event: PaddockEvent;
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
    <div className="rounded-xl border border-violet-800/60 bg-violet-950/10 p-3">
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
      <DecisionCard event={event} recommendations={recommendations} onResolve={onResolve} />
    </div>
  );
}

function DecisionCard({
  event,
  recommendations,
  onResolve,
}: {
  event: PaddockEvent;
  recommendations: AdvisorRecommendation[];
  onResolve: (optionId: string) => void;
}) {
  const disagreement = hasAdvisorDisagreement(recommendations);
  return (
    <div className="rounded-lg border border-amber-600/30 bg-amber-500/5 p-4">
      <div className="text-sm font-semibold text-amber-300">{event.title}</div>
      <p className="mt-1 text-sm text-neutral-300">{event.description}</p>
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
            Following advice improves department trust and execution. Overruling strong advice can reduce trust and strategic alignment.
          </p>
        </div>
      )}
      {event.options && event.options.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {event.options.map((option) => (
            <DecisionOptionButton key={option.id} event={event} option={option} onResolve={onResolve} />
          ))}
        </div>
      )}
    </div>
  );
}

function AdvisorCard({ recommendation }: { recommendation: AdvisorRecommendation }) {
  const confidenceTone = recommendation.confidence >= 75
    ? 'text-emerald-300'
    : recommendation.confidence >= 55 ? 'text-sky-300' : 'text-neutral-400';
  return (
    <div className="rounded border border-sky-900/60 bg-neutral-950/40 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-neutral-100">
            {recommendation.advisorName ?? ADVISOR_ROLE_LABELS[recommendation.advisorRole]}
          </div>
          <div className="text-[10px] text-neutral-500">{ADVISOR_ROLE_LABELS[recommendation.advisorRole]}</div>
        </div>
        <div className={`text-[10px] font-semibold ${confidenceTone}`}>{recommendation.confidence}%</div>
      </div>
      <div className="mt-2 text-xs font-semibold text-sky-300">Recommends: {recommendation.recommendation}</div>
      <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{recommendation.rationale}</p>
    </div>
  );
}

function DecisionOptionButton({
  event,
  option,
  onResolve,
}: {
  event: PaddockEvent;
  option: NonNullable<PaddockEvent['options']>[number];
  onResolve: (optionId: string) => void;
}) {
  const preview = leadershipDecisionPreview(event, option);
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
    </button>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-neutral-100">{value}</div>
    </div>
  );
}

function PaddockTabButton({
  active,
  onClick,
  label,
  count,
  attention = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  attention?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded px-3 py-2 text-xs font-semibold ${active ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'}`}
    >
      <span>{label}</span>
      {count != null && count > 0 && (
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${active ? 'bg-neutral-950/20 text-neutral-950' : attention ? 'bg-orange-500/20 text-orange-300' : 'bg-neutral-800 text-neutral-300'}`}>
          {count}
        </span>
      )}
    </button>
  );
}
