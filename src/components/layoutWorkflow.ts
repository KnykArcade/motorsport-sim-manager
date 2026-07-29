import { currentRace, type GameState } from '../game/careerState';
import { careerLaunchState, getCareerPhase, needsCareerLaunch } from '../game/careerPhaseEngine';
import { canEnterRaceWeekend } from '../game/rosterEnforcement';
import type { CareerPhase } from '../types/careerPhaseTypes';
import { inboxMessages } from '../screens/inboxViewModel';
import { paddockEventDestination } from '../screens/paddockAgendaViewModel';
import { routeAccessForState, routeDefinitionForPath } from '../app/routeCatalog';

export type WorkflowDestination = {
  to: string;
  label: string;
  context: string;
  phase: CareerPhase | 'season_complete';
  priority: 'first_day' | 'must_respond' | 'race_lineup' | 'race_workflow';
  blocked: boolean;
  blockerCount: number;
  reason: string;
};

function requiredInboxDestination(state: GameState): {
  id: string;
  title: string;
  count: number;
} | undefined {
  const requiredPaddockEvents = (state.careerPhase?.paddockEvents ?? []).filter(
    (event) => event.isRequiredDecision && !event.resolvedOptionId,
  );
  if (requiredPaddockEvents.length > 0) {
    return {
      id: `inbox-paddock-${requiredPaddockEvents[0].id}`,
      title: requiredPaddockEvents[0].title,
      count: requiredPaddockEvents.length,
    };
  }

  const hasCompleteCoreState = Array.isArray(state.teams)
    && Array.isArray(state.drivers)
    && Array.isArray(state.cars)
    && Array.isArray(state.news)
    && Array.isArray(state.calendar);
  if (!hasCompleteCoreState) return undefined;

  const blocking = inboxMessages(state).filter((message) => message.blocking);
  return blocking[0]
    ? { id: blocking[0].id, title: blocking[0].title, count: blocking.length }
    : undefined;
}

function hasMissingRaceLineup(state: GameState): boolean {
  if (state.seasonComplete) return false;
  if (!Array.isArray(state.drivers) || !Array.isArray(state.teams)) return false;
  return !canEnterRaceWeekend(state).allowed;
}

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
      priority: 'first_day',
      blocked: false,
      blockerCount: 0,
      reason: 'Complete the appointment and team handover before beginning preseason work.',
    };
  }

  const requiredInbox = requiredInboxDestination(state);
  if (requiredInbox) {
    return {
      to: `/inbox?section=must_respond&message=${encodeURIComponent(requiredInbox.id)}`,
      label: 'Respond in Inbox',
      context: 'Must respond',
      phase: getCareerPhase(state),
      priority: 'must_respond',
      blocked: true,
      blockerCount: requiredInbox.count,
      reason: `${requiredInbox.title} must be resolved before the career can advance.`,
    };
  }

  if (state.seasonComplete) {
    return {
      to: '/season-review',
      label: 'Open Season Review',
      context: 'Season complete',
      phase: 'season_complete',
      priority: 'race_workflow',
      blocked: false,
      blockerCount: 0,
      reason: 'Review the season and prepare the next chapter.',
    };
  }

  const phase = getCareerPhase(state);
  if (hasMissingRaceLineup(state)) {
    return {
      to: '/market',
      label: 'Complete Race Lineup',
      context: 'Race entry',
      phase,
      priority: 'race_lineup',
      blocked: true,
      blockerCount: 1,
      reason: canEnterRaceWeekend(state).reason ?? 'Fill every required race seat before continuing.',
    };
  }

  switch (phase) {
    case 'pre_season_setup':
      return {
        to: '/preseason',
        label: 'Open Preseason Review',
        context: 'Preseason setup',
        phase,
        priority: 'race_workflow',
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
          priority: 'race_workflow',
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
        priority: 'race_workflow',
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
        priority: 'race_workflow',
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
          priority: 'race_workflow',
          blocked: false,
          blockerCount: 0,
          reason: 'Review what changed, then open the next weekly agenda.',
        }
        : {
          to: '/hq',
          label: 'Open Manager Office',
          context: 'Post-race review',
          phase,
          priority: 'race_workflow',
          blocked: false,
          blockerCount: 0,
          reason: 'Review the current career situation.',
        };
    }
  }
}

export function isResumableWorkspace(workspace: string, state?: GameState): boolean {
  const pathname = workspace.split('?')[0];
  const definition = routeDefinitionForPath(pathname);
  if (!definition?.resumable) return false;
  return state ? routeAccessForState(pathname, state).available : true;
}

export function resumeDestination(state: GameState): string {
  const nextAction = workflowDestination(state);
  if (nextAction.priority !== 'race_workflow') return nextAction.to;
  return state.lastWorkspace && isResumableWorkspace(state.lastWorkspace, state)
    ? state.lastWorkspace
    : nextAction.to;
}
