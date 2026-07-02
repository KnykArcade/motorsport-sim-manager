import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import { gameReducer } from './gameReducer';
import { teamById } from './careerState';
import { availableEngineOffers, engineSwitchFee } from '../sim/engineSupplierEngine';
import { toMoney } from '../sim/financeEngine';
import type { GameState } from './careerState';

function newGame(budget?: number): GameState {
  const state = createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-williams',
    seed: 'engine-switch-seed',
  });
  if (budget === undefined) return state;
  return {
    ...state,
    teams: state.teams.map((t) => (t.id === state.selectedTeamId ? { ...t, budget } : t)),
  };
}

function differentOffer(state: GameState) {
  const team = teamById(state, state.selectedTeamId)!;
  const current = state.engine!.currentDeal!;
  return availableEngineOffers(state.engine, team).find(
    (o) => !(o.supplier.name === current.supplierName && o.dealType === current.dealType),
  )!;
}

describe('engine switch fee', () => {
  it('charges a buyout to budget when switching to a different deal', () => {
    const state = newGame(1_000_000_000);
    const offer = differentOffer(state);
    const fee = engineSwitchFee(state.engine!.currentDeal, offer);
    expect(fee).toBeGreaterThan(0);
    const before = teamById(state, state.selectedTeamId)!.budget;

    const next = gameReducer(state, {
      type: 'SIGN_ENGINE_DEAL',
      supplierId: offer.supplier.id,
      dealType: offer.dealType,
    })!;

    expect(next.engine!.pendingDeal?.supplierName).toBe(offer.supplier.name);
    expect(next.engine!.pendingDealFee).toBe(fee);
    expect(teamById(next, next.selectedTeamId)!.budget).toBe(before - toMoney(fee));
    expect((next.finance ?? []).some((t) => t.category === 'Engine')).toBe(true);
  });

  it('blocks switching when the team cannot afford the buyout', () => {
    const state = newGame(0);
    const offer = differentOffer(state);

    const next = gameReducer(state, {
      type: 'SIGN_ENGINE_DEAL',
      supplierId: offer.supplier.id,
      dealType: offer.dealType,
    })!;

    expect(next.engine!.pendingDeal).toBeUndefined();
    expect(teamById(next, next.selectedTeamId)!.budget).toBe(0);
  });

  it('refunds the fee when the switch is canceled by re-signing the current deal', () => {
    const state = newGame(1_000_000_000);
    const offer = differentOffer(state);
    const before = teamById(state, state.selectedTeamId)!.budget;
    const current = state.engine!.currentDeal!;
    const currentOffer = availableEngineOffers(state.engine, teamById(state, state.selectedTeamId)!).find(
      (o) => o.supplier.name === current.supplierName && o.dealType === current.dealType,
    )!;

    let next = gameReducer(state, {
      type: 'SIGN_ENGINE_DEAL',
      supplierId: offer.supplier.id,
      dealType: offer.dealType,
    })!;
    expect(teamById(next, next.selectedTeamId)!.budget).toBeLessThan(before);

    next = gameReducer(next, {
      type: 'SIGN_ENGINE_DEAL',
      supplierId: currentOffer.supplier.id,
      dealType: currentOffer.dealType,
    })!;

    expect(next.engine!.pendingDeal).toBeUndefined();
    expect(next.engine!.pendingDealFee).toBeUndefined();
    expect(teamById(next, next.selectedTeamId)!.budget).toBe(before);
  });
});
