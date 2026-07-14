import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import type { GameState } from './careerState';
import type { CommercialState } from '../types/sponsorTypes';

function freshState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'save-test',
  });
}

describe('save model', () => {
  it('populates the implemented systems and leaves unbuilt ones unset', () => {
    const s = freshState();
    // Phase 3: commercial + owner expectations are seeded on a new career.
    expect(s.commercial).toBeDefined();
    expect(s.teamExpectations).toBeDefined();
    expect(s.teamReputations).toBeDefined();
    // Phase 4: facilities are seeded on a new career.
    expect(s.facilities).toBeDefined();
    // Phase 5: engine supplier deals are seeded on a new career.
    expect(s.engine).toBeDefined();
    // Phase 6: the Team Principal profile + job market are seeded on a new career.
    expect(s.principal).toBeDefined();
    expect(s.jobOffers).toBeDefined();
    // Phase 7: driver relationships are seeded on a new career.
    expect(s.driverRelationships).toBeDefined();
    // Phase 11: universe history / records is seeded on a new career.
    expect(s.universeHistory).toBeDefined();
    // R&D foundation: every team owns its own research state and TPP ledger.
    expect(Object.keys(s.teamResearch ?? {})).toHaveLength(s.teams.length);
    expect(s.teamResearch?.[s.selectedTeamId].tpp.balance).toBe(30);
    // Parts lifecycle: fitted components and factory inventory are persisted.
    expect(Object.keys(s.teamParts ?? {})).toHaveLength(s.teams.length);
    expect(s.teamParts?.[s.selectedTeamId].inventory.length).toBeGreaterThan(0);
  });

  it('round-trips the new optional systems through JSON', () => {
    const commercial: CommercialState = {
      teamId: 't-benetton',
      commercialReputation: 60,
      sponsors: [
        {
          id: 'spo-1',
          name: 'Test Co',
          type: 'Title',
          annualValue: 25,
          bonusTerms: [],
          objectives: [],
          confidence: 70,
          contractYearsRemaining: 2,
          renewalChance: 0.6,
        },
      ],
    };
    const withSystems: GameState = { ...freshState(), commercial };
    const cloned = JSON.parse(JSON.stringify(withSystems)) as GameState;
    expect(cloned.commercial?.sponsors[0].name).toBe('Test Co');
    expect(cloned.commercial?.commercialReputation).toBe(60);
    expect(cloned.teamParts?.[cloned.selectedTeamId].inventory).toEqual(
      withSystems.teamParts?.[withSystems.selectedTeamId].inventory,
    );
  });
});
