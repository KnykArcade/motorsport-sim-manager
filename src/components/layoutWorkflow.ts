import { currentRace, type GameState } from '../game/careerState';
import { careerLaunchState, getCareerPhase, needsCareerLaunch } from '../game/careerPhaseEngine';
import type { CareerPhase } from '../types/careerPhaseTypes';
import { inboxMessages } from '../screens/inboxViewModel';
import { paddockEventDestination } from '../screens/paddockAgendaViewModel';

export type WorkflowDestination = {
  to: string;
  label: string;
  context: string;
  phase: CareerPhase | 'season_complete';
  blocked: boolean;
  blockerCount: number;
  reason: string;
};

/**
 * The global Continue control routes to the next meaningful workspace or
 * exact unresolved item. Phase changes remain owned by their workflow screens.
 */
export function workflowDestination(state: GameState): WorkflowDestination {
  if (needsCareerLaunch(state)) {
    const launch = careerLaunchState(state);
    const labels = {
      appointment: 'Review Appointment',
      teamHandover: 'Review Team Handover',
      ownerIntroduction: 'Meet the Owner',
      firstWeekPlan: 'Start First Week',
    } as const;
    return {
      to: '/career-launch',
      label: launch ? labels[launch.currentStep] : 'Open First Day',
      context: 'First day',
      phase: 'pre_season_setup',
      blocked: false,
      blockerCount: 0,
      reason: 'Complete the appointment and team handover before beginning preseason work.',
    };
  }

  if (state.seasonComplete) {
    return {
      to: '/season-review',
      label: 'Open Season Review',
      context: 'Season complete',
      phase: 'season_complete',
      blocked: false,
      blockerCount: 0,
      reason: 'Review the season and prepare the next chapter.',
    };
  }

  const phase = getCareerPhase(state);
  switch (phase) {
    case 'pre_season_setup':
      return {
        to: '/preseason',
        label: 'Open Preseason Review',
        context: 'Preseason setup',
        phase,
        blocked: false,
        blockerCount: 0,
        reason: 'Complete the preseason reviews before entering the first race briefing.',
      };
    case 'paddock_week':
      {
        const unresolvedRequiredDecisions = (state.careerPhase?.paddockEvents ?? []).filter(
          (event) => event.isRequiredDecision && !event.resolvedOptionId,
        );
        const firstRequiredDecision = unresolvedRequiredDecisions[0];
        const destination = firstRequiredDecision
          ? paddockEventDestination(firstRequiredDecision)
          : undefined;
        return {
          to: destination?.route ?? '/paddock',
          label: destination?.routeLabel ?? 'Review Paddock Week',
          context: 'Paddock week',
          phase,
          blocked: unresolvedRequiredDecisions.length > 0,
          blockerCount: unresolvedRequiredDecisions.length,
          reason: unresolvedRequiredDecisions.length > 0
            ? `Resolve ${unresolvedRequiredDecisions.length} required paddock decision${unresolvedRequiredDecisions.length === 1 ? '' : 's'} before the next race briefing.`
            : 'Review the week and choose the race package before briefing.',
        };
      }
    case 'pre_race_briefing':
      return {
        to: '/briefing?tab=preparation',
        label: 'Set Preparation Focus',
        context: 'Race preparation',
        phase,
        blocked: false,
        blockerCount: 0,
        reason: 'Confirm the race preparation focus, then enter the weekend.',
      };
    case 'race_weekend': {
      const race = Array.isArray(state.calendar) ? currentRace(state) : undefined;
      const qualifyingComplete = !!(race && state.qualifyingResults?.[race.id]);
      const planConfirmed = !!(race && state.weekendPlans?.some((plan) => plan.raceId === race.id));
      const practiceStarted = !!(
        race
        && state.weekendPractice?.raceId === race.id
        && state.weekendPractice.sessions?.some((session) => session.completed)
      );
      const stage = planConfirmed
        ? 'race-plan'
        : qualifyingComplete
          ? 'qualifying'
          : practiceStarted
            ? 'practice-setup'
            : 'overview';
      const detail = stage === 'race-plan'
        ? {
          label: 'Complete Race Plan',
          context: 'Race plan',
          reason: 'Finish leadership preparation and start the race.',
        }
        : stage === 'qualifying'
          ? {
            label: 'Review Qualifying',
            context: 'Qualifying',
            reason: 'Review the grid, finalise the setup, and prepare the race plan.',
          }
          : stage === 'practice-setup'
            ? {
              label: 'Continue Practice & Setup',
              context: 'Practice and setup',
              reason: 'Resume the active engineering work without repeating the overview.',
            }
            : {
              label: 'Open Weekend Overview',
              context: 'Race weekend',
              reason: 'Review staff advice and begin the weekend programme.',
            };
      return {
        to: `/weekend?stage=${stage}`,
        label: detail.label,
        context: detail.context,
        phase,
        blocked: false,
        blockerCount: 0,
        reason: detail.reason,
      };
    }
    case 'post_race_review': {
      const raceId = state.careerPhase?.lastCompletedRaceId;
      return raceId
        ? {
          to: `/post-race/${raceId}`,
          label: 'Review Race Debrief',
          context: 'Post-race review',
          phase,
          blocked: false,
          blockerCount: 0,
          reason: 'Review what changed, then open the next weekly agenda.',
        }
        : {
          to: '/hq',
          label: 'Open Manager Office',
          context: 'Post-race review',
          phase,
          blocked: false,
          blockerCount: 0,
          reason: 'Review the current career situation.',
        };
    }
  }
}

const RESUMABLE_WORKSPACE_PREFIXES = [
  '/hq',
  '/career-launch',
  '/inbox',
  '/preseason',
  '/paddock',
  '/briefing',
  '/weekend',
  '/post-race/',
  '/technical',
  '/drivers',
  '/market',
  '/scouting',
  '/finance',
  '/sponsors',
  '/staff',
  '/principal',
  '/relationships',
  '/rivals',
  '/stories',
  '/politics',
  '/calendar',
  '/standings',
  '/news',
  '/history',
  '/records',
];

export function isResumableWorkspace(workspace: string): boolean {
  const pathname = workspace.split('?')[0];
  return RESUMABLE_WORKSPACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

export function resumeDestination(state: GameState): string {
  if (needsCareerLaunch(state)) return '/career-launch';
  if (
    Array.isArray(state.teams)
    && Array.isArray(state.drivers)
    && Array.isArray(state.news)
    && Array.isArray(state.calendar)
  ) {
    const blockingMessage = inboxMessages(state).find((message) => message.blocking);
    if (blockingMessage) {
      return `/inbox?section=must_respond&message=${encodeURIComponent(blockingMessage.id)}`;
    }
  }
  return state.lastWorkspace && isResumableWorkspace(state.lastWorkspace)
    ? state.lastWorkspace
    : workflowDestination(state).to;
}
