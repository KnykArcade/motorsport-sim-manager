import type { GameState } from '../game/careerState';
import { getCareerPhase } from '../game/careerPhaseEngine';
import type { CareerPhase } from '../types/careerPhaseTypes';
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
        to: '/briefing',
        label: 'Review Race Briefing',
        context: 'Race briefing',
        phase,
        blocked: false,
        blockerCount: 0,
        reason: 'Confirm the race plan and enter the weekend.',
      };
    case 'race_weekend':
      return {
        to: '/weekend',
        label: 'Continue Race Weekend',
        context: 'Race weekend',
        phase,
        blocked: false,
        blockerCount: 0,
        reason: 'Complete the current weekend stage; recommendations remain available.',
      };
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
  return state.lastWorkspace && isResumableWorkspace(state.lastWorkspace)
    ? state.lastWorkspace
    : workflowDestination(state).to;
}
