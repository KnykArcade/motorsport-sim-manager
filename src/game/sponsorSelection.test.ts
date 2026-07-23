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
  it('opens talks and signs only after the sponsor accepts negotiated terms', () => {
    const state = newGame();
    const before = state.commercial!.sponsors.length;
    const offer = offersFor(state)[0];

    const opened = gameReducer(state, { type: 'SIGN_SPONSOR', offerId: offer.id })!;
    const negotiation = opened.commercial!.negotiations![0];
    expect(opened.commercial!.sponsors.length).toBe(before);
    const next = gameReducer(opened, { type: 'SUBMIT_SPONSOR_NEGOTIATION', negotiationId: negotiation.id, terms: negotiation.proposedTerms })!;

    expect(next.commercial!.sponsors.length).toBe(before + 1);
    expect(next.commercial!.sponsors.some((s) => s.id === offer.id)).toBe(true);
    // The signed deal is no longer on offer.
    expect(offersFor(next).some((o) => o.id === offer.id)).toBe(false);
  });

  it('charges a visible buyout and damages reputation when terminating early', () => {
    const state = newGame();
    const target = state.commercial!.sponsors[0];

    const funded = { ...state, teams: state.teams.map((team) => team.id === state.selectedTeamId ? { ...team, budget: 500_000_000 } : team) };
    const beforeBudget = funded.teams.find((team) => team.id === state.selectedTeamId)!.budget;
    const next = gameReducer(funded, { type: 'TERMINATE_SPONSOR', sponsorId: target.id })!;

    expect(next.commercial!.sponsors.some((s) => s.id === target.id)).toBe(false);
    expect(next.commercial!.sponsors.length).toBe(funded.commercial!.sponsors.length - 1);
    expect(next.teams.find((team) => team.id === state.selectedTeamId)!.budget).toBeLessThan(beforeBudget);
    expect(next.commercial!.commercialReputation).toBeLessThan(funded.commercial!.commercialReputation);
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
    expect(blocked.commercial!.negotiations ?? []).toHaveLength(0);
  });

  it('opens renewal talks only for an expiring sponsor', () => {
    const state = newGame();
    const expiring = state.commercial!.sponsors.find((sponsor) => sponsor.contractYearsRemaining === 1)
      ?? { ...state.commercial!.sponsors[0], contractYearsRemaining: 1 };
    const prepared = state.commercial!.sponsors.some((sponsor) => sponsor.id === expiring.id && sponsor.contractYearsRemaining === 1)
      ? state
      : { ...state, commercial: { ...state.commercial!, sponsors: [expiring, ...state.commercial!.sponsors.slice(1)] } };
    const next = gameReducer(prepared, { type: 'START_SPONSOR_RENEWAL', sponsorId: expiring.id })!;
    expect(next.commercial!.negotiations?.[0]).toMatchObject({ sponsorId: expiring.id, kind: 'Renewal', status: 'Draft' });
  });

  it('ignores signing an unknown offer id', () => {
    const state = newGame();
    const next = gameReducer(state, { type: 'SIGN_SPONSOR', offerId: 'does-not-exist' })!;
    expect(next.commercial!.sponsors.length).toBe(state.commercial!.sponsors.length);
  });
});
