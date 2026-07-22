import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { activeDriversForTeam, type GameState } from '../game/careerState';
import { buildDriverContractNegotiation } from '../sim/driverContractNegotiationEngine';
import { contractNegotiationView } from './contractNegotiationViewModel';

function state(): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1994, series: 'F1', teamId: 't-williams', seed: 'contract-view' });
}

describe('contract negotiation view model', () => {
  it('derives a deterministic likelihood and affordable signing fee', () => {
    const game = state();
    const driver = activeDriversForTeam(game, game.selectedTeamId)[0];
    const negotiation = buildDriverContractNegotiation(game, driver);
    const view = contractNegotiationView(game, negotiation);
    expect(view.signingFee).toBeGreaterThan(0);
    expect(view.canSubmit).toBe(true);
    expect(['Likely to accept', 'Close — expects more', 'Wants substantially more']).toContain(view.likelihoodLabel);
  });

  it('explains the affordability gate', () => {
    const game = state();
    const driver = activeDriversForTeam(game, game.selectedTeamId)[0];
    const negotiation = buildDriverContractNegotiation(game, driver);
    const broke = { ...game, teams: game.teams.map((team) => team.id === game.selectedTeamId ? { ...team, budget: 0 } : team) };
    expect(contractNegotiationView(broke, negotiation).disabledReason).toContain('budget');
  });
});
