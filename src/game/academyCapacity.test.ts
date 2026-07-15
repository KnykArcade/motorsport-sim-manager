import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import { gameReducer } from './gameReducer';
import { calculateAcademyCapacity } from '../sim/teamRatingsEngine';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import type { GameState } from './careerState';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';

function newGame(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'academy-cap-seed',
  });
}

function withCapacity(state: GameState, capacityOverall: number): GameState {
  const r: TeamOrganizationRatings = {
    ...(state.teamOrgRatings?.[state.selectedTeamId] as TeamOrganizationRatings),
    overallTeamRating: capacityOverall,
    youthAcademy: 50,
    facilities: 50,
  };
  // Ensure budget never gates the signing in these capacity tests.
  const teams = state.teams.map((t) =>
    t.id === state.selectedTeamId ? { ...t, budget: 1_000_000_000 } : t,
  );
  return {
    ...state,
    teams,
    teamOrgRatings: { ...state.teamOrgRatings, [state.selectedTeamId]: r },
  };
}

describe('academy capacity enforcement', () => {
  it('seeds organization ratings for every team on a new game', () => {
    const state = newGame();
    expect(state.teamOrgRatings).toBeDefined();
    for (const team of state.teams) {
      const r = state.teamOrgRatings![team.id];
      expect(r).toBeDefined();
      const cap = calculateAcademyCapacity(r);
      expect(cap).toBeGreaterThanOrEqual(1);
      expect(cap).toBeLessThanOrEqual(4);
    }
  });

  it('blocks signing youth beyond the academy capacity', () => {
    // Force a single-slot academy.
    let state = withCapacity(newGame(), 30);
    expect(calculateAcademyCapacity(state.teamOrgRatings![state.selectedTeamId])).toBe(1);

    const youth = careerMarketBundle(state).youth;
    state = gameReducer(state, { type: 'SIGN_YOUTH', youthId: youth[0].id })!;
    expect((state.academy ?? []).length).toBe(1);

    // A second signing should be rejected (capacity is 1).
    const after = gameReducer(state, { type: 'SIGN_YOUTH', youthId: youth[1].id })!;
    expect((after.academy ?? []).length).toBe(1);
  });

  it('allows signing up to a larger capacity', () => {
    let state = withCapacity(newGame(), 85); // 4 slots
    expect(calculateAcademyCapacity(state.teamOrgRatings![state.selectedTeamId])).toBe(4);
    const youth = careerMarketBundle(state).youth;
    for (let i = 0; i < 3; i++) {
      state = gameReducer(state, { type: 'SIGN_YOUTH', youthId: youth[i].id })!;
    }
    expect((state.academy ?? []).length).toBe(3);
  });
});
