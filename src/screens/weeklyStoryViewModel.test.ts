import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import type { GameState } from '../game/careerState';
import { buildWeeklyStory } from './weeklyStoryViewModel';

function newState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'weekly-story-test',
  });
}

describe('weeklyStoryViewModel', () => {
  it('returns the previous race as the source of the next paddock agenda', () => {
    const base = newState();
    const state: GameState = {
      ...base,
      careerPhase: {
        ...base.careerPhase!,
        currentPhase: 'paddock_week',
        lastCompletedRaceId: base.calendar[0].id,
        paddockEvents: [],
      },
    };

    const story = buildWeeklyStory(state);
    expect(story).toMatchObject({
      headline: `${base.calendar[0].gpName} follow-up week`,
      raceId: base.calendar[0].id,
    });
    expect(story?.groups.find((group) => group.owner === 'Race review')).toMatchObject({
      items: [{
        route: `/post-race/${base.calendar[0].id}`,
        reason: 'The latest race is the source of this week’s priorities and consequences.',
      }],
    });
  });

  it('does not create a weekly story outside the post-race cadence', () => {
    const state = newState();
    expect(buildWeeklyStory(state)).toBeNull();
  });
});
