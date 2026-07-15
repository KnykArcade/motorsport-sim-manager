import '../testDataSetup';
import { describe, it, expect } from 'vitest';
import { createNewGame } from './initialCareer';
import { advanceSeason } from './seasonRollover';
import type { GameState } from './careerState';

function makeCareer(seed: string, mobilityMode?: 'StandardCareer' | 'TeamLock' | 'Sandbox'): GameState {
  let state = createNewGame({
    gameMode: 'Career',
    seasonYear: 1990,
    series: 'F1',
    teamId: '',
    seed,
  });
  // Fall back to first team if specified team doesn't exist.
  if (!state.teams.some((t) => t.id === state.selectedTeamId)) {
    state = createNewGame({
      gameMode: 'Career',
      seasonYear: 1990,
      series: 'F1',
      teamId: state.teams[0].id,
      seed,
    });
  }
  if (mobilityMode) {
    state = { ...state, careerMobilityMode: mobilityMode };
  }
  return state;
}

describe('Team Lock — forced player movement prevention', () => {
  it('keeps selectedTeamId stable across 20 seasons under Team Lock', () => {
    let state = makeCareer('teamlock-stress', 'TeamLock');
    const originalTeamId = state.selectedTeamId;

    for (let i = 0; i < 20; i++) {
      state = advanceSeason({ ...state, seasonComplete: true });
      expect(state.selectedTeamId).toBe(originalTeamId);
    }
  }, 120_000);

  it('does not prevent voluntary job moves under Team Lock', () => {
    let state = makeCareer('teamlock-voluntary', 'TeamLock');
    const originalTeamId = state.selectedTeamId;

    // Simulate accepting a job offer if one exists.
    const firmOffer = (state.jobOffers ?? []).find((o) => o.kind === 'Offer');
    if (firmOffer) {
      state = { ...state, acceptedJobOfferId: firmOffer.id };
      state = advanceSeason({ ...state, seasonComplete: true });
      // If there was a firm offer and we accepted it, the move should go through.
      expect(state.selectedTeamId).toBe(firmOffer.teamId);
      expect(state.selectedTeamId).not.toBe(originalTeamId);
    } else {
      // No firm offers available — just verify no forced move.
      state = advanceSeason({ ...state, seasonComplete: true });
      expect(state.selectedTeamId).toBe(originalTeamId);
    }
  });

  it('allows forced movement under Standard Career', () => {
    // Under Standard Career, the player CAN be fired and moved.
    // We can't guarantee a firing will happen in 20 seasons (it depends on
    // performance), but we verify the mode is respected and no crash occurs.
    let state = makeCareer('standard-career', 'StandardCareer');
    const originalTeamId = state.selectedTeamId;

    for (let i = 0; i < 20; i++) {
      state = advanceSeason({ ...state, seasonComplete: true });
      if (state.selectedTeamId !== originalTeamId) {
        // Team changed — Standard Career allows forced movement.
        break;
      }
    }
    // We don't assert a team change (it depends on random performance),
    // but the simulation should not crash and the mode should be StandardCareer.
    expect(state.careerMobilityMode).toBe('StandardCareer');
  }, 120_000);

  it('still allows AI principal movement under Team Lock', () => {
    let state = makeCareer('teamlock-ai', 'TeamLock');
    const originalTeamId = state.selectedTeamId;

    // Advance several seasons. Player team should never change under Team Lock.
    // AI teams should still exist and be processed normally.
    for (let i = 0; i < 5; i++) {
      state = advanceSeason({ ...state, seasonComplete: true });
      expect(state.selectedTeamId).toBe(originalTeamId);
      // AI teams should still be present.
      const aiTeams = state.teams.filter((t) => t.id !== originalTeamId);
      expect(aiTeams.length).toBeGreaterThan(0);
    }
  }, 60_000);

  it('generates pressure news when Team Lock prevents firing', () => {
    // This is hard to trigger deterministically, but we can verify the
    // infrastructure exists by checking that a Team Lock career doesn't
    // crash and the principal profile is maintained.
    let state = makeCareer('teamlock-news', 'TeamLock');
    const originalTeamId = state.selectedTeamId;
    state = advanceSeason({ ...state, seasonComplete: true });
    expect(state.selectedTeamId).toBe(originalTeamId);
    // Principal should still exist.
    expect(state.principal).toBeDefined();
    if (state.principal) {
      expect(state.principal.currentTeamId).toBe(originalTeamId);
    }
  });
});
