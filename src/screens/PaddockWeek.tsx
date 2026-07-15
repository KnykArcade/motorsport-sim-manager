import { useEffect, useMemo } from 'react';
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

export function PaddockWeek() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();

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
      if (e.narrativeStoryId) continue;
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

      {/* Paddock News */}
      <div className="grid gap-4 lg:grid-cols-2">
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
      </div>

      {/* Required Decisions */}
      {(unresolvedCount > 0 || !packageSelected) && (
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
              .filter((e) => e.isRequiredDecision && !e.resolvedOptionId)
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

      {/* Resolved Decisions */}
      {phaseState.paddockEvents.some((e) => e.isRequiredDecision && e.resolvedOptionId) && (
        <Panel title="Resolved Decisions">
          <ul className="space-y-2">
            {phaseState.paddockEvents
              .filter((e) => e.isRequiredDecision && e.resolvedOptionId)
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

      {/* Hub Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {CATEGORY_ORDER.map((category) => {
          const events = eventsByCategory[category] ?? [];
          return (
            <HubSection
              key={category}
              title={CATEGORY_LABELS[category]}
              events={events}
            />
          );
        })}
      </div>
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
