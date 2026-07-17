import type { GameState } from '../game/careerState';
import { getCareerPhase } from '../game/careerPhaseEngine';

export type WorkflowDestination = {
  to: string;
  label: string;
  context: string;
};

/**
 * The global Continue control is intentionally navigation-only. Phase changes
 * remain owned by their workflow screens, where required decisions and roster
 * checks can block progression safely.
 */
export function workflowDestination(state: GameState): WorkflowDestination {
  if (state.seasonComplete) {
    return { to: '/season-review', label: 'Season Review', context: 'Season complete' };
  }

  switch (getCareerPhase(state)) {
    case 'pre_season_setup':
      return { to: '/preseason', label: 'Continue', context: 'Preseason setup' };
    case 'paddock_week':
      return { to: '/paddock', label: 'Continue', context: 'Paddock week' };
    case 'pre_race_briefing':
      return { to: '/briefing', label: 'Continue', context: 'Race briefing' };
    case 'race_weekend':
      return { to: '/weekend', label: 'Continue', context: 'Race weekend' };
    case 'post_race_review': {
      const raceId = state.careerPhase?.lastCompletedRaceId;
      return raceId
        ? { to: `/post-race/${raceId}`, label: 'Continue', context: 'Post-race review' }
        : { to: '/hq', label: 'Team HQ', context: 'Post-race review' };
    }
    default:
      return { to: '/hq', label: 'Team HQ', context: 'Team management' };
  }
}
