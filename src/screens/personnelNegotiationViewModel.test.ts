import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { createNewGame } from '../game/initialCareer';
import { buildMarketContractNegotiation } from '../sim/personnelNegotiationEngine';
import { marketNegotiationView } from './personnelNegotiationViewModel';

describe('personnel negotiation view model', () => {
  it('derives affordability and labels from state-backed negotiation values', () => {
    const base = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'view' });
    const state = { ...base, seasonComplete: true, teams: base.teams.map((team) => team.id === base.selectedTeamId ? { ...team, budget: 0 } : team) };
    const market = careerMarketBundle(state).drivers[0];
    const seat = state.drivers.find((driver) => driver.teamId === state.selectedTeamId)!;
    const negotiation = buildMarketContractNegotiation(state, market.id, seat.id)!;
    expect(marketNegotiationView(state, negotiation)).toMatchObject({ canSubmit: false, disabledReason: 'The compensation bid exceeds the available budget.' });
  });
});
