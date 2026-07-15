import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import { gameReducer } from './gameReducer';
import { generateSponsorOffers, sponsorSlotCapacity } from '../sim/commercialEngine';
import { teamById } from './careerState';
import type { GameState } from './careerState';

function newGame(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'sponsor-seed',
  });
}

function offersFor(state: GameState) {
  const team = teamById(state, state.selectedTeamId)!;
  return generateSponsorOffers(team, state.commercial, state.randomSeed, state.seasonYear, state.series);
}

describe('sponsor selection', () => {
  it('signs an offered sponsor into the portfolio', () => {
    const state = newGame();
    const before = state.commercial!.sponsors.length;
    const offer = offersFor(state)[0];

    const next = gameReducer(state, { type: 'SIGN_SPONSOR', offerId: offer.id })!;

    expect(next.commercial!.sponsors.length).toBe(before + 1);
    expect(next.commercial!.sponsors.some((s) => s.id === offer.id)).toBe(true);
    // The signed deal is no longer on offer.
    expect(offersFor(next).some((o) => o.id === offer.id)).toBe(false);
  });

  it('drops a sponsor to free a slot', () => {
    const state = newGame();
    const target = state.commercial!.sponsors[0];

    const next = gameReducer(state, { type: 'DROP_SPONSOR', sponsorId: target.id })!;

    expect(next.commercial!.sponsors.some((s) => s.id === target.id)).toBe(false);
    expect(next.commercial!.sponsors.length).toBe(state.commercial!.sponsors.length - 1);
  });

  it('blocks signing when the portfolio is at capacity', () => {
    const base = newGame();
    const team = teamById(base, base.selectedTeamId)!;
    const capacity = sponsorSlotCapacity(team);
    const offer = offersFor(base)[0];

    // Pad the portfolio to exactly capacity with cloned, unique-id sponsors.
    const seed = base.commercial!.sponsors[0];
    const padded = Array.from({ length: capacity }, (_, i) => ({ ...seed, id: `pad-${i}` }));
    const state: GameState = { ...base, commercial: { ...base.commercial!, sponsors: padded } };

    const blocked = gameReducer(state, { type: 'SIGN_SPONSOR', offerId: offer.id })!;
    expect(blocked.commercial!.sponsors.length).toBe(capacity);
    expect(blocked.commercial!.sponsors.some((s) => s.id === offer.id)).toBe(false);
  });

  it('ignores signing an unknown offer id', () => {
    const state = newGame();
    const next = gameReducer(state, { type: 'SIGN_SPONSOR', offerId: 'does-not-exist' })!;
    expect(next.commercial!.sponsors.length).toBe(state.commercial!.sponsors.length);
  });
});
